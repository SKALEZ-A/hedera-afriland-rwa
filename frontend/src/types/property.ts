export interface Property {
  id: string;
  tokenId?: string;
  name: string;
  description: string;
  address: Address;
  images: string[];
  valuation: number;
  totalTokens: number;
  availableTokens: number;
  pricePerToken: number;
  minimumInvestment: number;
  expectedAnnualYield: number;
  propertyType: PropertyType;
  status: PropertyStatus;
  features: string[];
  documents: PropertyDocument[];
  performance?: PropertyPerformance;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land' | 'mixed_use';

export type PropertyStatus = 'draft' | 'active' | 'sold_out' | 'inactive';

export interface PropertyDocument {
  id: string;
  type: DocumentType;
  title: string;
  description?: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export type DocumentType = 'legal' | 'financial' | 'maintenance' | 'insurance' | 'valuation' | 'other';

export interface PropertyPerformance {
  totalInvestors: number;
  totalInvested: number;
  occupancyRate?: number;
  currentYield: number;
  totalDividendsPaid: number;
  priceAppreciation: number;
  liquidityScore: number;
  performancePeriod: {
    startDate: string;
    endDate: string;
  };
}

export interface PropertyFilters {
  location?: string;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minYield?: number;
  maxYield?: number;
  status?: PropertyStatus;
  sortBy?: 'price' | 'yield' | 'created' | 'valuation' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface PropertySearchParams extends PropertyFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PropertyListResponse {
  properties: Property[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PropertyStats {
  totalProperties: number;
  activeProperties: number;
  totalValuation: number;
  totalTokensIssued: number;
  averageYield: number;
  propertiesByType: Record<PropertyType, number>;
  propertiesByCountry: Record<string, number>;
}