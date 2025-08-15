import { BaseModel } from './BaseModel';
import { Property, PropertyStatus, PropertyType, Address } from '../types/entities';
import { logger } from '../utils/logger';

export class PropertyModel extends BaseModel {
  constructor() {
    super('properties');
  }

  /**
   * Create method alias for compatibility
   */
  async create<T>(data: any): Promise<T> {
    return super.create<T>(data);
  }

  /**
   * Find all properties
   */
  async findAll(): Promise<Property[]> {
    const result = await this.query<any>('SELECT * FROM properties ORDER BY created_at DESC');
    return result.rows.map(row => this.mapDatabaseProperty(row));
  }

  /**
   * Find property by ID
   */
  async findById(id: string): Promise<Property | null> {
    const result = await super.findById<any>(id);
    return result ? this.mapDatabaseProperty(result) : null;
  }

  /**
   * Update property by ID
   */
  async update(id: string, updates: any): Promise<Property | null> {
    const result = await this.updateById(id, updates);
    return result ? this.mapDatabaseProperty(result) : null;
  }

  /**
   * Delete property by ID
   */
  async delete(id: string): Promise<void> {
    await this.deleteById(id);
  }

  /**
   * Find property by token ID
   */
  async findByTokenId(tokenId: string): Promise<Property | null> {
    const query = 'SELECT * FROM properties WHERE token_id = $1';
    const result = await this.query<any>(query, [tokenId]);
    return result.rows.length > 0 ? this.mapDatabaseProperty(result.rows[0]) : null;
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
      available_tokens: propertyData.totalTokens,
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
   * Record rental income for a property
   */
  async recordRentalIncome(propertyId: string, incomeData: {
    amount: number;
    period: string;
    description?: string;
    recordedBy: string;
    recordedAt: Date;
  }) {
    const query = `
      INSERT INTO rental_income (
        property_id, amount, period, description, recorded_by, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      propertyId,
      incomeData.amount,
      incomeData.period,
      incomeData.description,
      incomeData.recordedBy,
      incomeData.recordedAt
    ];
    
    const result = await this.query(query, values);
    return result.rows[0];
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
   * Update available tokens
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
   * Update property status
   */
  async updateStatus(propertyId: string, status: string): Promise<Property | null> {
    const result = await this.updateById(propertyId, { status });
    return result ? this.mapDatabaseProperty(result) : null;
  }

  /**
   * Set token ID
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
   * Get properties by status
   */
  async getPropertiesByStatus(status: string): Promise<Property[]> {
    const query = 'SELECT * FROM properties WHERE status = $1 ORDER BY created_at DESC';
    const result = await this.query<any>(query, [status]);
    return result.rows.map(row => this.mapDatabaseProperty(row));
  }

  /**
   * Search properties
   */
  async searchProperties(filters: any): Promise<{ properties: Property[]; total: number }> {
    const query = 'SELECT * FROM properties WHERE 1=1 ORDER BY created_at DESC LIMIT 10';
    const result = await this.query<any>(query);
    const properties = result.rows.map(row => this.mapDatabaseProperty(row));
    return { properties, total: properties.length };
  }

  /**
   * Find by IDs
   */
  async findByIds(propertyIds: string[]): Promise<Property[]> {
    if (propertyIds.length === 0) return [];
    const placeholders = propertyIds.map((_, index) => `${index + 1}`).join(',');
    const query = `SELECT * FROM properties WHERE id IN (${placeholders})`;
    const result = await this.query<any>(query, propertyIds);
    return result.rows.map(row => this.mapDatabaseProperty(row));
  }

  /**
   * Find by manager ID
   */
  async findByManagerId(managerId: string): Promise<Property[]> {
    const query = 'SELECT * FROM properties WHERE property_manager_id = $1 ORDER BY created_at DESC';
    const result = await this.query<any>(query, [managerId]);
    return result.rows.map(row => this.mapDatabaseProperty(row));
  }


  static async count(filter: any = {}): Promise<number> {
    // Placeholder implementation
    return 0;
  }

  static async find(filter: any = {}): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  static async create(data: any): Promise<any> {
    // Placeholder implementation
    return { id: 'placeholder', ...data };
  }

  static async deleteMany(filter: any = {}): Promise<void> {
    // Placeholder implementation
  }

  static async aggregate(pipeline: any[]): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  static async findByPropertyId(propertyId: string): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  static async findByType(type: string): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  static async findByUserIdAndType(userId: string, type: string): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

}