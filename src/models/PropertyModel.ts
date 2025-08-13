import { BaseModel } from './BaseModel';
import { Property, PropertyStatus, PropertyType, Address } from '../types/entities';

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
}