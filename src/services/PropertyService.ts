import { PropertyModel } from '../models/PropertyModel';
import { PropertyTokenizationService } from './PropertyTokenizationService';
import { Property, PropertyStatus, PropertyType, Address } from '../types/entities';
import { logger } from '../utils/logger';
import { BlockchainUtils } from '../utils/blockchain';

export interface PropertyRegistrationRequest {
  name: string;
  description?: string;
  propertyType: PropertyType;
  address: Address;
  totalValuation: number;
  totalTokens: number;
  pricePerToken: number;
  minimumInvestment?: number;
  expectedAnnualYield?: number;
  propertySize?: number;
  yearBuilt?: number;
  propertyManagerId?: string;
  managementFeePercentage?: number;
  platformFeePercentage?: number;
}

export interface PropertySearchFilters {
  country?: string;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minYield?: number;
  maxYield?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'price' | 'yield' | 'created' | 'valuation';
  sortOrder?: 'asc' | 'desc';
}

export interface PropertyValuationUpdate {
  newValuation: number;
  valuationDate: Date;
  valuationMethod: string;
  valuationProvider?: string;
  notes?: string;
}

export interface PropertyPerformanceMetrics {
  propertyId: string;
  totalInvestors: number;
  totalInvested: number;
  occupancyRate?: number;
  currentYield: number;
  totalDividendsPaid: number;
  priceAppreciation: number;
  liquidityScore: number;
  performancePeriod: {
    startDate: Date;
    endDate: Date;
  };
}

export class PropertyService {
  private propertyModel: PropertyModel;
  private tokenizationService: PropertyTokenizationService;

  constructor() {
    this.propertyModel = new PropertyModel();
    this.tokenizationService = new PropertyTokenizationService();
  }

  /**
   * Register a new property
   */
  async registerProperty(request: PropertyRegistrationRequest): Promise<{
    success: boolean;
    property?: Property;
    validationErrors?: string[];
    error?: string;
  }> {
    try {
      logger.info(`Registering new property: ${request.name}`);

      // Validate property data
      const validation = this.validatePropertyRegistration(request);
      if (!validation.valid) {
        return {
          success: false,
          validationErrors: validation.errors
        };
      }

      // Create property in database
      const propertyData: any = {
        name: request.name,
        propertyType: request.propertyType,
        address: request.address,
        totalValuation: request.totalValuation,
        totalTokens: request.totalTokens,
        pricePerToken: request.pricePerToken
      };

      if (request.description) propertyData.description = request.description;
      if (request.minimumInvestment) propertyData.minimumInvestment = request.minimumInvestment;
      if (request.expectedAnnualYield) propertyData.expectedAnnualYield = request.expectedAnnualYield;
      if (request.propertySize) propertyData.propertySize = request.propertySize;
      if (request.yearBuilt) propertyData.yearBuilt = request.yearBuilt;
      if (request.propertyManagerId) propertyData.propertyManagerId = request.propertyManagerId;
      if (request.managementFeePercentage) propertyData.managementFeePercentage = request.managementFeePercentage;
      if (request.platformFeePercentage) propertyData.platformFeePercentage = request.platformFeePercentage;

      const property = await this.propertyModel.createProperty(propertyData);

      logger.info(`Property registered successfully: ${property.id}`);

      return {
        success: true,
        property
      };

    } catch (error) {
      logger.error('Failed to register property:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get property by ID with full details
   */
  async getPropertyById(propertyId: string): Promise<Property | null> {
    try {
      return await this.propertyModel.findById(propertyId);
    } catch (error) {
      logger.error(`Failed to get property ${propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Search and list properties with filters
   */
  async searchProperties(filters: PropertySearchFilters): Promise<{
    properties: Property[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    try {
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      const searchFilters: any = { limit, offset };
      if (filters.country) searchFilters.country = filters.country;
      if (filters.propertyType) searchFilters.propertyType = filters.propertyType;
      if (filters.minPrice) searchFilters.minPrice = filters.minPrice;
      if (filters.maxPrice) searchFilters.maxPrice = filters.maxPrice;
      if (filters.minYield) searchFilters.minYield = filters.minYield;
      if (filters.maxYield) searchFilters.maxYield = filters.maxYield;

      const result = await this.propertyModel.searchProperties(searchFilters);

      // Apply sorting if specified
      if (filters.sortBy) {
        result.properties = this.sortProperties(result.properties, filters.sortBy, filters.sortOrder);
      }

      const totalPages = Math.ceil(result.total / limit);

      return {
        properties: result.properties,
        total: result.total,
        pagination: {
          page,
          limit,
          totalPages
        }
      };

    } catch (error) {
      logger.error('Failed to search properties:', error);
      throw error;
    }
  }

  /**
   * Update property status
   */
  async updatePropertyStatus(propertyId: string, status: PropertyStatus, reason?: string): Promise<{
    success: boolean;
    property?: Property;
    error?: string;
  }> {
    try {
      logger.info(`Updating property ${propertyId} status to ${status}`);

      const property = await this.propertyModel.updateStatus(propertyId, status);
      
      if (!property) {
        return {
          success: false,
          error: 'Property not found'
        };
      }

      // Log status change for audit
      logger.info(`Property ${propertyId} status updated to ${status}`, {
        propertyId,
        oldStatus: property.status,
        newStatus: status,
        reason
      });

      return {
        success: true,
        property
      };

    } catch (error) {
      logger.error(`Failed to update property status:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update property valuation
   */
  async updatePropertyValuation(propertyId: string, valuationUpdate: PropertyValuationUpdate): Promise<{
    success: boolean;
    property?: Property;
    error?: string;
  }> {
    try {
      logger.info(`Updating valuation for property ${propertyId}`);

      const property = await this.propertyModel.findById(propertyId);
      if (!property) {
        return {
          success: false,
          error: 'Property not found'
        };
      }

      // Calculate new price per token based on new valuation
      const newPricePerToken = valuationUpdate.newValuation / property.totalTokens;

      // Update property with new valuation
      const updateResult = await this.propertyModel.updateById(propertyId, {
        total_valuation: valuationUpdate.newValuation,
        price_per_token: newPricePerToken,
        updated_at: new Date()
      });

      if (!updateResult) {
        return {
          success: false,
          error: 'Failed to update property valuation'
        };
      }

      // Log valuation change for audit
      logger.info(`Property ${propertyId} valuation updated`, {
        propertyId,
        oldValuation: property.totalValuation,
        newValuation: valuationUpdate.newValuation,
        oldPricePerToken: property.pricePerToken,
        newPricePerToken,
        valuationMethod: valuationUpdate.valuationMethod,
        valuationProvider: valuationUpdate.valuationProvider
      });

      const finalProperty = await this.propertyModel.findById(propertyId);
      return {
        success: true,
        property: finalProperty || undefined
      };

    } catch (error) {
      logger.error('Failed to update property valuation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get property performance metrics
   */
  async getPropertyPerformance(propertyId: string, startDate?: Date, endDate?: Date): Promise<PropertyPerformanceMetrics | null> {
    try {
      const property = await this.propertyModel.findById(propertyId);
      if (!property) {
        return null;
      }

      // Set default date range if not provided
      const end = endDate || new Date();
      const start = startDate || new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

      // Get investment statistics
      const investmentStats = await this.getPropertyInvestmentStats(propertyId);
      
      // Calculate performance metrics
      const totalInvested = (property.totalTokens - property.availableTokens) * property.pricePerToken;
      const currentValue = property.totalValuation;
      const priceAppreciation = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

      // Get dividend information (this would need to be implemented with dividend service)
      const totalDividendsPaid = await this.getTotalDividendsPaid(propertyId, start, end);

      // Calculate current yield
      const currentYield = property.expectedAnnualYield || 0;

      // Calculate liquidity score (simplified)
      const liquidityScore = this.calculateLiquidityScore(property);

      const performanceMetrics: PropertyPerformanceMetrics = {
        propertyId,
        totalInvestors: investmentStats.totalInvestors,
        totalInvested,
        currentYield,
        totalDividendsPaid,
        priceAppreciation,
        liquidityScore,
        performancePeriod: {
          startDate: start,
          endDate: end
        }
      };

      // Only add occupancyRate if we have data
      // performanceMetrics.occupancyRate = undefined; // Would be set if we had data

      return performanceMetrics;

    } catch (error) {
      logger.error(`Failed to get property performance for ${propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Get property statistics
   */
  async getPropertyStatistics(): Promise<{
    totalProperties: number;
    activeProperties: number;
    totalValuation: number;
    totalTokensIssued: number;
    averageYield: number;
    propertiesByType: Record<PropertyType, number>;
    propertiesByCountry: Record<string, number>;
  }> {
    try {
      const stats = await this.propertyModel.getPropertyStats();
      
      // Get additional breakdowns
      const propertiesByType = await this.getPropertiesByType();
      const propertiesByCountry = await this.getPropertiesByCountry();

      return {
        ...stats,
        propertiesByType,
        propertiesByCountry
      };

    } catch (error) {
      logger.error('Failed to get property statistics:', error);
      throw error;
    }
  }

  /**
   * Initiate property tokenization
   */
  async initiateTokenization(propertyId: string, tokenName?: string, tokenSymbol?: string): Promise<{
    success: boolean;
    tokenId?: string;
    transactionId?: string;
    error?: string;
  }> {
    try {
      const property = await this.propertyModel.findById(propertyId);
      if (!property) {
        return {
          success: false,
          error: 'Property not found'
        };
      }

      // Validate property is ready for tokenization
      const validation = await this.tokenizationService.validatePropertyForTokenization(propertyId);
      if (!validation.valid) {
        return {
          success: false,
          error: `Property validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Generate token name and symbol if not provided
      const finalTokenName = tokenName || `${property.name} Token`;
      const finalTokenSymbol = tokenSymbol || BlockchainUtils.generateTokenSymbol(property.name, property.id);

      // Initiate tokenization
      const result = await this.tokenizationService.tokenizeProperty({
        propertyId,
        tokenName: finalTokenName,
        tokenSymbol: finalTokenSymbol,
        totalSupply: property.totalTokens,
        decimals: 0,
        metadata: {
          propertyType: property.propertyType,
          location: `${property.address.city}, ${property.address.country}`,
          valuation: property.totalValuation,
          expectedYield: property.expectedAnnualYield
        }
      });

      const tokenizationResult: any = {
        success: result.success
      };

      if (result.tokenId) tokenizationResult.tokenId = result.tokenId;
      if (result.transactionId) tokenizationResult.transactionId = result.transactionId;
      if (result.error) tokenizationResult.error = result.error;

      return tokenizationResult;

    } catch (error) {
      logger.error('Failed to initiate tokenization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate property registration data
   */
  private validatePropertyRegistration(request: PropertyRegistrationRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required fields validation
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Property name is required');
    }

    if (!request.propertyType) {
      errors.push('Property type is required');
    }

    if (!request.address.addressLine1 || !request.address.city || !request.address.country) {
      errors.push('Complete address is required (address line 1, city, country)');
    }

    if (!request.totalValuation || request.totalValuation <= 0) {
      errors.push('Total valuation must be greater than 0');
    }

    if (!request.totalTokens || request.totalTokens <= 0) {
      errors.push('Total tokens must be greater than 0');
    }

    if (!request.pricePerToken || request.pricePerToken <= 0) {
      errors.push('Price per token must be greater than 0');
    }

    // Business logic validation
    const calculatedTotalValue = request.totalTokens * request.pricePerToken;
    if (Math.abs(calculatedTotalValue - request.totalValuation) > request.totalValuation * 0.01) {
      errors.push('Token economics mismatch: total tokens × price per token should equal total valuation');
    }

    if (request.minimumInvestment && request.minimumInvestment < request.pricePerToken) {
      errors.push('Minimum investment cannot be less than price per token');
    }

    if (request.expectedAnnualYield && (request.expectedAnnualYield < 0 || request.expectedAnnualYield > 100)) {
      errors.push('Expected annual yield must be between 0% and 100%');
    }

    if (request.managementFeePercentage && (request.managementFeePercentage < 0 || request.managementFeePercentage > 10)) {
      errors.push('Management fee percentage must be between 0% and 10%');
    }

    if (request.platformFeePercentage && (request.platformFeePercentage < 0 || request.platformFeePercentage > 5)) {
      errors.push('Platform fee percentage must be between 0% and 5%');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sort properties based on criteria
   */
  private sortProperties(properties: Property[], sortBy: string, sortOrder: string = 'desc'): Property[] {
    return properties.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'price':
          comparison = a.pricePerToken - b.pricePerToken;
          break;
        case 'yield':
          comparison = (a.expectedAnnualYield || 0) - (b.expectedAnnualYield || 0);
          break;
        case 'valuation':
          comparison = a.totalValuation - b.totalValuation;
          break;
        case 'created':
        default:
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Get property investment statistics
   */
  private async getPropertyInvestmentStats(propertyId: string): Promise<{
    totalInvestors: number;
    totalInvested: number;
  }> {
    // This would typically query the investment table
    // For now, we'll calculate based on available tokens
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      return { totalInvestors: 0, totalInvested: 0 };
    }

    const soldTokens = property.totalTokens - property.availableTokens;
    const totalInvested = soldTokens * property.pricePerToken;

    // Simplified calculation - in reality, we'd query the investments table
    const estimatedInvestors = Math.max(1, Math.floor(soldTokens / (property.minimumInvestment / property.pricePerToken)));

    return {
      totalInvestors: soldTokens > 0 ? estimatedInvestors : 0,
      totalInvested
    };
  }

  /**
   * Get total dividends paid for a property
   */
  private async getTotalDividendsPaid(_propertyId: string, _startDate: Date, _endDate: Date): Promise<number> {
    // This would query the dividend distributions table
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Calculate liquidity score for a property
   */
  private calculateLiquidityScore(property: Property): number {
    // Simplified liquidity score calculation
    const tokensSold = property.totalTokens - property.availableTokens;
    const soldPercentage = (tokensSold / property.totalTokens) * 100;
    
    // Base score on how much of the property is sold
    let score = Math.min(soldPercentage, 80); // Cap at 80 for partial liquidity
    
    // Adjust based on property characteristics
    if (property.pricePerToken < 100) score += 10; // Lower price = more accessible
    if (property.expectedAnnualYield && property.expectedAnnualYield > 8) score += 5; // Higher yield = more attractive
    
    return Math.min(score, 100);
  }

  /**
   * Get properties breakdown by type
   */
  private async getPropertiesByType(): Promise<Record<PropertyType, number>> {
    // For now, return mock data. In a real implementation, we'd add this method to PropertyModel
    const breakdown: Record<PropertyType, number> = {
      residential: 5,
      commercial: 3,
      industrial: 1,
      land: 1,
      mixed_use: 0
    };

    return breakdown;
  }

  /**
   * Get properties breakdown by country
   */
  private async getPropertiesByCountry(): Promise<Record<string, number>> {
    // For now, return mock data. In a real implementation, we'd add this method to PropertyModel
    const breakdown: Record<string, number> = {
      'USA': 5,
      'GBR': 3,
      'DEU': 2
    };

    return breakdown;
  }
}