import { logger } from './logger';

// Simple in-memory database for demo purposes
class DemoDatabase {
  private data: Map<string, any[]> = new Map();

  constructor() {
    this.initializeTables();
  }

  private initializeTables() {
    // Initialize demo tables
    this.data.set('users', [
      {
        id: '1',
        email: 'demo@globalland.app',
        firstName: 'Demo',
        lastName: 'User',
        kycStatus: 'verified',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    this.data.set('properties', [
      {
        id: '1',
        name: 'Lagos Premium Apartments',
        description: 'Luxury residential complex in Victoria Island, Lagos',
        location: {
          country: 'Nigeria',
          city: 'Lagos',
          address: 'Victoria Island, Lagos'
        },
        totalValuation: 5000000,
        totalTokens: 50000,
        pricePerToken: 100,
        availableTokens: 30000,
        propertyType: 'residential',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        name: 'Nairobi Commercial Center',
        description: 'Modern office complex in Westlands, Nairobi',
        location: {
          country: 'Kenya',
          city: 'Nairobi',
          address: 'Westlands, Nairobi'
        },
        totalValuation: 3000000,
        totalTokens: 30000,
        pricePerToken: 100,
        availableTokens: 15000,
        propertyType: 'commercial',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    this.data.set('investments', [
      {
        id: '1',
        userId: '1',
        propertyId: '1',
        tokenAmount: 1000,
        purchasePrice: 100000,
        purchaseDate: new Date(),
        status: 'active'
      }
    ]);

    this.data.set('transactions', []);

    logger.info('Demo database initialized with sample data');
  }

  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    // Simple query simulation for demo
    logger.info('Demo DB Query:', { sql, params });
    
    // Extract table name from SQL (very basic parsing)
    const tableMatch = sql.match(/FROM\s+(\w+)/i) || sql.match(/INTO\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'unknown';
    
    const rows = this.data.get(tableName) || [];
    return { rows };
  }

  async end(): Promise<void> {
    logger.info('Demo database connection closed');
  }
}

// Export singleton instance
export const demoDb = new DemoDatabase();