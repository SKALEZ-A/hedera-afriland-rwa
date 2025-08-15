export interface Investment {
  id: string;
  userId: string;
  propertyId: string;
  propertyName: string;
  propertyImage?: string;
  tokenAmount: number;
  investmentValue: number;
  currentValue: number;
  totalDividends: number;
  purchasePrice: number;
  purchaseDate: string;
  status: InvestmentStatus;
  performance: InvestmentPerformance;
}

export type InvestmentStatus = 'pending' | 'active' | 'sold' | 'cancelled';

export interface InvestmentPerformance {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  dividendYield: number;
  capitalAppreciation: number;
}

export interface Portfolio {
  totalValue: number;
  totalInvested: number;
  totalReturns: number;
  totalDividends: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  investments: Investment[];
  assetAllocation: AssetAllocation[];
  performanceHistory: PerformanceDataPoint[];
}

export interface AssetAllocation {
  propertyType: string;
  value: number;
  percentage: number;
  count: number;
}

export interface PerformanceDataPoint {
  date: string;
  value: number;
  invested: number;
  returns: number;
}

export interface InvestmentPurchase {
  propertyId: string;
  tokenAmount: number;
  paymentMethod: PaymentMethod;
  paymentMethodId?: string;
}

export interface InvestmentTransaction {
  id: string;
  type: TransactionType;
  propertyId: string;
  propertyName: string;
  tokenAmount: number;
  amount: number;
  price: number;
  status: TransactionStatus;
  createdAt: string;
  completedAt?: string;
  blockchainTxId?: string;
}

export type TransactionType = 'purchase' | 'sale' | 'dividend' | 'fee';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type PaymentMethod = 'stripe' | 'mobile_money' | 'crypto' | 'bank_transfer';

export interface DividendPayment {
  id: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  tokenAmount: number;
  paymentDate: string;
  period: string;
  status: 'pending' | 'paid' | 'failed';
  blockchainTxId?: string;
}

export interface InvestmentFilters {
  status?: InvestmentStatus;
  propertyType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'date' | 'value' | 'returns' | 'yield';
  sortOrder?: 'asc' | 'desc';
}

export interface InvestmentStats {
  totalInvestments: number;
  activeInvestments: number;
  totalValue: number;
  totalReturns: number;
  averageReturn: number;
  bestPerforming: Investment;
  recentTransactions: InvestmentTransaction[];
}