import { BaseModel } from './BaseModel';
import { User, UserKYCStatus, UserVerificationLevel } from '../types/entities';
import bcrypt from 'bcryptjs';

export class UserModel extends BaseModel {
  constructor() {
    super('users');
  }

  /**
   * Create a new user with hashed password
   */
  async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    dateOfBirth?: Date;
    nationality?: string;
  }): Promise<User> {
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    const userToCreate = {
      email: userData.email.toLowerCase(),
      password_hash: passwordHash,
      first_name: userData.firstName,
      last_name: userData.lastName,
      phone: userData.phone,
      date_of_birth: userData.dateOfBirth,
      nationality: userData.nationality,
    };

    const user = await this.create<User>(userToCreate);
    return this.mapDatabaseUser(user);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.query<any>(query, [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDatabaseUser(result.rows[0]);
  }

  /**
   * Find user by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE wallet_address = $1';
    const result = await this.query<any>(query, [walletAddress]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDatabaseUser(result.rows[0]);
  }

  /**
   * Verify user password
   */
  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  /**
   * Update user KYC status
   */
  async updateKYCStatus(
    userId: string, 
    status: UserKYCStatus,
    provider?: string,
    reference?: string
  ): Promise<User | null> {
    const updateData: any = {
      kyc_status: status,
    };

    if (provider) updateData.kyc_provider = provider;
    if (reference) updateData.kyc_reference = reference;
    if (status === 'approved') updateData.kyc_completed_at = new Date();

    const result = await this.updateById(userId, updateData);
    return result ? this.mapDatabaseUser(result) : null;
  }

  /**
   * Update user verification level
   */
  async updateVerificationLevel(
    userId: string, 
    level: UserVerificationLevel
  ): Promise<User | null> {
    const result = await this.updateById(userId, { verification_level: level });
    return result ? this.mapDatabaseUser(result) : null;
  }

  /**
   * Set user wallet address
   */
  async setWalletAddress(userId: string, walletAddress: string): Promise<User | null> {
    const result = await this.updateById(userId, { wallet_address: walletAddress });
    return result ? this.mapDatabaseUser(result) : null;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.updateById(userId, { last_login: new Date() });
  }

  /**
   * Get users by KYC status
   */
  async getUsersByKYCStatus(status: UserKYCStatus): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE kyc_status = $1 ORDER BY created_at DESC';
    const result = await this.query<any>(query, [status]);
    return result.rows.map(row => this.mapDatabaseUser(row));
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await this.updateById(userId, { password_hash: passwordHash });
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    kycPendingUsers: number;
    activeUsers: number; // Users who logged in within last 30 days
  }> {
    const queries = [
      'SELECT COUNT(*) as total FROM users',
      'SELECT COUNT(*) as verified FROM users WHERE kyc_status = $1',
      'SELECT COUNT(*) as pending FROM users WHERE kyc_status = $2',
      'SELECT COUNT(*) as active FROM users WHERE last_login > $3'
    ];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalResult, verifiedResult, pendingResult, activeResult] = await Promise.all([
      this.query<{ total: string }>(queries[0]),
      this.query<{ verified: string }>(queries[1], ['approved']),
      this.query<{ pending: string }>(queries[2], ['pending']),
      this.query<{ active: string }>(queries[3], [thirtyDaysAgo])
    ]);

    return {
      totalUsers: parseInt(totalResult.rows[0].total, 10),
      verifiedUsers: parseInt(verifiedResult.rows[0].verified, 10),
      kycPendingUsers: parseInt(pendingResult.rows[0].pending, 10),
      activeUsers: parseInt(activeResult.rows[0].active, 10)
    };
  }

  /**
   * Map database row to User entity
   */
  private mapDatabaseUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      nationality: row.nationality,
      walletAddress: row.wallet_address,
      kycStatus: row.kyc_status,
      verificationLevel: row.verification_level,
      kycProvider: row.kyc_provider,
      kycReference: row.kyc_reference,
      kycCompletedAt: row.kyc_completed_at,
      isAccreditedInvestor: row.is_accredited_investor,
      emailVerified: row.email_verified,
      phoneVerified: row.phone_verified,
      twoFactorEnabled: row.two_factor_enabled,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}