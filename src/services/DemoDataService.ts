import { logger } from '../utils/logger'
import { UserModel } from '../models/UserModel'
import { PropertyModel } from '../models/PropertyModel'
import { InvestmentModel } from '../models/InvestmentModel'
import { TransactionModel } from '../models/TransactionModel'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'

export interface DemoUser {
  id: string
  email: string
  password: string
  firstName: string
  lastName: string
  role: 'investor' | 'property_manager' | 'admin'
  kycStatus: 'pending' | 'approved' | 'rejected'
  country: string
  phoneNumber: string
  profileImage?: string
  bio?: string
}

export interface DemoProperty {
  id: string
  name: string
  propertyType: 'residential' | 'commercial' | 'mixed_use'
  address: {
    addressLine1: string
    city: string
    state: string
    country: string
    postalCode: string
    coordinates?: { lat: number; lng: number }
  }
  totalValuation: number
  totalTokens: number
  availableTokens: number
  pricePerToken: number
  expectedAnnualReturn: number
  description: string
  amenities: string[]
  images: string[]
  documents: string[]
  managerId: string
  status: 'draft' | 'active' | 'tokenized' | 'sold_out'
  tokenId?: string
  createdAt: Date
  features: {
    size: number
    bedrooms?: number
    bathrooms?: number
    parking?: number
    yearBuilt: number
    condition: 'excellent' | 'good' | 'fair' | 'needs_renovation'
  }
  financials: {
    monthlyRent: number
    operatingExpenses: number
    netOperatingIncome: number
    capRate: number
    cashOnCashReturn: number
  }
}

export interface DemoInvestment {
  id: string
  userId: string
  propertyId: string
  tokenAmount: number
  investmentValue: number
  purchasePrice: number
  currentValue: number
  status: 'active' | 'sold' | 'pending'
  purchaseDate: Date
  dividendsReceived: number
  totalReturn: number
}

export interface DemoTransaction {
  id: string
  userId: string
  propertyId?: string
  type: 'investment' | 'dividend' | 'sale' | 'fee'
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed'
  paymentMethod: 'card' | 'bank_transfer' | 'mobile_money'
  description: string
  createdAt: Date
  completedAt?: Date
}

class DemoDataService {
  private demoUsers: DemoUser[] = []
  private demoProperties: DemoProperty[] = []
  private demoInvestments: DemoInvestment[] = []
  private demoTransactions: DemoTransaction[] = []

  /**
   * Initialize all demo data
   */
  async initializeDemoData(): Promise<void> {
    try {
      logger.info('Initializing demo data...');

      await this.createDemoUsers()
      await this.createDemoProperties()
      await this.createDemoInvestments()
      await this.createDemoTransactions()

      logger.info('Demo data initialized successfully', {
        users: this.demoUsers.length,
        properties: this.demoProperties.length,
        investments: this.demoInvestments.length,
        transactions: this.demoTransactions.length
      })
    } catch (error) {
      logger.error('Failed to initialize demo data', error);
      throw error;
    }
  }

  /**
   * Create demo users
   */
  private async createDemoUsers(): Promise<void> {
    const users: Omit<DemoUser, 'id'>[] = [
      // Investors
      {
        email: 'john.investor@example.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'John',
        lastName: 'Investor',
        role: 'investor',
        kycStatus: 'approved',
        country: 'Kenya',
        phoneNumber: '+254700123456',
        bio: 'Tech entrepreneur looking to diversify into real estate'
      },
      {
        email: 'sarah.wealth@example.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'Sarah',
        lastName: 'Wealth',
        role: 'investor',
        kycStatus: 'approved',
        country: 'Nigeria',
        phoneNumber: '+234801234567',
        bio: 'Investment banker with focus on emerging markets'
      },
      {
        email: 'david.crypto@example.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'David',
        lastName: 'Crypto',
        role: 'investor',
        kycStatus: 'approved',
        country: 'Uganda',
        phoneNumber: '+256700123456',
        bio: 'Cryptocurrency investor exploring tokenized real estate'
      },
      {
        email: 'maria.diaspora@example.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'Maria',
        lastName: 'Diaspora',
        role: 'investor',
        kycStatus: 'approved',
        country: 'United States',
        phoneNumber: '+1555123456',
        bio: 'African diaspora investor seeking homeland opportunities'
      },
      {
        email: 'ahmed.pension@example.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'Ahmed',
        lastName: 'Pension',
        role: 'investor',
        kycStatus: 'approved',
        country: 'Ghana',
        phoneNumber: '+233201234567',
        bio: 'Pension fund manager diversifying portfolio'
      },

      // Property Managers
      {
        email: 'jane.properties@example.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'Jane',
        lastName: 'Properties',
        role: 'property_manager',
        kycStatus: 'approved',
        country: 'Kenya',
        phoneNumber: '+254700987654',
        bio: 'Experienced property developer in Nairobi with 15+ years experience'
      },
      {
        email: 'michael.estates@example.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'Michael',
        lastName: 'Estates',
        role: 'property_manager',
        kycStatus: 'approved',
        country: 'Nigeria',
        phoneNumber: '+234801987654',
        bio: 'Commercial real estate specialist in Lagos'
      },
      {
        email: 'grace.developments@example.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'Grace',
        lastName: 'Developments',
        role: 'property_manager',
        kycStatus: 'approved',
        country: 'Rwanda',
        phoneNumber: '+250788123456',
        bio: 'Sustainable development advocate in Kigali'
      },

      // Admin
      {
        email: 'admin@globalland.com',
        password: await bcrypt.hash('admin123', 10),
        firstName: 'Global',
        lastName: 'Admin',
        role: 'admin',
        kycStatus: 'approved',
        country: 'Kenya',
        phoneNumber: '+254700000000',
        bio: 'Platform administrator'
      }
    ]

    for (const userData of users) {
      const user: DemoUser = {
        id: uuidv4(),
        ...userData
      }
      this.demoUsers.push(user)
    }
  }

  /**
   * Create demo properties
   */
  private async createDemoProperties(): Promise<void> {
    const propertyManagers = this.demoUsers.filter(u => u.role === 'property_manager')

    const properties: Omit<DemoProperty, 'id' | 'createdAt'>[] = [
      // Nairobi Properties
      {
        name: 'Riverside Luxury Apartments',
        propertyType: 'residential',
        address: {
          addressLine1: '123 Riverside Drive',
          city: 'Nairobi',
          state: 'Nairobi County',
          country: 'Kenya',
          postalCode: '00100',
          coordinates: { lat: -1.2921, lng: 36.8219 }
        },
        totalValuation: 50000000, // 50M KES
        totalTokens: 50000,
        availableTokens: 35000,
        pricePerToken: 1000,
        expectedAnnualReturn: 0.12,
        description: 'Modern luxury apartment complex with stunning river views, located in the heart of Nairobi. Features state-of-the-art amenities and prime location near business district.',
        amenities: ['Swimming Pool', 'Gym', '24/7 Security', 'Parking', 'Generator Backup', 'High-Speed Internet'],
        images: ['/demo/images/riverside-apartments-1.jpg', '/demo/images/riverside-apartments-2.jpg'],
        documents: ['/demo/docs/riverside-title-deed.pdf', '/demo/docs/riverside-valuation.pdf'],
        managerId: propertyManagers[0].id,
        status: 'tokenized',
        tokenId: 'RLAP001',
        features: {
          size: 15000, // sq ft
          bedrooms: 120, // total units
          bathrooms: 180,
          parking: 150,
          yearBuilt: 2022,
          condition: 'excellent'
        },
        financials: {
          monthlyRent: 8500000, // 8.5M KES
          operatingExpenses: 2500000,
          netOperatingIncome: 6000000,
          capRate: 0.144,
          cashOnCashReturn: 0.12
        }
      },
      {
        name: 'Westlands Commercial Plaza',
        propertyType: 'commercial',
        address: {
          addressLine1: '456 Westlands Avenue',
          city: 'Nairobi',
          state: 'Nairobi County',
          country: 'Kenya',
          postalCode: '00600',
          coordinates: { lat: -1.2676, lng: 36.8108 }
        },
        totalValuation: 120000000, // 120M KES
        totalTokens: 120000,
        availableTokens: 80000,
        pricePerToken: 1000,
        expectedAnnualReturn: 0.10,
        description: 'Prime commercial office space in Westlands, Nairobi\'s business hub. Fully occupied with long-term corporate tenants.',
        amenities: ['Conference Rooms', 'High-Speed Internet', 'Parking', '24/7 Security', 'Cafeteria', 'Backup Power'],
        images: ['/demo/images/westlands-plaza-1.jpg', '/demo/images/westlands-plaza-2.jpg'],
        documents: ['/demo/docs/westlands-title-deed.pdf', '/demo/docs/westlands-lease-agreements.pdf'],
        managerId: propertyManagers[0].id,
        status: 'tokenized',
        tokenId: 'WLCP001',
        features: {
          size: 25000,
          yearBuilt: 2020,
          condition: 'excellent'
        },
        financials: {
          monthlyRent: 15000000, // 15M KES
          operatingExpenses: 3000000,
          netOperatingIncome: 12000000,
          capRate: 0.12,
          cashOnCashReturn: 0.10
        }
      },

      // Lagos Properties
      {
        name: 'Victoria Island Towers',
        propertyType: 'commercial',
        address: {
          addressLine1: '789 Ahmadu Bello Way',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria',
          postalCode: '101241',
          coordinates: { lat: 6.4281, lng: 3.4219 }
        },
        totalValuation: 2500000000, // 2.5B NGN
        totalTokens: 250000,
        availableTokens: 150000,
        pricePerToken: 10000, // NGN
        expectedAnnualReturn: 0.15,
        description: 'Prestigious office towers in Victoria Island, Lagos financial district. Premium location with multinational corporate tenants.',
        amenities: ['Executive Lounges', 'Helipad', 'Fine Dining', 'Valet Parking', 'Concierge', 'Smart Building Technology'],
        images: ['/demo/images/victoria-towers-1.jpg', '/demo/images/victoria-towers-2.jpg'],
        documents: ['/demo/docs/victoria-certificate-of-occupancy.pdf', '/demo/docs/victoria-environmental-clearance.pdf'],
        managerId: propertyManagers[1].id,
        status: 'tokenized',
        tokenId: 'VITO001',
        features: {
          size: 45000,
          yearBuilt: 2021,
          condition: 'excellent'
        },
        financials: {
          monthlyRent: 450000000, // 450M NGN
          operatingExpenses: 125000000,
          netOperatingIncome: 325000000,
          capRate: 0.156,
          cashOnCashReturn: 0.15
        }
      },
      {
        name: 'Lekki Gardens Estate',
        propertyType: 'residential',
        address: {
          addressLine1: 'Plot 15, Lekki-Epe Expressway',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria',
          postalCode: '105102',
          coordinates: { lat: 6.4698, lng: 3.5852 }
        },
        totalValuation: 1800000000, // 1.8B NGN
        totalTokens: 180000,
        availableTokens: 120000,
        pricePerToken: 10000,
        expectedAnnualReturn: 0.11,
        description: 'Luxury residential estate in Lekki with modern amenities and 24/7 security. Popular with expatriates and high-income professionals.',
        amenities: ['Golf Course', 'Club House', 'Swimming Pool', 'Tennis Court', 'Playground', 'Shopping Mall'],
        images: ['/demo/images/lekki-gardens-1.jpg', '/demo/images/lekki-gardens-2.jpg'],
        documents: ['/demo/docs/lekki-master-plan.pdf', '/demo/docs/lekki-infrastructure-report.pdf'],
        managerId: propertyManagers[1].id,
        status: 'active',
        features: {
          size: 35000,
          bedrooms: 200,
          bathrooms: 300,
          parking: 400,
          yearBuilt: 2023,
          condition: 'excellent'
        },
        financials: {
          monthlyRent: 220000000, // 220M NGN
          operatingExpenses: 55000000,
          netOperatingIncome: 165000000,
          capRate: 0.11,
          cashOnCashReturn: 0.11
        }
      },

      // Kigali Properties
      {
        name: 'Kigali Heights Business Center',
        propertyType: 'mixed_use',
        address: {
          addressLine1: 'KG 7 Ave, Nyarugenge',
          city: 'Kigali',
          state: 'Kigali City',
          country: 'Rwanda',
          postalCode: 'KG001',
          coordinates: { lat: -1.9441, lng: 30.0619 }
        },
        totalValuation: 8500000000, // 8.5B RWF
        totalTokens: 85000,
        availableTokens: 60000,
        pricePerToken: 100000, // RWF
        expectedAnnualReturn: 0.13,
        description: 'Modern mixed-use development in central Kigali featuring offices, retail spaces, and luxury apartments. Sustainable design with green building certification.',
        amenities: ['Solar Power', 'Rainwater Harvesting', 'EV Charging', 'Rooftop Garden', 'Co-working Spaces', 'Retail Mall'],
        images: ['/demo/images/kigali-heights-1.jpg', '/demo/images/kigali-heights-2.jpg'],
        documents: ['/demo/docs/kigali-green-certification.pdf', '/demo/docs/kigali-development-permit.pdf'],
        managerId: propertyManagers[2].id,
        status: 'tokenized',
        tokenId: 'KHBC001',
        features: {
          size: 28000,
          bedrooms: 80,
          bathrooms: 120,
          parking: 200,
          yearBuilt: 2023,
          condition: 'excellent'
        },
        financials: {
          monthlyRent: 1200000000, // 1.2B RWF
          operatingExpenses: 300000000,
          netOperatingIncome: 900000000,
          capRate: 0.127,
          cashOnCashReturn: 0.13
        }
      },

      // Kampala Properties
      {
        name: 'Nakasero Hill Residences',
        propertyType: 'residential',
        address: {
          addressLine1: 'Plot 25, Nakasero Hill',
          city: 'Kampala',
          state: 'Central Region',
          country: 'Uganda',
          postalCode: '256',
          coordinates: { lat: 0.3136, lng: 32.5811 }
        },
        totalValuation: 45000000000, // 45B UGX
        totalTokens: 45000,
        availableTokens: 30000,
        pricePerToken: 1000000, // UGX
        expectedAnnualReturn: 0.14,
        description: 'Exclusive hilltop residences with panoramic views of Kampala. Premium location near diplomatic quarter and business district.',
        amenities: ['Infinity Pool', 'Private Gardens', 'Concierge Service', 'Wine Cellar', 'Home Theater', 'Spa'],
        images: ['/demo/images/nakasero-hill-1.jpg', '/demo/images/nakasero-hill-2.jpg'],
        documents: ['/demo/docs/nakasero-land-title.pdf', '/demo/docs/nakasero-architectural-plans.pdf'],
        managerId: propertyManagers[0].id,
        status: 'active',
        features: {
          size: 20000,
          bedrooms: 60,
          bathrooms: 90,
          parking: 120,
          yearBuilt: 2022,
          condition: 'excellent'
        },
        financials: {
          monthlyRent: 6500000000, // 6.5B UGX
          operatingExpenses: 1500000000,
          netOperatingIncome: 5000000000,
          capRate: 0.133,
          cashOnCashReturn: 0.14
        }
      }
    ]

    for (const propertyData of properties) {
      const property: DemoProperty = {
        id: uuidv4(),
        createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date within last 90 days
        ...propertyData
      }
      this.demoProperties.push(property)
    }
  }

  /**
   * Create demo investments
   */
  private async createDemoInvestments(): Promise<void> {
    const investors = this.demoUsers.filter(u => u.role === 'investor')
    const tokenizedProperties = this.demoProperties.filter(p => p.status === 'tokenized')

    const investments: Omit<DemoInvestment, 'id'>[] = []

    // Create realistic investment patterns
    for (const investor of investors) {
      const numInvestments = Math.floor(Math.random() * 4) + 1 // 1-4 investments per investor

      for (let i = 0; i < numInvestments; i++) {
        const property = tokenizedProperties[Math.floor(Math.random() * tokenizedProperties.length)]
        const tokenAmount = Math.floor(Math.random() * 500) + 50 // 50-550 tokens
        const purchasePrice = tokenAmount * property.pricePerToken
        const daysAgo = Math.floor(Math.random() * 180) + 1 // 1-180 days ago
        const purchaseDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

        // Calculate current value with some appreciation
        const appreciationRate = 0.05 + Math.random() * 0.10 // 5-15% annual appreciation
        const timeHeld = daysAgo / 365
        const currentValue = purchasePrice * (1 + appreciationRate * timeHeld)

        // Calculate dividends received (monthly)
        const monthsHeld = Math.floor(daysAgo / 30)
        const monthlyDividendRate = property.expectedAnnualReturn / 12
        const dividendsReceived = purchasePrice * monthlyDividendRate * monthsHeld

        const totalReturn = (currentValue + dividendsReceived - purchasePrice) / purchasePrice

        investments.push({
          userId: investor.id,
          propertyId: property.id,
          tokenAmount,
          investmentValue: currentValue,
          purchasePrice,
          currentValue,
          status: 'active',
          purchaseDate,
          dividendsReceived,
          totalReturn
        })
      }
    }

    for (const investmentData of investments) {
      const investment: DemoInvestment = {
        id: uuidv4(),
        ...investmentData
      }
      this.demoInvestments.push(investment)
    }
  }

  /**
   * Create demo transactions
   */
  private async createDemoTransactions(): Promise<void> {
    const transactions: Omit<DemoTransaction, 'id'>[] = []

    // Create investment transactions
    for (const investment of this.demoInvestments) {
      transactions.push({
        userId: investment.userId,
        propertyId: investment.propertyId,
        type: 'investment',
        amount: investment.purchasePrice,
        currency: 'USD',
        status: 'completed',
        paymentMethod: Math.random() > 0.5 ? 'card' : 'mobile_money',
        description: `Investment in property tokens`,
        createdAt: investment.purchaseDate,
        completedAt: new Date(investment.purchaseDate.getTime() + Math.random() * 60 * 60 * 1000) // Completed within an hour
      })

      // Create dividend transactions
      const monthsHeld = Math.floor((Date.now() - investment.purchaseDate.getTime()) / (30 * 24 * 60 * 60 * 1000))
      for (let month = 1; month <= monthsHeld; month++) {
        const dividendDate = new Date(investment.purchaseDate.getTime() + month * 30 * 24 * 60 * 60 * 1000)
        const monthlyDividend = investment.dividendsReceived / monthsHeld

        transactions.push({
          userId: investment.userId,
          propertyId: investment.propertyId,
          type: 'dividend',
          amount: monthlyDividend,
          currency: 'USD',
          status: 'completed',
          paymentMethod: 'bank_transfer',
          description: `Monthly dividend payment`,
          createdAt: dividendDate,
          completedAt: new Date(dividendDate.getTime() + Math.random() * 24 * 60 * 60 * 1000)
        })
      }
    }

    // Add some platform fees
    for (const investment of this.demoInvestments) {
      if (Math.random() > 0.7) { // 30% chance of platform fee
        transactions.push({
          userId: investment.userId,
          type: 'fee',
          amount: investment.purchasePrice * 0.025, // 2.5% platform fee
          currency: 'USD',
          status: 'completed',
          paymentMethod: 'card',
          description: 'Platform transaction fee',
          createdAt: new Date(investment.purchaseDate.getTime() + 5 * 60 * 1000), // 5 minutes after investment
          completedAt: new Date(investment.purchaseDate.getTime() + 10 * 60 * 1000)
        })
      }
    }

    for (const transactionData of transactions) {
      const transaction: DemoTransaction = {
        id: uuidv4(),
        ...transactionData
      }
      this.demoTransactions.push(transaction)
    }
  }

  /**
   * Seed database with demo data
   */
  async seedDatabase(): Promise<void> {
    try {
      logger.info('Seeding database with demo data...');

      // Clear existing data
      await this.clearExistingData()

      // Seed users
      for (const user of this.demoUsers) {
        await UserModel.create({
          id: user.id,
          email: user.email,
          password: user.password,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          kycStatus: user.kycStatus,
          phoneNumber: user.phoneNumber,
          country: user.country,
          profileImage: user.profileImage,
          bio: user.bio,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }

      // Seed properties
      for (const property of this.demoProperties) {
        await PropertyModel.create({
          id: property.id,
          name: property.name,
          propertyType: property.propertyType,
          address: property.address,
          totalValuation: property.totalValuation,
          totalTokens: property.totalTokens,
          availableTokens: property.availableTokens,
          pricePerToken: property.pricePerToken,
          expectedAnnualReturn: property.expectedAnnualReturn,
          description: property.description,
          amenities: property.amenities,
          images: property.images,
          documents: property.documents,
          managerId: property.managerId,
          status: property.status,
          tokenId: property.tokenId,
          features: property.features,
          financials: property.financials,
          createdAt: property.createdAt,
          updatedAt: property.createdAt
        })
      }

      // Seed investments
      for (const investment of this.demoInvestments) {
        await InvestmentModel.create({
          id: investment.id,
          userId: investment.userId,
          propertyId: investment.propertyId,
          tokenAmount: investment.tokenAmount,
          investmentValue: investment.investmentValue,
          purchasePrice: investment.purchasePrice,
          currentValue: investment.currentValue,
          status: investment.status,
          purchaseDate: investment.purchaseDate,
          dividendsReceived: investment.dividendsReceived,
          totalReturn: investment.totalReturn,
          createdAt: investment.purchaseDate,
          updatedAt: new Date()
        })
      }

      // Seed transactions
      for (const transaction of this.demoTransactions) {
        await TransactionModel.create({
          id: transaction.id,
          userId: transaction.userId,
          propertyId: transaction.propertyId,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          paymentMethod: transaction.paymentMethod,
          description: transaction.description,
          createdAt: transaction.createdAt,
          completedAt: transaction.completedAt,
          updatedAt: transaction.completedAt || transaction.createdAt
        })
      }

      logger.info('Database seeded successfully with demo data', {
        users: this.demoUsers.length,
        properties: this.demoProperties.length,
        investments: this.demoInvestments.length,
        transactions: this.demoTransactions.length
      })
    } catch (error) {
      logger.error('Failed to seed database with demo data', error);
      throw error;
    }
  }

  /**
   * Clear existing demo data
   */
  private async clearExistingData(): Promise<void> {
    try {
      // Clear in reverse dependency order
      await TransactionModel.deleteMany({})
      await InvestmentModel.deleteMany({})
      await PropertyModel.deleteMany({})
      await UserModel.deleteMany({})

      logger.info('Existing demo data cleared');
    } catch (error) {
      logger.error('Failed to clear existing data', error);
      throw error;
    }
  }

  /**
   * Get demo data summary
   */
  getDemoDataSummary(): {
    users: { total: number; byRole: Record<string, number>; byCountry: Record<string, number> }
    properties: { total: number; byType: Record<string, number>; byCountry: Record<string, number>; totalValue: number }
    investments: { total: number; totalValue: number; averageInvestment: number }
    transactions: { total: number; totalVolume: number; byType: Record<string, number> }
  } {
    const usersByRole: Record<string, number> = {}
    const usersByCountry: Record<string, number> = {}
    this.demoUsers.forEach(user => {
      usersByRole[user.role] = (usersByRole[user.role] || 0) + 1
      usersByCountry[user.country] = (usersByCountry[user.country] || 0) + 1
    })

    const propertiesByType: Record<string, number> = {}
    const propertiesByCountry: Record<string, number> = {}
    let totalPropertyValue = 0
    this.demoProperties.forEach(property => {
      propertiesByType[property.propertyType] = (propertiesByType[property.propertyType] || 0) + 1
      propertiesByCountry[property.address.country] = (propertiesByCountry[property.address.country] || 0) + 1
      totalPropertyValue += property.totalValuation
    })

    const totalInvestmentValue = this.demoInvestments.reduce((sum, inv) => sum + inv.investmentValue, 0)
    const averageInvestment = this.demoInvestments.length > 0 ? totalInvestmentValue / this.demoInvestments.length : 0

    const transactionsByType: Record<string, number> = {}
    let totalTransactionVolume = 0
    this.demoTransactions.forEach(transaction => {
      transactionsByType[transaction.type] = (transactionsByType[transaction.type] || 0) + 1
      totalTransactionVolume += transaction.amount
    })

    return {
      users: {
        total: this.demoUsers.length,
        byRole: usersByRole,
        byCountry: usersByCountry
      },
      properties: {
        total: this.demoProperties.length,
        byType: propertiesByType,
        byCountry: propertiesByCountry,
        totalValue: totalPropertyValue
      },
      investments: {
        total: this.demoInvestments.length,
        totalValue: totalInvestmentValue,
        averageInvestment
      },
      transactions: {
        total: this.demoTransactions.length,
        totalVolume: totalTransactionVolume,
        byType: transactionsByType
      }
    }
  }

  /**
   * Get demo users
   */
  getDemoUsers(): DemoUser[] {
    return this.demoUsers
  }

  /**
   * Get demo properties
   */
  getDemoProperties(): DemoProperty[] {
    return this.demoProperties
  }

  /**
   * Get demo investments
   */
  getDemoInvestments(): DemoInvestment[] {
    return this.demoInvestments
  }

  /**
   * Get demo transactions
   */
  getDemoTransactions(): DemoTransaction[] {
    return this.demoTransactions
  }
}

export default new DemoDataService()