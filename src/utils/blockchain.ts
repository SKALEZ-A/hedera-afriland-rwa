import { PrivateKey, AccountId, TokenId } from '@hashgraph/sdk';
import { HederaService } from '../services/HederaService';
import { logger } from './logger';

export class BlockchainUtils {
  private static hederaService: HederaService;

  static initialize() {
    BlockchainUtils.hederaService = new HederaService();
  }

  /**
   * Generate a new Hedera account key pair
   */
  static generateKeyPair(): { privateKey: PrivateKey; publicKey: string; accountId?: string } {
    const privateKey = PrivateKey.generateED25519();
    const publicKey = privateKey.publicKey.toString();

    return {
      privateKey,
      publicKey
    };
  }

  /**
   * Validate Hedera account ID format
   */
  static isValidAccountId(accountId: string): boolean {
    try {
      AccountId.fromString(accountId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate Hedera token ID format
   */
  static isValidTokenId(tokenId: string): boolean {
    try {
      TokenId.fromString(tokenId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate private key format
   */
  static isValidPrivateKey(privateKey: string): boolean {
    try {
      PrivateKey.fromString(privateKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert HBAR to tinybars
   */
  static hbarToTinybars(hbar: number): number {
    return Math.floor(hbar * 100_000_000); // 1 HBAR = 100,000,000 tinybars
  }

  /**
   * Convert tinybars to HBAR
   */
  static tinybarsToHbar(tinybars: number): number {
    return tinybars / 100_000_000;
  }

  /**
   * Format token amount with decimals
   */
  static formatTokenAmount(amount: number, decimals: number): string {
    const divisor = Math.pow(10, decimals);
    return (amount / divisor).toFixed(decimals);
  }

  /**
   * Parse token amount from formatted string
   */
  static parseTokenAmount(formattedAmount: string, decimals: number): number {
    const multiplier = Math.pow(10, decimals);
    return Math.floor(parseFloat(formattedAmount) * multiplier);
  }

  /**
   * Generate property token symbol from property name
   */
  static generateTokenSymbol(propertyName: string, propertyId: string): string {
    // Take first 3 characters of property name and last 4 characters of property ID
    const namePrefix = propertyName.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
    const idSuffix = propertyId.slice(-4).toUpperCase();
    return `${namePrefix}${idSuffix}`;
  }

  /**
   * Calculate platform fee
   */
  static calculatePlatformFee(amount: number, feePercentage: number): number {
    return Math.floor((amount * feePercentage) / 100);
  }

  /**
   * Calculate management fee
   */
  static calculateManagementFee(amount: number, feePercentage: number): number {
    return Math.floor((amount * feePercentage) / 100);
  }

  /**
   * Retry blockchain operation with exponential backoff
   */
  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`Blockchain operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, lastError.message);
        
        await BlockchainUtils.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Delay execution for specified milliseconds
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'BUSY',
      'TIMEOUT',
      'NETWORK',
      'CONNECTION',
      'UNAVAILABLE',
      'RATE_LIMIT'
    ];

    return retryableMessages.some(msg => 
      error.message.toUpperCase().includes(msg)
    );
  }

  /**
   * Get transaction fee estimate
   */
  static estimateTransactionFee(transactionType: 'token_create' | 'token_transfer' | 'hbar_transfer'): number {
    // Estimated fees in tinybars based on Hedera pricing
    const feeEstimates = {
      token_create: 100_000_000, // ~1 HBAR
      token_transfer: 1_000_000,  // ~0.01 HBAR
      hbar_transfer: 100_000      // ~0.001 HBAR
    };

    return feeEstimates[transactionType] || 1_000_000;
  }

  /**
   * Validate sufficient balance for transaction
   */
  static async validateSufficientBalance(
    accountId: string,
    requiredAmount: number,
    tokenId?: string
  ): Promise<{ sufficient: boolean; currentBalance: number }> {
    try {
      let currentBalance: number;

      if (tokenId) {
        currentBalance = await BlockchainUtils.hederaService.getTokenBalance(accountId, tokenId);
      } else {
        currentBalance = await BlockchainUtils.hederaService.getHbarBalance(accountId);
      }

      return {
        sufficient: currentBalance >= requiredAmount,
        currentBalance
      };
    } catch (error) {
      logger.error('Failed to validate balance:', error);
      return {
        sufficient: false,
        currentBalance: 0
      };
    }
  }

  /**
   * Create transaction memo with metadata
   */
  static createTransactionMemo(
    type: string,
    propertyId?: string,
    userId?: string,
    additionalData?: Record<string, any>
  ): string {
    const memo = {
      type,
      propertyId,
      userId,
      timestamp: Date.now(),
      ...additionalData
    };

    // Hedera memo limit is 100 bytes
    const memoString = JSON.stringify(memo);
    return memoString.length > 100 ? memoString.substring(0, 97) + '...' : memoString;
  }

  /**
   * Parse transaction memo
   */
  static parseTransactionMemo(memo: string): Record<string, any> | null {
    try {
      return JSON.parse(memo);
    } catch {
      return null;
    }
  }

  /**
   * Get Hedera service instance
   */
  static getHederaService(): HederaService {
    if (!BlockchainUtils.hederaService) {
      BlockchainUtils.initialize();
    }
    return BlockchainUtils.hederaService;
  }

  /**
   * Close blockchain connections
   */
  static close(): void {
    if (BlockchainUtils.hederaService) {
      BlockchainUtils.hederaService.close();
    }
  }
}