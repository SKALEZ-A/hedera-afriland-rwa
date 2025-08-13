import { PropertyModel } from '../models/PropertyModel';
import { Property } from '../types/entities';
import { logger } from '../utils/logger';

export interface ValuationRequest {
  propertyId: string;
  valuationMethod: 'comparative_market_analysis' | 'income_approach' | 'cost_approach' | 'automated_valuation_model' | 'professional_appraisal';
  comparableProperties?: string[]; // Property IDs for CMA
  annualRentalIncome?: number; // For income approach
  operatingExpenses?: number; // For income approach
  capRate?: number; // Capitalization rate for income approach
  constructionCost?: number; // For cost approach
  landValue?: number; // For cost approach
  depreciation?: number; // For cost approach
  marketData?: Record<string, any>; // External market data
}

export interface ValuationResult {
  propertyId: string;
  estimatedValue: number;
  confidence: number; // 0-100 percentage
  valuationMethod: string;
  factors: {
    location: number;
    propertyType: number;
    size: number;
    age: number;
    marketTrends: number;
    comparables?: number;
    income?: number;
  };
  comparableProperties?: Array<{
    propertyId: string;
    name: string;
    pricePerSqm: number;
    adjustmentFactor: number;
  }>;
  marketInsights: {
    averagePricePerSqm: number;
    marketTrend: 'rising' | 'stable' | 'declining';
    demandLevel: 'high' | 'medium' | 'low';
    liquidityScore: number;
  };
  lastUpdated: Date;
}

export class PropertyValuationService {
  private propertyModel: PropertyModel;

  constructor() {
    this.propertyModel = new PropertyModel();
  }

  /**
   * Perform automated property valuation
   */
  async performValuation(request: ValuationRequest): Promise<ValuationResult> {
    try {
      logger.info(`Performing valuation for property ${request.propertyId} using ${request.valuationMethod}`);

      const property = await this.propertyModel.findById(request.propertyId);
      if (!property) {
        throw new Error('Property not found');
      }

      let estimatedValue: number;
      let confidence: number;
      let factors: any = {};
      let comparableProperties: any[] = [];

      switch (request.valuationMethod) {
        case 'comparative_market_analysis':
          ({ estimatedValue, confidence, factors, comparableProperties } = await this.performCMA(property, request));
          break;
        case 'income_approach':
          ({ estimatedValue, confidence, factors } = await this.performIncomeApproach(property, request));
          break;
        case 'cost_approach':
          ({ estimatedValue, confidence, factors } = await this.performCostApproach(property, request));
          break;
        case 'automated_valuation_model':
          ({ estimatedValue, confidence, factors } = await this.performAVM(property));
          break;
        case 'professional_appraisal':
          ({ estimatedValue, confidence, factors } = await this.processAppraisal(property, request));
          break;
        default:
          throw new Error('Invalid valuation method');
      }

      // Get market insights
      const marketInsights = await this.getMarketInsights(property);

      const result: ValuationResult = {
        propertyId: request.propertyId,
        estimatedValue,
        confidence,
        valuationMethod: request.valuationMethod,
        factors,
        comparableProperties: comparableProperties.length > 0 ? comparableProperties : undefined,
        marketInsights,
        lastUpdated: new Date()
      };

      logger.info(`Valuation completed for property ${request.propertyId}: $${estimatedValue} (${confidence}% confidence)`);

      return result;

    } catch (error) {
      logger.error(`Valuation failed for property ${request.propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Get property pricing recommendations
   */
  async getPricingRecommendations(propertyId: string): Promise<{
    recommendedPricePerToken: number;
    priceRange: {
      min: number;
      max: number;
    };
    marketPosition: 'premium' | 'market' | 'value';
    reasoning: string[];
  }> {
    try {
      const property = await this.propertyModel.findById(propertyId);
      if (!property) {
        throw new Error('Property not found');
      }

      // Perform AVM valuation for pricing
      const valuation = await this.performValuation({
        propertyId,
        valuationMethod: 'automated_valuation_model'
      });

      const recommendedPricePerToken = valuation.estimatedValue / property.totalTokens;
      const variance = 0.15; // 15% variance for range

      const priceRange = {
        min: recommendedPricePerToken * (1 - variance),
        max: recommendedPricePerToken * (1 + variance)
      };

      // Determine market position
      let marketPosition: 'premium' | 'market' | 'value';
      const currentPriceRatio = property.pricePerToken / recommendedPricePerToken;

      if (currentPriceRatio > 1.1) {
        marketPosition = 'premium';
      } else if (currentPriceRatio < 0.9) {
        marketPosition = 'value';
      } else {
        marketPosition = 'market';
      }

      // Generate reasoning
      const reasoning = this.generatePricingReasoning(property, valuation, marketPosition);

      return {
        recommendedPricePerToken,
        priceRange,
        marketPosition,
        reasoning
      };

    } catch (error) {
      logger.error(`Failed to get pricing recommendations for property ${propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Perform Comparative Market Analysis
   */
  private async performCMA(property: Property, request: ValuationRequest): Promise<{
    estimatedValue: number;
    confidence: number;
    factors: any;
    comparableProperties: any[];
  }> {
    // Find comparable properties
    const comparables = await this.findComparableProperties(property, request.comparableProperties);
    
    if (comparables.length === 0) {
      throw new Error('No comparable properties found for CMA');
    }

    // Calculate adjustments and weighted average
    let totalWeightedValue = 0;
    let totalWeight = 0;
    const comparableProperties = [];

    for (const comparable of comparables) {
      const adjustmentFactor = this.calculateAdjustmentFactor(property, comparable);
      const adjustedValue = comparable.totalValuation * adjustmentFactor;
      const weight = this.calculateComparableWeight(property, comparable);

      totalWeightedValue += adjustedValue * weight;
      totalWeight += weight;

      comparableProperties.push({
        propertyId: comparable.id,
        name: comparable.name,
        pricePerSqm: comparable.propertySize ? comparable.totalValuation / comparable.propertySize : 0,
        adjustmentFactor
      });
    }

    const estimatedValue = totalWeightedValue / totalWeight;
    const confidence = Math.min(95, 60 + (comparables.length * 10)); // Higher confidence with more comparables

    const factors = {
      location: 0.3,
      propertyType: 0.2,
      size: 0.2,
      age: 0.15,
      marketTrends: 0.15,
      comparables: comparables.length
    };

    return { estimatedValue, confidence, factors, comparableProperties };
  }

  /**
   * Perform Income Approach valuation
   */
  private async performIncomeApproach(property: Property, request: ValuationRequest): Promise<{
    estimatedValue: number;
    confidence: number;
    factors: any;
  }> {
    if (!request.annualRentalIncome || !request.capRate) {
      throw new Error('Annual rental income and cap rate required for income approach');
    }

    const operatingExpenses = request.operatingExpenses || (request.annualRentalIncome * 0.3); // Default 30% expenses
    const netOperatingIncome = request.annualRentalIncome - operatingExpenses;
    const estimatedValue = netOperatingIncome / (request.capRate / 100);

    const confidence = 75; // Moderate confidence for income approach

    const factors = {
      location: 0.25,
      propertyType: 0.25,
      size: 0.15,
      age: 0.1,
      marketTrends: 0.15,
      income: 0.1
    };

    return { estimatedValue, confidence, factors };
  }

  /**
   * Perform Cost Approach valuation
   */
  private async performCostApproach(property: Property, request: ValuationRequest): Promise<{
    estimatedValue: number;
    confidence: number;
    factors: any;
  }> {
    if (!request.constructionCost || !request.landValue) {
      throw new Error('Construction cost and land value required for cost approach');
    }

    const depreciation = request.depreciation || this.calculateDepreciation(property);
    const depreciatedConstructionCost = request.constructionCost * (1 - depreciation / 100);
    const estimatedValue = request.landValue + depreciatedConstructionCost;

    const confidence = 70; // Moderate confidence for cost approach

    const factors = {
      location: 0.3,
      propertyType: 0.2,
      size: 0.2,
      age: 0.2,
      marketTrends: 0.1
    };

    return { estimatedValue, confidence, factors };
  }

  /**
   * Perform Automated Valuation Model
   */
  private async performAVM(property: Property): Promise<{
    estimatedValue: number;
    confidence: number;
    factors: any;
  }> {
    // Simplified AVM using property characteristics and market data
    const baseValue = property.totalValuation;
    
    // Location factor (simplified)
    const locationMultiplier = this.getLocationMultiplier(property.address.country, property.address.city);
    
    // Property type factor
    const typeMultiplier = this.getPropertyTypeMultiplier(property.propertyType);
    
    // Age factor
    const ageMultiplier = this.getAgeMultiplier(property.yearBuilt);
    
    // Market trend factor
    const marketMultiplier = await this.getMarketTrendMultiplier(property.address.country);

    const estimatedValue = baseValue * locationMultiplier * typeMultiplier * ageMultiplier * marketMultiplier;
    const confidence = 65; // Moderate confidence for AVM

    const factors = {
      location: locationMultiplier,
      propertyType: typeMultiplier,
      size: 1.0, // Neutral for AVM
      age: ageMultiplier,
      marketTrends: marketMultiplier
    };

    return { estimatedValue, confidence, factors };
  }

  /**
   * Process professional appraisal data
   */
  private async processAppraisal(property: Property, request: ValuationRequest): Promise<{
    estimatedValue: number;
    confidence: number;
    factors: any;
  }> {
    // In a real implementation, this would process uploaded appraisal documents
    // For now, we'll use the current valuation with high confidence
    const estimatedValue = property.totalValuation;
    const confidence = 95; // High confidence for professional appraisal

    const factors = {
      location: 0.25,
      propertyType: 0.25,
      size: 0.2,
      age: 0.15,
      marketTrends: 0.15
    };

    return { estimatedValue, confidence, factors };
  }

  /**
   * Find comparable properties
   */
  private async findComparableProperties(property: Property, specificIds?: string[]): Promise<Property[]> {
    if (specificIds && specificIds.length > 0) {
      // Use specific comparable properties if provided
      const comparables = [];
      for (const id of specificIds) {
        const comparable = await this.propertyModel.findById(id);
        if (comparable) {
          comparables.push(comparable);
        }
      }
      return comparables;
    }

    // Find similar properties automatically
    const filters = {
      country: property.address.country,
      propertyType: property.propertyType,
      limit: 10
    };

    const result = await this.propertyModel.searchProperties(filters);
    
    // Filter out the property itself and select best matches
    return result.properties
      .filter(p => p.id !== property.id)
      .slice(0, 5); // Take top 5 comparables
  }

  /**
   * Calculate adjustment factor between properties
   */
  private calculateAdjustmentFactor(subject: Property, comparable: Property): number {
    let factor = 1.0;

    // Size adjustment
    if (subject.propertySize && comparable.propertySize) {
      const sizeRatio = subject.propertySize / comparable.propertySize;
      factor *= Math.pow(sizeRatio, 0.3); // Size has moderate impact
    }

    // Age adjustment
    if (subject.yearBuilt && comparable.yearBuilt) {
      const ageDifference = Math.abs(subject.yearBuilt - comparable.yearBuilt);
      factor *= Math.max(0.8, 1 - (ageDifference * 0.005)); // 0.5% per year difference
    }

    // Location adjustment (simplified)
    if (subject.address.city !== comparable.address.city) {
      factor *= 0.95; // 5% discount for different city
    }

    return factor;
  }

  /**
   * Calculate weight for comparable property
   */
  private calculateComparableWeight(subject: Property, comparable: Property): number {
    let weight = 1.0;

    // Same city gets higher weight
    if (subject.address.city === comparable.address.city) {
      weight *= 1.5;
    }

    // Same property type gets higher weight
    if (subject.propertyType === comparable.propertyType) {
      weight *= 1.3;
    }

    // Similar size gets higher weight
    if (subject.propertySize && comparable.propertySize) {
      const sizeRatio = Math.min(subject.propertySize, comparable.propertySize) / 
                       Math.max(subject.propertySize, comparable.propertySize);
      weight *= sizeRatio;
    }

    return weight;
  }

  /**
   * Calculate depreciation based on property age
   */
  private calculateDepreciation(property: Property): number {
    if (!property.yearBuilt) {
      return 20; // Default 20% depreciation
    }

    const currentYear = new Date().getFullYear();
    const age = currentYear - property.yearBuilt;
    
    // Simplified depreciation: 2% per year for first 10 years, then 1% per year
    if (age <= 10) {
      return Math.min(age * 2, 20);
    } else {
      return Math.min(20 + (age - 10) * 1, 50); // Cap at 50%
    }
  }

  /**
   * Get location multiplier
   */
  private getLocationMultiplier(country: string, city: string): number {
    // Simplified location factors - in reality, this would use comprehensive market data
    const countryFactors: Record<string, number> = {
      'USA': 1.2,
      'GBR': 1.15,
      'DEU': 1.1,
      'NGA': 0.8,
      'KEN': 0.7,
      'ZAF': 0.85,
      'GHA': 0.75
    };

    return countryFactors[country] || 1.0;
  }

  /**
   * Get property type multiplier
   */
  private getPropertyTypeMultiplier(propertyType: string): number {
    const typeFactors: Record<string, number> = {
      'commercial': 1.1,
      'residential': 1.0,
      'industrial': 0.95,
      'mixed_use': 1.05,
      'land': 0.9
    };

    return typeFactors[propertyType] || 1.0;
  }

  /**
   * Get age multiplier
   */
  private getAgeMultiplier(yearBuilt?: number): number {
    if (!yearBuilt) {
      return 0.9; // Default for unknown age
    }

    const currentYear = new Date().getFullYear();
    const age = currentYear - yearBuilt;

    if (age <= 5) return 1.1; // New properties premium
    if (age <= 15) return 1.0; // Prime age
    if (age <= 30) return 0.95; // Mature
    return 0.85; // Older properties
  }

  /**
   * Get market trend multiplier
   */
  private async getMarketTrendMultiplier(country: string): Promise<number> {
    // Simplified market trends - in reality, this would use real market data APIs
    const marketTrends: Record<string, number> = {
      'USA': 1.05, // Rising market
      'GBR': 1.02,
      'DEU': 1.03,
      'NGA': 1.08, // High growth
      'KEN': 1.06,
      'ZAF': 1.01,
      'GHA': 1.07
    };

    return marketTrends[country] || 1.0;
  }

  /**
   * Get market insights
   */
  private async getMarketInsights(property: Property): Promise<{
    averagePricePerSqm: number;
    marketTrend: 'rising' | 'stable' | 'declining';
    demandLevel: 'high' | 'medium' | 'low';
    liquidityScore: number;
  }> {
    // Get similar properties for market analysis
    const similarProperties = await this.propertyModel.searchProperties({
      country: property.address.country,
      propertyType: property.propertyType,
      limit: 20
    });

    // Calculate average price per sqm
    const propertiesWithSize = similarProperties.properties.filter(p => p.propertySize && p.propertySize > 0);
    const averagePricePerSqm = propertiesWithSize.length > 0 
      ? propertiesWithSize.reduce((sum, p) => sum + (p.totalValuation / p.propertySize!), 0) / propertiesWithSize.length
      : 0;

    // Simplified market trend analysis
    const marketTrend: 'rising' | 'stable' | 'declining' = 'rising'; // Would be calculated from historical data

    // Simplified demand level
    const soldPercentage = similarProperties.properties.reduce((sum, p) => {
      return sum + ((p.totalTokens - p.availableTokens) / p.totalTokens);
    }, 0) / similarProperties.properties.length;

    const demandLevel: 'high' | 'medium' | 'low' = soldPercentage > 0.7 ? 'high' : soldPercentage > 0.4 ? 'medium' : 'low';

    // Calculate liquidity score
    const liquidityScore = Math.min(100, soldPercentage * 100 + (similarProperties.properties.length * 2));

    return {
      averagePricePerSqm,
      marketTrend,
      demandLevel,
      liquidityScore
    };
  }

  /**
   * Generate pricing reasoning
   */
  private generatePricingReasoning(property: Property, valuation: ValuationResult, marketPosition: string): string[] {
    const reasoning = [];

    reasoning.push(`Property valued at $${valuation.estimatedValue.toLocaleString()} using ${valuation.valuationMethod}`);
    reasoning.push(`Current pricing is ${marketPosition} relative to market valuation`);

    if (valuation.marketInsights.demandLevel === 'high') {
      reasoning.push('High demand in this market segment supports premium pricing');
    } else if (valuation.marketInsights.demandLevel === 'low') {
      reasoning.push('Lower demand suggests competitive pricing strategy');
    }

    if (valuation.marketInsights.marketTrend === 'rising') {
      reasoning.push('Rising market trends support higher valuations');
    } else if (valuation.marketInsights.marketTrend === 'declining') {
      reasoning.push('Declining market trends suggest conservative pricing');
    }

    if (property.expectedAnnualYield && property.expectedAnnualYield > 8) {
      reasoning.push('High expected yield justifies premium pricing');
    }

    return reasoning;
  }
}