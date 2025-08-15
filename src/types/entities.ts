// Core entity types for GlobalLand RWA Platform

export type UserKYCStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
export type UserVerificationLevel = 'basic' | 'intermediate' | 'advanced';
export type PropertyStatus = 'draft' | 'pending_verification' | 'tokenizing' | 'active' | 'sold_out' | 'inactive';
export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land' | 'mixed_use';
export type TransactionType = 'investment' | 'dividend' | 'withdrawal' | 'transfer' | 'fee';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type InvestmentStatus = 'active' | 'sold' | 'partial_sold';
export type OrderType = 'BUY' | 'SELL' | 'buy' | 'sell';
export type OrderStatus = 'open' | 'partial_filled' | 'filled' | 'cancelled' | 'expired';
export type PaymentMethod = 'STRIPE' | 'MOBILE_MONEY' | 'CRYPTO' | 'card' | 'bank_transfer' | 'mobile_money' | 'crypto' | 'hbar';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'KES' | 'ZAR' | 'GHS' | 'UGX' | 'HBAR';

// Additional missing types
export type Currency = CurrencyCode;
export type TokenId = string;
export type TradeStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

// Order and Trade entities
export interface Order extends MarketOrder {}
export interface Trade extends MarketTrade {}

// Exchange rates interface
export interface ExchangeRates {
  [key: string]: number;
}

// Mobile payment request interface
export interface MobilePaymentRequest extends PaymentRequest {
  phoneNumber: string;
  mobileMoneyProvider: string;
}

// User Entity
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: Date;
  nationality?: string; // ISO 3166-1 alpha-3 country code
  walletAddress?: string;
  kycStatus: UserKYCStatus;
  verificationLevel: UserVerificationLevel;
  kycProvider?: string;
  kycReference?: string;
  kycCompletedAt?: Date;
  isAccreditedInvestor: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Address interface
export interface Address {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  country: string; // ISO 3166-1 alpha-3
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

// Property Entity
export interface Property {
  id: string;
  tokenId?: string; // Hedera Token ID
  name: string;
  description?: string;
  propertyType: PropertyType;
  address: Address;
  totalValuation: number;
  totalTokens: number;
  availableTokens: number;
  pricePerToken: number;
  minimumInvestment: number;
  expectedAnnualYield?: number; // Percentage
  propertySize?: number; // Square meters
  yearBuilt?: number;
  propertyManagerId?: string;
  managementFeePercentage: number;
  platformFeePercentage: number;
  status: PropertyStatus;
  listingDate?: Date;
  tokenizationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Property Document Entity
export interface PropertyDocument {
  id: string;
  propertyId: string;
  documentType: string; // 'deed', 'valuation', 'inspection', 'legal', 'financial'
  documentName: string;
  fileUrl: string; // IPFS hash or URL
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  verificationStatus: string; // 'pending', 'verified', 'rejected'
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
}

// Investment Entity
export interface Investment {
  id: string;
  userId: string;
  propertyId: string;
  tokenAmount: number;
  purchasePricePerToken: number;
  totalPurchasePrice: number;
  purchaseDate: Date;
  currentValue?: number;
  totalDividendsReceived: number;
  status: InvestmentStatus;
  blockchainTxId?: string; // Hedera transaction ID
  createdAt: Date;
  updatedAt: Date;
}

// Transaction Entity
export interface Transaction {
  id: string;
  userId: string;
  propertyId?: string;
  investmentId?: string;
  transactionType: TransactionType;
  amount: number;
  currency: CurrencyCode;
  feeAmount: number;
  netAmount: number;
  status: TransactionStatus;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  blockchainTxId?: string; // Hedera transaction ID
  description?: string;
  metadata?: Record<string, any>; // Additional transaction data
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Dividend Distribution Entity
export interface DividendDistribution {
  id: string;
  propertyId: string;
  distributionDate: Date;
  totalAmount: number;
  currency: CurrencyCode;
  amountPerToken: number;
  totalTokensEligible: number;
  managementFee: number;
  platformFee: number;
  netDistribution: number;
  blockchainTxId?: string; // Hedera transaction ID for distribution
  status: string; // 'pending', 'processing', 'completed', 'failed'
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Individual Dividend Payment Entity
export interface DividendPayment {
  id: string;
  distributionId: string;
  userId: string;
  investmentId: string;
  tokenAmount: number;
  dividendAmount: number;
  currency: CurrencyCode;
  status: string; // 'pending', 'paid', 'failed'
  blockchainTxId?: string; // Individual payment transaction ID
  paidAt?: Date;
  createdAt: Date;
}

// Market Order Entity
export interface MarketOrder {
  id: string;
  userId: string;
  propertyId: string;
  orderType: OrderType;
  tokenAmount: number;
  pricePerToken: number;
  totalValue: number;
  filledAmount: number;
  remainingAmount: number;
  status: OrderStatus;
  expiresAt?: Date;
  filledAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Market Trade Entity
export interface MarketTrade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  propertyId: string;
  tokenAmount: number;
  pricePerToken: number;
  totalValue: number;
  platformFee: number;
  blockchainTxId?: string; // Hedera transaction ID
  executedAt: Date;
}

// User Session Entity
export interface UserSession {
  id: string;
  userId: string;
  sessionToken: string;
  refreshToken?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
}

// Audit Log Entity
export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Notification Entity
export interface Notification {
  id: string;
  userId: string;
  type: string; // 'dividend', 'investment', 'kyc', 'security', 'marketing'
  title: string;
  message: string;
  data?: Record<string, any>; // Additional notification data
  readAt?: Date;
  sentVia: string[]; // Array of channels: 'email', 'push', 'sms'
  createdAt: Date;
}

// Portfolio summary interface
export interface Portfolio {
  userId: string;
  totalInvestments: number;
  totalValue: number;
  totalDividends: number;
  totalReturn: number;
  returnPercentage: number;
  investments: Investment[];
  properties: Property[];
}

// Property performance metrics
export interface PropertyMetrics {
  propertyId: string;
  totalInvestors: number;
  totalInvested: number;
  occupancyRate?: number;
  averageYield: number;
  totalDividendsPaid: number;
  priceAppreciation: number;
  liquidityScore: number;
}

// Market data interface
export interface MarketData {
  propertyId: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  volume24h: number;
  marketCap: number;
  availableTokens: number;
  totalTokens: number;
  lastTradePrice?: number;
  lastTradeTime?: Date;
}

// KYC document interface
export interface KYCDocument {
  type: string; // 'passport', 'national_id', 'drivers_license', 'utility_bill', 'bank_statement'
  frontImage?: string; // Base64 or URL
  backImage?: string; // Base64 or URL
  documentNumber?: string;
  expiryDate?: Date;
  issueDate?: Date;
  issuingCountry?: string;
}

// Payment request interface
export interface PaymentRequest {
  userId: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: PaymentMethod;
  description?: string;
  metadata?: Record<string, any>;
  // Additional properties for different payment methods
  paymentMethodId?: string;
  propertyId?: string;
  tokenAmount?: number;
  phoneNumber?: string;
  mobileMoneyProvider?: string;
}

// Payment result interface
export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  paymentReference?: string;
  amount: number;
  currency: CurrencyCode;
  status: TransactionStatus;
  message?: string;
  metadata?: Record<string, any>;
  // Additional properties
  timestamp?: Date;
  error?: string;
  providerResponse?: any;
}

// Notification template interface
export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  emailTemplate: string;
  smsTemplate?: string;
  pushTemplate?: {
    title: string;
    body: string;
    data: Record<string, any>;
  };
}

// Notification preferences interface
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  realTime: boolean;
}

// Notification history interface
export interface NotificationHistory {
  id: string;
  userId: string;
  templateId: string;
  channels: string[];
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
  createdAt: Date;
  deliveredAt?: Date;
  variables: Record<string, any>;
}