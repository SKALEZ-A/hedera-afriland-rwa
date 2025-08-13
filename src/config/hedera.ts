import { Client, AccountId, PrivateKey, Hbar, AccountBalanceQuery } from '@hashgraph/sdk';
import { logger } from '../utils/logger';

let hederaClient: Client;

export async function initializeHedera(): Promise<void> {
  try {
    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    const network = process.env.HEDERA_NETWORK || 'testnet';

    if (!accountId || !privateKey) {
      throw new Error('Hedera account ID and private key must be provided');
    }

    // Create Hedera client
    if (network === 'mainnet') {
      hederaClient = Client.forMainnet();
    } else {
      hederaClient = Client.forTestnet();
    }

    // Set operator account
    hederaClient.setOperator(
      AccountId.fromString(accountId),
      PrivateKey.fromString(privateKey)
    );

    // Set default max transaction fee and max query payment
    hederaClient.setDefaultMaxTransactionFee(new Hbar(100));
    hederaClient.setDefaultMaxQueryPayment(new Hbar(50));

    // Test the connection by getting account balance
    const balanceQuery = new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(accountId));
    const accountBalance = await balanceQuery.execute(hederaClient);
    
    logger.info(`Hedera client initialized successfully`);
    logger.info(`Network: ${network}`);
    logger.info(`Account ID: ${accountId}`);
    logger.info(`Account Balance: ${accountBalance.hbars.toString()}`);
    
  } catch (error) {
    logger.error('Failed to initialize Hedera client:', error);
    throw error;
  }
}

export function getHederaClient(): Client {
  if (!hederaClient) {
    throw new Error('Hedera client not initialized. Call initializeHedera() first.');
  }
  return hederaClient;
}

export function closeHedera(): void {
  if (hederaClient) {
    hederaClient.close();
    logger.info('Hedera client closed');
  }
}