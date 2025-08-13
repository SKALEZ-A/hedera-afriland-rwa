import {
  Client,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenBurnTransaction,
  TokenAssociateTransaction,
  TransferTransaction,
  AccountBalanceQuery,
  TokenInfoQuery,

  TransactionReceipt,
  TransactionRecord,
  TokenId,
  AccountId,
  PrivateKey,
  Hbar,
  Status,

} from '@hashgraph/sdk';
import { getHederaClient } from '../config/hedera';
import { logger } from '../utils/logger';

export interface TokenCreationParams {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  treasuryAccountId: string;
  adminKey?: PrivateKey;
  supplyKey?: PrivateKey;
  freezeKey?: PrivateKey;
  wipeKey?: PrivateKey;
  kycKey?: PrivateKey;
  pauseKey?: PrivateKey;
  metadata?: string;
}

export interface TokenTransferParams {
  tokenId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  memo?: string;
}

export interface HederaTransactionResult {
  success: boolean;
  transactionId: string;
  receipt?: TransactionReceipt;
  record?: TransactionRecord;
  error?: string;
}

export class HederaService {
  private client: Client;
  private operatorAccountId: AccountId;
  private operatorPrivateKey: PrivateKey;

  constructor() {
    this.client = getHederaClient();
    this.operatorAccountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!);
    this.operatorPrivateKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!);
  }

  /**
   * Create a new fungible token for property tokenization
   */
  async createPropertyToken(params: TokenCreationParams): Promise<HederaTransactionResult> {
    try {
      logger.info(`Creating property token: ${params.name} (${params.symbol})`);

      const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName(params.name)
        .setTokenSymbol(params.symbol)
        .setDecimals(params.decimals)
        .setInitialSupply(params.initialSupply)
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Finite)
        .setMaxSupply(params.initialSupply)
        .setTreasuryAccountId(params.treasuryAccountId)
        .setAdminKey(params.adminKey || this.operatorPrivateKey)
        .setSupplyKey(params.supplyKey || this.operatorPrivateKey)
        .setFreezeDefault(false)
        .setTransactionMemo(`Property token creation: ${params.name}`)
        .freezeWith(this.client);

      // Add optional keys
      if (params.freezeKey) tokenCreateTx.setFreezeKey(params.freezeKey);
      if (params.wipeKey) tokenCreateTx.setWipeKey(params.wipeKey);
      if (params.kycKey) tokenCreateTx.setKycKey(params.kycKey);
      if (params.pauseKey) tokenCreateTx.setPauseKey(params.pauseKey);

      // Sign and submit transaction
      const signedTx = await tokenCreateTx.sign(this.operatorPrivateKey);
      const response = await signedTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Token creation failed with status: ${receipt.status}`);
      }

      const tokenId = receipt.tokenId!.toString();
      logger.info(`Property token created successfully: ${tokenId}`);

      return {
        success: true,
        transactionId: response.transactionId.toString(),
        receipt
      };
    } catch (error) {
      logger.error('Failed to create property token:', error);
      return {
        success: false,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Transfer tokens between accounts (overloaded method)
   */
  async transferTokens(tokenId: string, toAccountId: string, amount: number): Promise<HederaTransactionResult>;
  async transferTokens(params: TokenTransferParams): Promise<HederaTransactionResult>;
  async transferTokens(
    tokenIdOrParams: string | TokenTransferParams, 
    toAccountId?: string, 
    amount?: number
  ): Promise<HederaTransactionResult> {
    // Handle overloaded method signatures
    let params: TokenTransferParams;
    
    if (typeof tokenIdOrParams === 'string') {
      // Simple signature: transferTokens(tokenId, toAccountId, amount)
      params = {
        tokenId: tokenIdOrParams,
        fromAccountId: this.operatorAccountId.toString(),
        toAccountId: toAccountId!,
        amount: amount!,
        memo: 'Property token investment'
      };
    } else {
      // Full params signature
      params = tokenIdOrParams;
    }
    try {
      logger.info(`Transferring ${params.amount} tokens from ${params.fromAccountId} to ${params.toAccountId}`);

      const transferTx = new TransferTransaction()
        .addTokenTransfer(params.tokenId, params.fromAccountId, -params.amount)
        .addTokenTransfer(params.tokenId, params.toAccountId, params.amount)
        .setTransactionMemo(params.memo || 'Property token transfer')
        .freezeWith(this.client);

      const signedTx = await transferTx.sign(this.operatorPrivateKey);
      const response = await signedTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Token transfer failed with status: ${receipt.status}`);
      }

      logger.info(`Token transfer completed successfully: ${response.transactionId.toString()}`);

      return {
        success: true,
        transactionId: response.transactionId.toString(),
        receipt
      };
    } catch (error) {
      logger.error('Failed to transfer tokens:', error);
      return {
        success: false,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Associate a token with an account
   */
  async associateToken(accountId: string, tokenId: string, accountPrivateKey: PrivateKey): Promise<HederaTransactionResult> {
    try {
      logger.info(`Associating token ${tokenId} with account ${accountId}`);

      const associateTx = new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([tokenId])
        .freezeWith(this.client);

      const signedTx = await associateTx.sign(accountPrivateKey);
      const response = await signedTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Token association failed with status: ${receipt.status}`);
      }

      logger.info(`Token association completed successfully: ${response.transactionId.toString()}`);

      return {
        success: true,
        transactionId: response.transactionId.toString(),
        receipt
      };
    } catch (error) {
      logger.error('Failed to associate token:', error);
      return {
        success: false,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Mint additional tokens (for dividend distributions)
   */
  async mintTokens(tokenId: string, amount: number, memo?: string): Promise<HederaTransactionResult> {
    try {
      logger.info(`Minting ${amount} tokens for ${tokenId}`);

      const mintTx = new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(amount)
        .setTransactionMemo(memo || 'Token minting')
        .freezeWith(this.client);

      const signedTx = await mintTx.sign(this.operatorPrivateKey);
      const response = await signedTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Token minting failed with status: ${receipt.status}`);
      }

      logger.info(`Token minting completed successfully: ${response.transactionId.toString()}`);

      return {
        success: true,
        transactionId: response.transactionId.toString(),
        receipt
      };
    } catch (error) {
      logger.error('Failed to mint tokens:', error);
      return {
        success: false,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Burn tokens (for token buybacks)
   */
  async burnTokens(tokenId: string, amount: number, memo?: string): Promise<HederaTransactionResult> {
    try {
      logger.info(`Burning ${amount} tokens for ${tokenId}`);

      const burnTx = new TokenBurnTransaction()
        .setTokenId(tokenId)
        .setAmount(amount)
        .setTransactionMemo(memo || 'Token burning')
        .freezeWith(this.client);

      const signedTx = await burnTx.sign(this.operatorPrivateKey);
      const response = await signedTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Token burning failed with status: ${receipt.status}`);
      }

      logger.info(`Token burning completed successfully: ${response.transactionId.toString()}`);

      return {
        success: true,
        transactionId: response.transactionId.toString(),
        receipt
      };
    } catch (error) {
      logger.error('Failed to burn tokens:', error);
      return {
        success: false,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenId: string): Promise<any> {
    try {
      const tokenInfo = await new TokenInfoQuery()
        .setTokenId(tokenId)
        .execute(this.client);

      return {
        tokenId: tokenInfo.tokenId.toString(),
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        totalSupply: tokenInfo.totalSupply.toString(),
        treasuryAccountId: tokenInfo.treasuryAccountId?.toString() || '',
        adminKey: tokenInfo.adminKey?.toString(),
        supplyKey: tokenInfo.supplyKey?.toString(),
        freezeKey: tokenInfo.freezeKey?.toString(),
        wipeKey: tokenInfo.wipeKey?.toString(),
        kycKey: tokenInfo.kycKey?.toString(),
        pauseKey: tokenInfo.pauseKey?.toString(),
        deleted: tokenInfo.isDeleted,
        paused: tokenInfo.pauseStatus
      };
    } catch (error) {
      logger.error('Failed to get token info:', error);
      throw error;
    }
  }

  /**
   * Get account balance for a specific token
   */
  async getTokenBalance(accountId: string, tokenId: string): Promise<number> {
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(accountId)
        .execute(this.client);

      const tokenBalance = balance.tokens?.get(TokenId.fromString(tokenId));
      return tokenBalance ? parseInt(tokenBalance.toString(), 10) : 0;
    } catch (error) {
      logger.error('Failed to get token balance:', error);
      throw error;
    }
  }

  /**
   * Get account HBAR balance
   */
  async getHbarBalance(accountId: string): Promise<number> {
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(accountId)
        .execute(this.client);

      return balance.hbars.toTinybars().toNumber();
    } catch (error) {
      logger.error('Failed to get HBAR balance:', error);
      throw error;
    }
  }

  /**
   * Transfer HBAR between accounts
   */
  async transferHbar(fromAccountId: string, toAccountId: string, amount: number, memo?: string): Promise<HederaTransactionResult> {
    try {
      logger.info(`Transferring ${amount} HBAR from ${fromAccountId} to ${toAccountId}`);

      const transferTx = new TransferTransaction()
        .addHbarTransfer(fromAccountId, Hbar.fromTinybars(-amount))
        .addHbarTransfer(toAccountId, Hbar.fromTinybars(amount))
        .setTransactionMemo(memo || 'HBAR transfer')
        .freezeWith(this.client);

      const signedTx = await transferTx.sign(this.operatorPrivateKey);
      const response = await signedTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`HBAR transfer failed with status: ${receipt.status}`);
      }

      logger.info(`HBAR transfer completed successfully: ${response.transactionId.toString()}`);

      return {
        success: true,
        transactionId: response.transactionId.toString(),
        receipt
      };
    } catch (error) {
      logger.error('Failed to transfer HBAR:', error);
      return {
        success: false,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get transaction record
   */
  async getTransactionRecord(_transactionId: string): Promise<TransactionRecord | null> {
    try {
      // Note: getTransactionRecord method may not be available on all client versions
      // const record = await this.client.getTransactionRecord(transactionId);
      return null; // Placeholder for now
    } catch (error) {
      logger.error('Failed to get transaction record:', error);
      throw error;
    }
  }

  /**
   * Check if transaction was successful
   */
  async isTransactionSuccessful(transactionId: string): Promise<boolean> {
    try {
      const record = await this.getTransactionRecord(transactionId);
      return record?.receipt.status === Status.Success || false;
    } catch (error) {
      logger.error('Failed to check transaction status:', error);
      return false;
    }
  }

  /**
   * Get network status
   */
  async getNetworkStatus(): Promise<{
    connected: boolean;
    network: string;
    operatorBalance: number;
  }> {
    try {
      const balance = await this.getHbarBalance(this.operatorAccountId.toString());
      
      return {
        connected: true,
        network: process.env.HEDERA_NETWORK || 'testnet',
        operatorBalance: balance
      };
    } catch (error) {
      return {
        connected: false,
        network: process.env.HEDERA_NETWORK || 'testnet',
        operatorBalance: 0
      };
    }
  }

  /**
   * Close the client connection
   */
  close(): void {
    this.client.close();
  }
}