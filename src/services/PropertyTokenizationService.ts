import { HederaService, TokenCreationParams } from './HederaService';
import { BlockchainUtils } from '../utils/blockchain';
import { PropertyModel } from '../models/PropertyModel';
import { Property } from '../types/entities';
import { logger } from '../utils/logger';
import { PrivateKey } from '@hashgraph/sdk';

export interface PropertyTokenizationRequest {
  propertyId: string;
  tokenName: string;
  tokenSymbol?: string;
  totalSupply: number;
  decimals?: number;
  treasuryAccountId?: string;
  metadata?: Record<string, any>;
}

export interface PropertyTokenizationResult {
  success: boolean;
  tokenId?: string;
  transactionId?: string;
  property?: Property;
  error?: string;
}

export class PropertyTokenizationService {
  private hederaService: HederaService;
  private propertyModel: PropertyModel;

  constructor() {
    this.hederaService = new HederaService();
    this.propertyModel = new PropertyModel();
  }

  /**
   * Tokenize a property by creating HTS tokens
   */
  async tokenizeProperty(request: PropertyTokenizationRequest): Promise<PropertyTokenizationResult> {
    try {
      logger.info(`Starting tokenization for property: ${request.propertyId}`);

      // Get property details
      const property = await this.propertyModel.findById(request.propertyId);
      if (!property) {
        return {
          success: false,
          error: 'Property not found'
        };
      }

      // Validate property is ready for tokenization
      if (property.status !== 'pending_verification' && property.status !== 'draft') {
        return {
          success: false,
          error: `Property status ${property.status} is not eligible for tokenization`
        };
      }

      // Generate token symbol if not provided
      const tokenSymbol = request.tokenSymbol || 
        BlockchainUtils.generateTokenSymbol(property.name, property.id);

      // Prepare token creation parameters
      const tokenParams: TokenCreationParams = {
        name: request.tokenName,
        symbol: tokenSymbol,
        decimals: request.decimals || 0, // Property tokens are typically whole numbers
        initialSupply: request.totalSupply,
        treasuryAccountId: request.treasuryAccountId || process.env.HEDERA_ACCOUNT_ID!,
        adminKey: PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!),
        supplyKey: PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!),
        metadata: JSON.stringify({
          propertyId: property.id,
          propertyName: property.name,
          propertyType: property.propertyType,
          location: `${property.address.city}, ${property.address.country}`,
          valuation: property.totalValuation,
          expectedYield: property.expectedAnnualYield,
          tokenizationDate: new Date().toISOString(),
          ...request.metadata
        })
      };

      // Update property status to tokenizing
      await this.propertyModel.updateStatus(property.id, 'tokenizing');

      // Create token on Hedera
      const tokenResult = await BlockchainUtils.retryOperation(
        () => this.hederaService.createPropertyToken(tokenParams),
        3,
        2000
      );

      if (!tokenResult.success || !tokenResult.receipt?.tokenId) {
        // Revert property status on failure
        await this.propertyModel.updateStatus(property.id, 'draft');
        
        return {
          success: false,
          error: tokenResult.error || 'Failed to create token on Hedera'
        };
      }

      const tokenId = tokenResult.receipt.tokenId.toString();

      // Update property with token ID and set status to active
      const updatedProperty = await this.propertyModel.setTokenId(property.id, tokenId);

      if (!updatedProperty) {
        logger.error('Failed to update property with token ID');
        return {
          success: false,
          error: 'Failed to update property with token information'
        };
      }

      logger.info(`Property tokenization completed successfully: ${tokenId}`);

      return {
        success: true,
        tokenId,
        transactionId: tokenResult.transactionId,
        property: updatedProperty
      };

    } catch (error) {
      logger.error('Property tokenization failed:', error);
      
      // Attempt to revert property status
      try {
        await this.propertyModel.updateStatus(request.propertyId, 'draft');
      } catch (revertError) {
        logger.error('Failed to revert property status:', revertError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during tokenization'
      };
    }
  }

  /**
   * Get tokenization status for a property
   */
  async getTokenizationStatus(propertyId: string): Promise<{
    property: Property | null;
    tokenInfo?: any;
    isTokenized: boolean;
  }> {
    try {
      const property = await this.propertyModel.findById(propertyId);
      
      if (!property) {
        return {
          property: null,
          isTokenized: false
        };
      }

      if (!property.tokenId) {
        return {
          property,
          isTokenized: false
        };
      }

      // Get token information from Hedera
      const tokenInfo = await this.hederaService.getTokenInfo(property.tokenId);

      return {
        property,
        tokenInfo,
        isTokenized: true
      };

    } catch (error) {
      logger.error('Failed to get tokenization status:', error);
      throw error;
    }
  }

  /**
   * Validate property for tokenization
   */
  async validatePropertyForTokenization(propertyId: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const property = await this.propertyModel.findById(propertyId);
      
      if (!property) {
        errors.push('Property not found');
        return { valid: false, errors, warnings };
      }

      // Check property status
      if (property.status === 'active' && property.tokenId) {
        errors.push('Property is already tokenized');
      }

      if (property.status === 'inactive') {
        errors.push('Property is inactive and cannot be tokenized');
      }

      // Check required fields
      if (!property.name || property.name.trim().length === 0) {
        errors.push('Property name is required');
      }

      if (!property.totalValuation || property.totalValuation <= 0) {
        errors.push('Property valuation must be greater than 0');
      }

      if (!property.totalTokens || property.totalTokens <= 0) {
        errors.push('Total tokens must be greater than 0');
      }

      if (!property.pricePerToken || property.pricePerToken <= 0) {
        errors.push('Price per token must be greater than 0');
      }

      // Check address completeness
      if (!property.address.addressLine1 || !property.address.city || !property.address.country) {
        errors.push('Complete property address is required');
      }

      // Warnings for optional but recommended fields
      if (!property.description) {
        warnings.push('Property description is recommended');
      }

      if (!property.expectedAnnualYield) {
        warnings.push('Expected annual yield is recommended');
      }

      if (!property.propertyManagerId) {
        warnings.push('Property manager assignment is recommended');
      }

      // Check token economics
      const totalValue = property.totalTokens * property.pricePerToken;
      if (Math.abs(totalValue - property.totalValuation) > property.totalValuation * 0.01) {
        warnings.push('Token economics (total tokens × price per token) should match property valuation');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Failed to validate property for tokenization:', error);
      return {
        valid: false,
        errors: ['Failed to validate property'],
        warnings: []
      };
    }
  }

  /**
   * Get tokenization cost estimate
   */
  async getTokenizationCostEstimate(): Promise<{
    hbarCost: number;
    usdCost: number;
    breakdown: {
      tokenCreation: number;
      associationFees: number;
      networkFees: number;
    };
  }> {
    // Hedera token creation costs (approximate)
    const tokenCreationCost = 100_000_000; // ~1 HBAR in tinybars
    const associationFees = 5_000_000;     // ~0.05 HBAR per association
    const networkFees = 1_000_000;         // ~0.01 HBAR for network operations

    const totalHbarCost = tokenCreationCost + associationFees + networkFees;
    
    // Approximate USD cost (HBAR price varies)
    const hbarToUsdRate = 0.05; // This should be fetched from a price API in production
    const usdCost = BlockchainUtils.tinybarsToHbar(totalHbarCost) * hbarToUsdRate;

    return {
      hbarCost: totalHbarCost,
      usdCost,
      breakdown: {
        tokenCreation: tokenCreationCost,
        associationFees,
        networkFees
      }
    };
  }

  /**
   * Batch tokenize multiple properties
   */
  async batchTokenizeProperties(requests: PropertyTokenizationRequest[]): Promise<PropertyTokenizationResult[]> {
    const results: PropertyTokenizationResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.tokenizeProperty(request);
        results.push(result);

        // Add delay between tokenizations to avoid rate limiting
        if (requests.length > 1) {
          await BlockchainUtils.delay(2000);
        }
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get all tokenized properties
   */
  async getTokenizedProperties(): Promise<Array<{
    property: Property;
    tokenInfo: any;
  }>> {
    try {
      const activeProperties = await this.propertyModel.getPropertiesByStatus('active');
      const tokenizedProperties = activeProperties.filter(p => p.tokenId);

      const results = [];
      for (const property of tokenizedProperties) {
        try {
          const tokenInfo = await this.hederaService.getTokenInfo(property.tokenId!);
          results.push({ property, tokenInfo });
        } catch (error) {
          logger.warn(`Failed to get token info for property ${property.id}:`, error);
          // Include property even if token info fails
          results.push({ property, tokenInfo: null });
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed to get tokenized properties:', error);
      throw error;
    }
  }
}