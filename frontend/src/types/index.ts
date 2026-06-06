export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
  role: "user" | "admin" | "super_admin";
  isVerified: boolean;
  walletBalance: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
}

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "investment"
  | "return"
  | "fee"
  | "c2b"
  | "b2c"
  | "stk_push";

export type TransactionStatus = "pending" | "completed" | "failed" | "cancelled";

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  phone?: string;
  mpesaReceiptNumber?: string;
  status: TransactionStatus;
  description?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface MMFund {
  id: string;
  name: string;
  provider: string;
  interestRate: number;
  minimumInvestment: number;
  riskLevel: "low" | "medium" | "high";
  maturityDays: number;
  totalAum: number;
  isActive?: boolean;
  description?: string;
  websiteUrl?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type InvestmentStatus = "active" | "matured" | "withdrawn" | "pending";

export interface Investment {
  id: string;
  userId?: string;
  fundId?: string;
  fundName?: string;
  provider?: string;
  amount: number;
  accruedInterest: number;
  currentValue: number;
  interestRate?: number;
  riskLevel?: "low" | "medium" | "high";
  status: InvestmentStatus;
  investedAt: Date | string;
  maturesAt?: Date | string | null;
  withdrawnAt?: Date | string | null;
  fund?: MMFund;
}

export interface Portfolio {
  totalInvested: number;
  currentValue: number;
  totalReturns: number;
  yieldPercentage: number;
  investments: Investment[];
  growthData: GrowthDataPoint[];
  withdrawalEligible: number;
}

export interface GrowthDataPoint {
  date: string;
  value: number;
}

export interface ProfitLossPoint {
  day: string;
  revenue: number;
  expenses: number;
  net: number;
}

export interface DashboardSummary {
  accountBalance: number;
  totalSales: number;
  monthlyProfits: number;
  profitGrowth: number;
  weeklyTransactions: WeeklyDataPoint[];
  profitLossTrend: ProfitLossPoint[];
  financialHealth: FinancialHealthScore;
  recentTransactions: Transaction[];
  aiInsight: string;
}

export interface WeeklyDataPoint {
  day: string;
  amount: number;
}

export interface FinancialHealthScore {
  overall: number;
  cashFlow: number;
  savings: number;
  investmentDiversity: number;
  debtRatio: number;
  recommendations: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
