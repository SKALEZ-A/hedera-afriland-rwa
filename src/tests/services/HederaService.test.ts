import { HederaService, TokenCreationParams } from '../../services/HederaService';
import { BlockchainUtils } from '../../utils/blockchain';
import { PrivateKey } from '@hashgraph/sdk';

// Mock Hedera SDK
jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn(() => ({
      setOperator: jest.fn(),
      setDefaultMaxTransactionFee: jest.fn(),
      setDefaultMaxQueryPayment: jest.fn(),
      close: jest.fn()
    }))
  },
  TokenCreateTransaction: jest.fn(() => ({
    setTokenName: jest.fn().mockReturnThis(),
    setTokenSymbol: jest.fn().mockReturnThis(),
    setDecimals: jest.fn().mockReturnThis(),
    setInitialSupply: jest.fn().mockReturnThis(),
    setTokenType: jest.fn().mockReturnThis(),
    setSupplyType: jest.fn().mockReturnThis(),
    setMaxSupply: jest.fn().mockReturnThis(),
    setTreasuryAccountId: jest.fn().mockReturnThis(),
    setAdminKey: jest.fn().mockReturnThis(),
    setSupplyKey: jest.fn().mockReturnThis(),
    setFreezeDefault: jest.fn().mockReturnThis(),
    setTransactionMemo: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue({
      execute: jest.fn().mockResolvedValue({
        transactionId: { toString: () => 'test-tx-id' },
        getReceipt: jest.fn().mockResolvedValue({
          status: { toString: () => 'SUCCESS' },
          tokenId: { toString: () => '0.0.123456' }
        })
      })
    })
  })),
  TransferTransaction: jest.fn(() => ({
    addTokenTransfer: jest.fn().mockReturnThis(),
    setTransactionMemo: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue({
      execute: jest.fn().mockResolvedValue({
        transactionId: { toString: () => 'test-transfer-tx-id' },
        getReceipt: jest.fn().mockResolvedValue({
          status: { toString: () => 'SUCCESS' }
        })
      })
    })
  })),
  TokenAssociateTransaction: jest.fn(() => ({
    setAccountId: jest.fn().mockReturnThis(),
    setTokenIds: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue({
      execute: jest.fn().mockResolvedValue({
        transactionId: { toString: () => 'test-associate-tx-id' },
        getReceipt: jest.fn().mockResolvedValue({
          status: { toString: () => 'SUCCESS' }
        })
      })
    })
  })),
  AccountBalanceQuery: jest.fn(() => ({
    setAccountId: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      hbars: { toTinybars: () => ({ toNumber: () => 1000000000 }) },
      tokens: new Map([['0.0.123456', 1000]])
    })
  })),
  TokenInfoQuery: jest.fn(() => ({
    setTokenId: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      tokenId: { toString: () => '0.0.123456' },
      name: 'Test Property Token',
      symbol: 'TPT',
      decimals: 0,
      totalSupply: { toString: () => '1000' },
      treasuryAccountId: { toString: () => '0.0.123' },
      adminKey: { toString: () => 'admin-key' },
      supplyKey: { toString: () => 'supply-key' },
      isDeleted: false,
      pauseStatus: false
    })
  })),
  AccountId: {
    fromString: jest.fn((id) => ({ toString: () => id }))
  },
  TokenId: {
    fromString: jest.fn((id) => ({ toString: () => id }))
  },
  PrivateKey: {
    fromString: jest.fn((key) => ({ toString: () => key })),
    generateED25519: jest.fn(() => ({
      toString: () => 'generated-private-key',
      publicKey: { toString: () => 'generated-public-key' }
    }))
  },
  Hbar: {
    fromTinybars: jest.fn((amount) => ({ toString: () => amount.toString() }))
  },
  Status: {
    Success: { toString: () => 'SUCCESS' }
  },
  TokenType: {
    FungibleCommon: 'FUNGIBLE_COMMON'
  },
  TokenSupplyType: {
    Finite: 'FINITE'
  }
}));

// Mock environment variables
process.env.HEDERA_ACCOUNT_ID = '0.0.123';
process.env.HEDERA_PRIVATE_KEY = 'test-private-key';
process.env.HEDERA_NETWORK = 'testnet';

describe('HederaService', () => {
  let hederaService: HederaService;

  beforeEach(() => {
    jest.clearAllMocks();
    hederaService = new HederaService();
  });

  afterEach(() => {
    hederaService.close();
  });

  describe('createPropertyToken', () => {
    it('should create a property token successfully', async () => {
      const tokenParams: TokenCreationParams = {
        name: 'Test Property Token',
        symbol: 'TPT',
        decimals: 0,
        initialSupply: 1000,
        treasuryAccountId: '0.0.123',
        adminKey: PrivateKey.fromString('test-admin-key'),
        supplyKey: PrivateKey.fromString('test-supply-key')
      };

      const result = await hederaService.createPropertyToken(tokenParams);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('test-tx-id');
      expect(result.receipt).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle token creation failure', async () => {
      // Mock a failed transaction
      const mockExecute = jest.fn().mockResolvedValue({
        transactionId: { toString: () => 'failed-tx-id' },
        getReceipt: jest.fn().mockResolvedValue({
          status: { toString: () => 'FAILED' }
        })
      });

      const mockSign = jest.fn().mockResolvedValue({
        execute: mockExecute
      });

      const mockTokenCreateTx = {
        setTokenName: jest.fn().mockReturnThis(),
        setTokenSymbol: jest.fn().mockReturnThis(),
        setDecimals: jest.fn().mockReturnThis(),
        setInitialSupply: jest.fn().mockReturnThis(),
        setTokenType: jest.fn().mockReturnThis(),
        setSupplyType: jest.fn().mockReturnThis(),
        setMaxSupply: jest.fn().mockReturnThis(),
        setTreasuryAccountId: jest.fn().mockReturnThis(),
        setAdminKey: jest.fn().mockReturnThis(),
        setSupplyKey: jest.fn().mockReturnThis(),
        setFreezeDefault: jest.fn().mockReturnThis(),
        setTransactionMemo: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        sign: mockSign
      };

      const { TokenCreateTransaction } = require('@hashgraph/sdk');
      TokenCreateTransaction.mockImplementation(() => mockTokenCreateTx);

      const tokenParams: TokenCreationParams = {
        name: 'Failed Token',
        symbol: 'FAIL',
        decimals: 0,
        initialSupply: 1000,
        treasuryAccountId: '0.0.123'
      };

      const result = await hederaService.createPropertyToken(tokenParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token creation failed with status');
    });
  });

  describe('transferTokens', () => {
    it('should transfer tokens successfully', async () => {
      const transferParams = {
        tokenId: '0.0.123456',
        fromAccountId: '0.0.123',
        toAccountId: '0.0.124',
        amount: 100,
        memo: 'Test transfer'
      };

      const result = await hederaService.transferTokens(transferParams);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('test-transfer-tx-id');
      expect(result.error).toBeUndefined();
    });
  });

  describe('getTokenInfo', () => {
    it('should retrieve token information', async () => {
      const tokenInfo = await hederaService.getTokenInfo('0.0.123456');

      expect(tokenInfo).toEqual({
        tokenId: '0.0.123456',
        name: 'Test Property Token',
        symbol: 'TPT',
        decimals: 0,
        totalSupply: '1000',
        treasuryAccountId: '0.0.123',
        adminKey: 'admin-key',
        supplyKey: 'supply-key',
        freezeKey: undefined,
        wipeKey: undefined,
        kycKey: undefined,
        pauseKey: undefined,
        deleted: false,
        paused: false
      });
    });
  });

  describe('getTokenBalance', () => {
    it('should retrieve token balance for an account', async () => {
      const balance = await hederaService.getTokenBalance('0.0.123', '0.0.123456');
      expect(balance).toBe(1000);
    });

    it('should return 0 for non-existent token', async () => {
      const { AccountBalanceQuery } = require('@hashgraph/sdk');
      AccountBalanceQuery.mockImplementation(() => ({
        setAccountId: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          hbars: { toTinybars: () => ({ toNumber: () => 1000000000 }) },
          tokens: new Map() // Empty map
        })
      }));

      const balance = await hederaService.getTokenBalance('0.0.123', '0.0.999999');
      expect(balance).toBe(0);
    });
  });

  describe('getHbarBalance', () => {
    it('should retrieve HBAR balance for an account', async () => {
      const balance = await hederaService.getHbarBalance('0.0.123');
      expect(balance).toBe(1000000000); // 10 HBAR in tinybars
    });
  });

  describe('getNetworkStatus', () => {
    it('should return network status when connected', async () => {
      const status = await hederaService.getNetworkStatus();

      expect(status).toEqual({
        connected: true,
        network: 'testnet',
        operatorBalance: 1000000000
      });
    });

    it('should return disconnected status on error', async () => {
      const { AccountBalanceQuery } = require('@hashgraph/sdk');
      AccountBalanceQuery.mockImplementation(() => ({
        setAccountId: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Network error'))
      }));

      const status = await hederaService.getNetworkStatus();

      expect(status).toEqual({
        connected: false,
        network: 'testnet',
        operatorBalance: 0
      });
    });
  });
});

describe('BlockchainUtils', () => {
  describe('generateKeyPair', () => {
    it('should generate a valid key pair', () => {
      const keyPair = BlockchainUtils.generateKeyPair();

      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey).toBe('generated-public-key');
    });
  });

  describe('validation methods', () => {
    it('should validate account ID format', () => {
      expect(BlockchainUtils.isValidAccountId('0.0.123')).toBe(true);
      expect(BlockchainUtils.isValidAccountId('invalid')).toBe(false);
    });

    it('should validate token ID format', () => {
      expect(BlockchainUtils.isValidTokenId('0.0.123456')).toBe(true);
      expect(BlockchainUtils.isValidTokenId('invalid')).toBe(false);
    });

    it('should validate private key format', () => {
      expect(BlockchainUtils.isValidPrivateKey('test-private-key')).toBe(true);
      expect(BlockchainUtils.isValidPrivateKey('invalid')).toBe(false);
    });
  });

  describe('conversion methods', () => {
    it('should convert HBAR to tinybars', () => {
      expect(BlockchainUtils.hbarToTinybars(1)).toBe(100_000_000);
      expect(BlockchainUtils.hbarToTinybars(0.5)).toBe(50_000_000);
    });

    it('should convert tinybars to HBAR', () => {
      expect(BlockchainUtils.tinybarsToHbar(100_000_000)).toBe(1);
      expect(BlockchainUtils.tinybarsToHbar(50_000_000)).toBe(0.5);
    });

    it('should format token amounts', () => {
      expect(BlockchainUtils.formatTokenAmount(1000, 2)).toBe('10.00');
      expect(BlockchainUtils.formatTokenAmount(1500, 3)).toBe('1.500');
    });

    it('should parse token amounts', () => {
      expect(BlockchainUtils.parseTokenAmount('10.00', 2)).toBe(1000);
      expect(BlockchainUtils.parseTokenAmount('1.500', 3)).toBe(1500);
    });
  });

  describe('generateTokenSymbol', () => {
    it('should generate valid token symbol', () => {
      const symbol = BlockchainUtils.generateTokenSymbol('Lagos Premium Apartments', 'prop-123-456-789');
      expect(symbol).toBe('LAG6789');
    });

    it('should handle special characters in property name', () => {
      const symbol = BlockchainUtils.generateTokenSymbol('Cape Town & Waterfront!', 'prop-abc-def-xyz');
      expect(symbol).toBe('CAPFXYZ');
    });
  });

  describe('fee calculations', () => {
    it('should calculate platform fee correctly', () => {
      expect(BlockchainUtils.calculatePlatformFee(1000, 2.5)).toBe(25);
      expect(BlockchainUtils.calculatePlatformFee(500, 1.0)).toBe(5);
    });

    it('should calculate management fee correctly', () => {
      expect(BlockchainUtils.calculateManagementFee(10000, 1.5)).toBe(150);
      expect(BlockchainUtils.calculateManagementFee(2000, 0.5)).toBe(10);
    });
  });

  describe('retryOperation', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await BlockchainUtils.retryOperation(operation, 3, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');

      const result = await BlockchainUtils.retryOperation(operation, 3, 10);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(
        BlockchainUtils.retryOperation(operation, 2, 10)
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('transaction memo', () => {
    it('should create transaction memo with metadata', () => {
      const memo = BlockchainUtils.createTransactionMemo(
        'investment',
        'prop-123',
        'user-456',
        { amount: 1000 }
      );

      const parsed = JSON.parse(memo);
      expect(parsed.type).toBe('investment');
      expect(parsed.propertyId).toBe('prop-123');
      expect(parsed.userId).toBe('user-456');
      expect(parsed.amount).toBe(1000);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should truncate long memos', () => {
      const longData = { description: 'a'.repeat(200) };
      const memo = BlockchainUtils.createTransactionMemo('test', 'prop', 'user', longData);

      expect(memo.length).toBeLessThanOrEqual(100);
      expect(memo.endsWith('...')).toBe(true);
    });

    it('should parse transaction memo', () => {
      const originalMemo = { type: 'test', amount: 100 };
      const memoString = JSON.stringify(originalMemo);
      const parsed = BlockchainUtils.parseTransactionMemo(memoString);

      expect(parsed).toEqual(originalMemo);
    });

    it('should return null for invalid memo', () => {
      const parsed = BlockchainUtils.parseTransactionMemo('invalid json');
      expect(parsed).toBeNull();
    });
  });
});