import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const OFFLINE_QUEUE_KEY = 'hazina_offline_queue';

export interface OfflineRequest {
  id: string;
  method: string;
  url: string;
  data?: any;
  headers?: any;
  createdAt: string;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const loadOfflineQueue = (): OfflineRequest[] => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveOfflineQueue = (queue: OfflineRequest[]) => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

export const getOfflineQueueLength = () => loadOfflineQueue().length;

export const processOfflineQueue = async () => {
  const queue = loadOfflineQueue();
  if (queue.length === 0 || typeof navigator === 'undefined' || !navigator.onLine) {
    return;
  }

  const remaining: OfflineRequest[] = [];
  for (const request of queue) {
    try {
      await api({
        method: request.method,
        url: request.url,
        data: request.data,
        headers: request.headers,
      });
    } catch (error) {
      remaining.push(request);
    }
  }

  saveOfflineQueue(remaining);
};

const enqueueOfflineRequest = async (request: OfflineRequest) => {
  const queue = loadOfflineQueue();
  queue.push(request);
  saveOfflineQueue(queue);
};

console.debug('[API] baseURL:', API_BASE_URL);

api.interceptors.request.use(
  (config) => {
    if (config.url) {
      console.debug('[API request]', config.method?.toUpperCase(), config.baseURL + config.url);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Request Interceptor: Attach Auth Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.url) {
      console.debug('[API request]', config.method?.toUpperCase(), config.baseURL + config.url);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh on 401 and offline queuing
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url === '/auth/login' || originalRequest.url === '/auth/refresh') {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    const isNetworkError = !error.response && error.message && error.message.toLowerCase().includes('network');
    const method = originalRequest?.method?.toUpperCase();
    if (isNetworkError && method && method !== 'GET') {
      try {
        await enqueueOfflineRequest({
          id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          method,
          url: originalRequest.url,
          data: originalRequest.data,
          headers: originalRequest.headers,
          createdAt: new Date().toISOString(),
        });
        await processOfflineQueue();
        const queuedError = new Error('Offline request queued and will retry when the connection returns.');
        (queuedError as any).offlineQueued = true;
        return Promise.reject(queuedError);
      } catch (queueError) {
        return Promise.reject(queueError);
      }
    }

    return Promise.reject(error);
  }
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processOfflineQueue().catch((err) => console.warn('[API] offline queue retry failed', err));
  });

  if (navigator.onLine) {
    processOfflineQueue().catch((err) => console.warn('[API] offline queue retry failed', err));
  }
}

export default api;
