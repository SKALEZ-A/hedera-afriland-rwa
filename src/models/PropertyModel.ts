import { BaseModel } from './BaseModel';
import { Property, PropertyStatus, PropertyType, Address } from '../types/entities';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';

export class PropertyModel extends BaseModel {
  constructor() {
    super('properties');
  }

  /**
   * Create a new property
   */
  async createProperty(propertyData: {
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
  }): Promise<Property> {
    const propertyToCreate = {
      name: propertyData.name,
      description: propertyData.description,
      property_type: propertyData.propertyType,
      address_line1: propertyData.address.addressLine1,
      address_line2: propertyData.address.addressLine2,
      city: propertyData.address.city,
      state_province: propertyData.address.stateProvince,
      country: propertyData.address.country,
      postal_code: propertyData.address.postalCode,
      latitude: propertyData.address.latitude,
      longitude: propertyData.address.longitude,
      total_valuation: propertyData.totalValuation,
      total_tokens: propertyData.totalTokens,
      available_tokens: propertyData.totalTokens, // Initially all tokens are available
      price_per_token: propertyData.pricePerToken,
      minimum_investment: propertyData.minimumInvestment || 10.00,
      expected_annual_yield: propertyData.expectedAnnualYield,
      property_size: propertyData.propertySize,
      year_built: propertyData.yearBuilt,
      property_manager_id: propertyData.propertyManagerId,
      management_fee_percentage: propertyData.managementFeePercentage || 1.00,
      platform_fee_percentage: propertyData.platformFeePercentage || 2.50,
    };

    const property = await this.create<any>(propertyToCreate);
    return this.mapDatabaseProperty(property);
  }

  /**
   * Update property token ID after tokenization
   */
  async setTokenId(propertyId: string, tokenId: string): Promise<Property | null> {
    const result = await this.updateById(propertyId, {
      token_id: tokenId,
      tokenization_date: new Date(),
      status: 'active'
    });
    return result ? this.mapDatabaseProperty(result) : null;
  }

  /**
   * Update property status
   */
  async updateStatus(propertyId: string, status: PropertyStatus): Promise<Property | null> {
    const updateData: any = { status };
    
    if (status === 'active' && !await this.hasTokenId(propertyId)) {
      updateData.listing_date = new Date();
    }

    const result = await this.updateById(propertyId, updateData);
    return result ? this.mapDatabaseProperty(result) : null;
  }

  /**
   * Update available tokens after investment
   */
  async updateAvailableTokens(propertyId: string, newAvailableTokens: number): Promise<Property | null> {
    const query = `
      UPDATE properties 
      SET available_tokens = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.query<any>(query, [propertyId, newAvailableTokens]);
    
    if (result.rows.length === 0) {
      throw new Error('Property not found');
    }

    return this.mapDatabaseProperty(result.rows[0]);
  }

  /**
   * Find properties by IDs
   */
  async findByIds(propertyIds: string[]): Promise<Property[]> {
    if (propertyIds.length === 0) {
      return [];
    }

    const placeholders = propertyIds.map((_, index) => `$${index + 1}`).join(',');
    const query = `SELECT * FROM properties WHERE id IN (${placeholders})`;
    
    const result = await this.query<any>(query, propertyIds);
    return result.rows.map(row => this.mapDatabaseProperty(row));
  }

  /**
   * Get properties by status
   */
  async getPropertiesByStatus(status: PropertyStatus): Promise<Property[]> {
    const query = 'SELECT * FROM properties WHERE status = $1 ORDER BY created_at DESC';
    const result = await this.query<any>(query, [status]);
    return result.rows.map(row => this.mapDatabaseProperty(row));
  }

  /**
   * Get properties by country
   */
  async getPropertiesByCountry(country: string): Promise<Property[]> {
    const query = 'SELECT * FROM properties WHERE country = $1 AND status = $2 ORDER BY created_at DESC';
    const result = await this.query<any>(query, [country, 'active']);
    return result.rows.map(row => this.mapDatabaseProperty(row));
  }

  /**
   * Get properties by type
   */
  async getPropertiesByType(propertyType: PropertyType): Promise<Property[]> {
    const query = 'SELECT * FROM properties WHERE property_type = $1 AND status = $2 ORDER BY created_at DESC';
    const result = await this.query<any>(query, [propertyType, 'active']);
    return result.rows.map(row => this.mapDatabaseProperty(row));
  }

  /**
   * Search properties with filters
   */
  async searchProperties(filters: {
    country?: string;
    propertyType?: PropertyType;
    minPrice?: number;
    maxPrice?: number;
    minYield?: number;
    maxYield?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ properties: Property[]; total: number }> {
    let whereConditions = ['status = $1'];
    let params: any[] = ['active'];
    let paramIndex = 2;

    if (filters.country) {
      whereConditions.push(`country = $${paramIndex++}`);
      params.push(filters.country);
    }

    if (filters.propertyType) {
      whereConditions.push(`property_type = $${paramIndex++}`);
      params.push(filters.propertyType);
    }

    if (filters.minPrice) {
      whereConditions.push(`price_per_token >= $${paramIndex++}`);
      params.push(filters.minPrice);
    }

    if (filters.maxPrice) {
      whereConditions.push(`price_per_token <= $${paramIndex++}`);
      params.push(filters.maxPrice);
    }

    if (filters.minYield) {
      whereConditions.push(`expected_annual_yield >= $${paramIndex++}`);
      params.push(filters.minYield);
    }

    if (filters.maxYield) {
      whereConditions.push(`expected_annual_yield <= $${paramIndex++}`);
      params.push(filters.maxYield);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM properties WHERE ${whereClause}`;
    const countResult = await this.query<{ total: string }>(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get properties with pagination
    let query = `SELECT * FROM properties WHERE ${whereClause} ORDER BY created_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await this.query<any>(query, params);
    const properties = result.rows.map(row => this.mapDatabaseProperty(row));

    return { properties, total };
  }

  /**
   * Get property statistics
   */
  async getPropertyStats(): Promise<{
    totalProperties: number;
    activeProperties: number;
    totalValuation: number;
    totalTokensIssued: number;
    averageYield: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_properties,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_properties,
        COALESCE(SUM(total_valuation), 0) as total_valuation,
        COALESCE(SUM(total_tokens), 0) as total_tokens_issued,
        COALESCE(AVG(expected_annual_yield), 0) as average_yield
      FROM properties
    `;

    const result = await this.query<{
      total_properties: string;
      active_properties: string;
      total_valuation: string;
      total_tokens_issued: string;
      average_yield: string;
    }>(query);

    const row = result.rows[0];
    return {
      totalProperties: parseInt(row.total_properties, 10),
      activeProperties: parseInt(row.active_properties, 10),
      totalValuation: parseFloat(row.total_valuation),
      totalTokensIssued: parseInt(row.total_tokens_issued, 10),
      averageYield: parseFloat(row.average_yield)
    };
  }

  /**
   * Check if property has token ID
   */
  private async hasTokenId(propertyId: string): Promise<boolean> {
    const query = 'SELECT token_id FROM properties WHERE id = $1';
    const result = await this.query<{ token_id: string | null }>(query, [propertyId]);
    return result.rows.length > 0 && result.rows[0].token_id !== null;
  }

  /**
   * Map database row to Property entity
   */
  private mapDatabaseProperty(row: any): Property {
    const property: any = {
      id: row.id,
      name: row.name,
      propertyType: row.property_type,
      address: {
        addressLine1: row.address_line1,
        city: row.city,
        country: row.country
      },
      totalValuation: parseFloat(row.total_valuation),
      totalTokens: parseInt(row.total_tokens, 10),
      availableTokens: parseInt(row.available_tokens, 10),
      pricePerToken: parseFloat(row.price_per_token),
      minimumInvestment: parseFloat(row.minimum_investment),
      managementFeePercentage: parseFloat(row.management_fee_percentage),
      platformFeePercentage: parseFloat(row.platform_fee_percentage),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    // Add optional fields only if they exist
    if (row.token_id) property.tokenId = row.token_id;
    if (row.description) property.description = row.description;
    if (row.address_line2) property.address.addressLine2 = row.address_line2;
    if (row.state_province) property.address.stateProvince = row.state_province;
    if (row.postal_code) property.address.postalCode = row.postal_code;
    if (row.latitude) property.address.latitude = row.latitude;
    if (row.longitude) property.address.longitude = row.longitude;
    if (row.expected_annual_yield) property.expectedAnnualYield = parseFloat(row.expected_annual_yield);
    if (row.property_size) property.propertySize = parseFloat(row.property_size);
    if (row.year_built) property.yearBuilt = row.year_built;
    if (row.property_manager_id) property.propertyManagerId = row.property_manager_id;
    if (row.listing_date) property.listingDate = row.listing_date;
    if (row.tokenization_date) property.tokenizationDate = row.tokenization_date;

    return property as Property;
  }

  /**
   * Find properties by manager ID
   */
  static async findByManagerId(managerId: string): Promise<Property[]> {
    try {
      const query = `
        SELECT * FROM properties 
        WHERE property_manager_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await db.query(query, [managerId]);
      return result.rows.map(row => this.mapRowToProperty(row));
    } catch (error) {
      logger.error('Error finding properties by manager ID:', error);
      throw error;
    }
  }

  /**
   * Record rental income for a property
   */
  static async recordRentalIncome(propertyId: string, incomeData: {
    amount: number
    period: string
    description?: string
    recordedBy: string
    recordedAt: Date
  }) {
    try {
      const query = `
        INSERT INTO rental_income (
          property_id, amount, period, description, recorded_by, recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `
      const values = [
        propertyId,
        incomeData.amount,
        incomeData.period,
        incomeData.description,
        incomeData.recordedBy,
        incomeData.recordedAt
      ]
      
      const result = await db.query(query, values)
      return result.rows[0]
    } catch (error) {
      logger.error('Error recording rental income:', error);
      throw error;
    }
  }

  /**
   * Get token holders for a property
   */
  static async getTokenHolders(propertyId: string) {
    try {
      const query = `
        SELECT 
          i.user_id,
          i.token_amount,
          i.purchase_date as investment_date,
          u.email,
          u.wallet_address
        FROM investments i
        JOIN users u ON i.user_id = u.id
        WHERE i.property_id = $1
        ORDER BY i.token_amount DESC
      `
      const result = await db.query(query, [propertyId])
      return result.rows
    } catch (error) {
      logger.error('Error getting token holders:', error);
      throw error;
    }
  }

  /**
   * Create governance proposal
   */
  static async createGovernanceProposal(propertyId: string, proposalData: any) {
    try {
      const query = `
        INSERT INTO governance_proposals (
          property_id, title, description, proposal_type, options, 
          voting_period, created_by, created_at, expires_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `
      const values = [
        propertyId,
        proposalData.title,
        proposalData.description,
        proposalData.proposalType,
        JSON.stringify(proposalData.options),
        proposalData.votingPeriod,
        proposalData.createdBy,
        proposalData.createdAt,
        proposalData.expiresAt,
        proposalData.status
      ]
      
      const result = await db.query(query, values)
      const proposal = result.rows[0]
      
      // Parse options back to array
      if (proposal.options) {
        proposal.options = JSON.parse(proposal.options)
      }
      
      return proposal
    } catch (error) {
      logger.error('Error creating governance proposal:', error);
      throw error;
    }
  }

  /**
   * Get governance proposals for a property
   */
  static async getGovernanceProposals(propertyId: string, options?: {
    status?: string
    limit?: number
    offset?: number
  }) {
    try {
      let query = `
        SELECT * FROM governance_proposals 
        WHERE property_id = $1
      `
      const values: any[] = [propertyId]
      
      if (options?.status) {
        query += ` AND status = $${values.length + 1}`
        values.push(options.status)
      }
      
      query += ` ORDER BY created_at DESC`
      
      if (options?.limit) {
        query += ` LIMIT $${values.length + 1}`
        values.push(options.limit)
      }
      
      if (options?.offset) {
        query += ` OFFSET $${values.length + 1}`
        values.push(options.offset)
      }
      
      const result = await db.query(query, values)
      return result.rows.map(row => {
        if (row.options) {
          row.options = JSON.parse(row.options)
        }
        return row
      })
    } catch (error) {
      logger.error('Error getting governance proposals:', error);
      throw error;
    }
  }

  /**
   * Get voting results for a proposal
   */
  static async getProposalVotingResults(proposalId: string) {
    try {
      const query = `
        SELECT 
          option_selected,
          COUNT(*) as vote_count,
          SUM(token_weight) as token_weight
        FROM proposal_votes 
        WHERE proposal_id = $1
        GROUP BY option_selected
        ORDER BY token_weight DESC
      `
      const result = await db.query(query, [proposalId])
      
      // Also get total participation
      const totalQuery = `
        SELECT 
          COUNT(DISTINCT user_id) as total_voters,
          SUM(token_weight) as total_token_weight
        FROM proposal_votes 
        WHERE proposal_id = $1
      `
      const totalResult = await db.query(totalQuery, [proposalId])
      
      return {
        results: result.rows,
        participation: totalResult.rows[0]
      }
    } catch (error) {
      logger.error('Error getting proposal voting results:', error);
      throw error;
    }
  }

  /**
   * Get rental income history
   */
  static async getRentalIncomeHistory(propertyId: string, startDate: Date, endDate: Date) {
    try {
      const query = `
        SELECT * FROM rental_income 
        WHERE property_id = $1 
        AND recorded_at BETWEEN $2 AND $3
        ORDER BY recorded_at DESC
      `
      const result = await db.query(query, [propertyId, startDate, endDate])
      return result.rows
    } catch (error) {
      logger.error('Error getting rental income history:', error);
      throw error;
    }
  }

  /**
   * Get average occupancy rate for a period
   */
  static async getAverageOccupancyRate(propertyId: string, startDate: Date, endDate: Date) {
    try {
      // This would typically query occupancy tracking table
      // For now, return the current occupancy rate as placeholder
      const property = await this.findById(propertyId)
      return property?.occupancyRate || 0
    } catch (error) {
      logger.error('Error getting average occupancy rate:', error);
      return 0
    }
  }

  /**
   * Get manager activity across properties
   */
  static async getManagerActivity(managerId: string, options?: {
    limit?: number
    types?: string[]
  }) {
    try {
      let query = `
        SELECT 
          'rental_income' as activity_type,
          ri.property_id,
          p.name as property_name,
          ri.amount,
          ri.period,
          ri.recorded_at as activity_date,
          ri.description
        FROM rental_income ri
        JOIN properties p ON ri.property_id = p.id
        WHERE ri.recorded_by = $1
      `
      
      if (options?.types && options.types.includes('rental_income')) {
        // Add other activity types as needed
        query += `
          UNION ALL
          SELECT 
            'document_upload' as activity_type,
            pd.property_id,
            p.name as property_name,
            NULL as amount,
            pd.document_type as period,
            pd.uploaded_at as activity_date,
            pd.title as description
          FROM property_documents pd
          JOIN properties p ON pd.property_id = p.id
          WHERE pd.uploaded_by = $1
        `
      }
      
      query += ` ORDER BY activity_date DESC`
      
      if (options?.limit) {
        query += ` LIMIT ${options.limit}`
      }
      
      const result = await db.query(query, [managerId])
      return result.rows
    } catch (error) {
      logger.error('Error getting manager activity:', error);
      throw error;
    }
  }}
