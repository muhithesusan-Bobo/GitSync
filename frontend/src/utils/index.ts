export function formatKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

export function formatRelativeTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - value.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return formatDate(value);
}

export function formatPercentage(value: number, decimals = 1): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function normalizeKenyanPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = `254${cleaned.substring(1)}`;
  if (!cleaned.startsWith("254")) cleaned = `254${cleaned}`;
  return cleaned;
}

export function isValidKenyanPhone(phone: string): boolean {
  return /^254[71]\d{8}$/.test(normalizeKenyanPhone(phone));
}

export function calculateCompoundInterest(
  principal: number,
  annualRate: number,
  days: number,
): number {
  const dailyRate = annualRate / 100 / 365;
  return principal * Math.pow(1 + dailyRate, days) - principal;
}

export function generateId(prefix = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
