import { UserModel } from '../../models/UserModel';
import { PropertyModel } from '../../models/PropertyModel';
import { User, Property, PropertyType, UserKYCStatus } from '../../types/entities';
import jwt from 'jsonwebtoken';

const userModel = new UserModel();
const propertyModel = new PropertyModel();
const createdTestUsers: string[] = [];
const createdTestProperties: string[] = [];

export interface TestUserData {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  nationality?: string;
  role?: string;
  kycStatus?: UserKYCStatus;
}

export interface TestPropertyData {
  name?: string;
  description?: string;
  propertyType?: PropertyType;
  address?: {
    addressLine1: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  totalValuation?: number;
  totalTokens?: number;
  pricePerToken?: number;
  minimumInvestment?: number;
  expectedAnnualYield?: number;
  propertySize?: number;
  yearBuilt?: number;
  propertyManagerId?: string;
  managementFeePercentage?: number;
  platformFeePercentage?: number;
}

/**
 * Create a test user and track it for cleanup
 */
export async function createTestUser(userData: TestUserData): Promise<User> {
  const defaultUserData = {
    password: 'SecurePassword123!',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    nationality: 'USA',
    kycStatus: 'pending' as UserKYCStatus,
    ...userData
  };

  const user = await userModel.createUser(defaultUserData);
  createdTestUsers.push(user.id);
  return user;
}

/**
 * Create a test property and track it for cleanup
 */
export async function createTestProperty(propertyData: TestPropertyData = {}): Promise<Property> {
  const defaultPropertyData = {
    name: 'Test Property',
    description: 'A test property for integration tests',
    propertyType: 'residential' as PropertyType,
    address: {
      addressLine1: '123 Test Street',
      city: 'Test City',
      country: 'USA',
      postalCode: '12345'
    },
    totalValuation: 1000000,
    totalTokens: 10000,
    pricePerToken: 100,
    minimumInvestment: 100,
    expectedAnnualYield: 8.5,
    propertySize: 150,
    yearBuilt: 2020,
    managementFeePercentage: 1.5,
    platformFeePercentage: 2.5,
    ...propertyData
  };

  const property = await propertyModel.createProperty(defaultPropertyData);
  createdTestProperties.push(property.id);
  return property;
}

/**
 * Generate JWT token for test user
 */
export async function getAuthToken(email: string): Promise<string> {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw new Error(`Test user not found: ${email}`);
  }

  const payload = {
    userId: user.id,
    email: user.email,
    role: (user as any).role || 'user'
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '1h'
  });
}

/**
 * Clean up all test data created during tests
 */
export async function cleanupTestData(): Promise<void> {
  try {
    // Delete all created test properties first (due to foreign key constraints)
    for (const propertyId of createdTestProperties) {
      try {
        await propertyModel.deleteById(propertyId);
      } catch (error: any) {
        // Ignore errors during cleanup
        console.warn(`Failed to delete test property ${propertyId}:`, error.message);
      }
    }

    // Delete all created test users
    for (const userId of createdTestUsers) {
      try {
        await userModel.deleteById(userId);
      } catch (error: any) {
        // Ignore errors during cleanup
        console.warn(`Failed to delete test user ${userId}:`, error.message);
      }
    }
    
    // Clear the tracking arrays
    createdTestUsers.length = 0;
    createdTestProperties.length = 0;
  } catch (error: any) {
    console.warn('Error during test cleanup:', error.message);
  }
}

/**
 * Create multiple test users
 */
export async function createTestUsers(count: number): Promise<User[]> {
  const users: User[] = [];
  
  for (let i = 0; i < count; i++) {
    const userData: TestUserData = {
      email: `test${i}@example.com`,
      password: 'SecurePassword123!',
      firstName: `John${i}`,
      lastName: `Doe${i}`,
      phone: `+123456789${i}`,
      nationality: 'USA'
    };
    
    const user = await createTestUser(userData);
    users.push(user);
  }
  
  return users;
}

/**
 * Create multiple test properties
 */
export async function createTestProperties(count: number, propertyManagerId?: string): Promise<Property[]> {
  const properties: Property[] = [];
  
  for (let i = 0; i < count; i++) {
    const propertyData: TestPropertyData = {
      name: `Test Property ${i + 1}`,
      description: `Test property ${i + 1} for integration tests`,
      propertyType: i % 2 === 0 ? 'residential' : 'commercial',
      address: {
        addressLine1: `${100 + i} Test Street`,
        city: 'Test City',
        country: 'USA',
        postalCode: `1234${i}`
      },
      totalValuation: 1000000 + (i * 100000),
      totalTokens: 10000 + (i * 1000),
      pricePerToken: 100 + (i * 10),
      propertyManagerId
    };
    
    const property = await createTestProperty(propertyData);
    properties.push(property);
  }
  
  return properties;
}

/**
 * Generate random test data
 */
export function generateRandomUserData(): TestUserData {
  const randomId = Math.random().toString(36).substring(7);
  
  return {
    email: `test${randomId}@example.com`,
    password: 'SecurePassword123!',
    firstName: `John${randomId}`,
    lastName: `Doe${randomId}`,
    phone: `+1234567${randomId.substring(0, 3)}`,
    nationality: 'USA'
  };
}

/**
 * Wait for a specified amount of time (useful for rate limiting tests)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock file for testing file uploads
 */
export function createMockFile(
  filename: string = 'test-document.jpg',
  mimetype: string = 'image/jpeg',
  size: number = 1024
): Express.Multer.File {
  const buffer = Buffer.alloc(size, 'test-data');
  
  return {
    fieldname: 'documents',
    originalname: filename,
    encoding: '7bit',
    mimetype,
    size,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: null as any
  };
}

/**
 * Create test KYC documents
 */
export function createTestKYCDocuments() {
  return [
    {
      type: 'passport',
      documentNumber: 'P123456789',
      expiryDate: new Date('2030-12-31'),
      issueDate: new Date('2020-01-01'),
      issuingCountry: 'USA'
    },
    {
      type: 'utility_bill',
      documentNumber: undefined,
      expiryDate: undefined,
      issueDate: new Date('2023-01-01'),
      issuingCountry: 'USA'
    }
  ];
}

/**
 * Assert that an object has the expected properties
 */
export function assertObjectHasProperties(obj: any, properties: string[]): void {
  for (const prop of properties) {
    if (!(prop in obj)) {
      throw new Error(`Expected object to have property: ${prop}`);
    }
  }
}

/**
 * Assert that a response has the expected structure
 */
export function assertSuccessResponse(response: any, expectedData?: any): void {
  expect(response.body).toHaveProperty('success', true);
  
  if (expectedData) {
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toMatchObject(expectedData);
  }
}

/**
 * Assert that a response has error structure
 */
export function assertErrorResponse(response: any, expectedError?: string): void {
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
  
  if (expectedError) {
    expect(response.body.error).toContain(expectedError);
  }
}