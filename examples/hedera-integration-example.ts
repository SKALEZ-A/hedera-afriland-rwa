/**
 * Hedera Integration Example
 * 
 * This file demonstrates how to use the Hedera blockchain integration
 * for property tokenization in the GlobalLand platform.
 */

import { HederaService } from '../src/services/HederaService';
import { PropertyTokenizationService } from '../src/services/PropertyTokenizationService';
import { BlockchainUtils } from '../src/utils/blockchain';
import { HederaHealthMonitor } from '../src/utils/hederaHealth';
import { PrivateKey } from '@hashgraph/sdk';

async function demonstrateHederaIntegration() {
  console.log('🚀 GlobalLand Hedera Integration Demo\n');

  // Initialize services
  const hederaService = new HederaService();
  const tokenizationService = new PropertyTokenizationService();
  const healthMonitor = HederaHealthMonitor.getInstance();

  try {
    // 1. Check Hedera network health
    console.log('1. Checking Hedera network health...');
    const healthStatus = await healthMonitor.performHealthCheck();
    console.log(`   Status: ${healthStatus.status}`);
    console.log(`   Network: ${healthStatus.network}`);
    console.log(`   Operator Balance: ${healthStatus.operatorBalanceHbar} HBAR`);
    console.log(`   Response Time: ${healthStatus.responseTime}ms\n`);

    if (healthStatus.status === 'unhealthy') {
      console.log('❌ Network is unhealthy, aborting demo');
      return;
    }

    // 2. Demonstrate key generation
    console.log('2. Generating new account keys...');
    const keyPair = BlockchainUtils.generateKeyPair();
    console.log(`   Private Key: ${keyPair.privateKey.toString().substring(0, 20)}...`);
    console.log(`   Public Key: ${keyPair.publicKey.substring(0, 20)}...\n`);

    // 3. Create a property token
    console.log('3. Creating property token...');
    const tokenParams = {
      name: 'Lagos Premium Apartments Token',
      symbol: 'LAPAT',
      decimals: 0,
      initialSupply: 50000,
      treasuryAccountId: process.env.HEDERA_ACCOUNT_ID!,
      adminKey: PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!),
      supplyKey: PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!),
      metadata: JSON.stringify({
        propertyType: 'residential',
        location: 'Lagos, Nigeria',
        valuation: 5000000,
        expectedYield: 12.5
      })
    };

    const tokenResult = await hederaService.createPropertyToken(tokenParams);
    
    if (tokenResult.success && tokenResult.receipt?.tokenId) {
      const tokenId = tokenResult.receipt.tokenId.toString();
      console.log(`   ✅ Token created successfully!`);
      console.log(`   Token ID: ${tokenId}`);
      console.log(`   Transaction ID: ${tokenResult.transactionId}\n`);

      // 4. Get token information
      console.log('4. Retrieving token information...');
      const tokenInfo = await hederaService.getTokenInfo(tokenId);
      console.log(`   Name: ${tokenInfo.name}`);
      console.log(`   Symbol: ${tokenInfo.symbol}`);
      console.log(`   Total Supply: ${tokenInfo.totalSupply}`);
      console.log(`   Treasury Account: ${tokenInfo.treasuryAccountId}\n`);

      // 5. Check token balance
      console.log('5. Checking token balance...');
      const balance = await hederaService.getTokenBalance(
        process.env.HEDERA_ACCOUNT_ID!,
        tokenId
      );
      console.log(`   Treasury Balance: ${balance} tokens\n`);

      // 6. Demonstrate utility functions
      console.log('6. Demonstrating utility functions...');
      
      // Token symbol generation
      const generatedSymbol = BlockchainUtils.generateTokenSymbol(
        'Cape Town Waterfront',
        'prop-abc-def-xyz'
      );
      console.log(`   Generated Symbol: ${generatedSymbol}`);

      // Fee calculations
      const platformFee = BlockchainUtils.calculatePlatformFee(10000, 2.5);
      const managementFee = BlockchainUtils.calculateManagementFee(10000, 1.0);
      console.log(`   Platform Fee (2.5%): ${platformFee}`);
      console.log(`   Management Fee (1.0%): ${managementFee}`);

      // Currency conversions
      const hbarAmount = 5;
      const tinybars = BlockchainUtils.hbarToTinybars(hbarAmount);
      const backToHbar = BlockchainUtils.tinybarsToHbar(tinybars);
      console.log(`   ${hbarAmount} HBAR = ${tinybars} tinybars = ${backToHbar} HBAR\n`);

      // 7. Demonstrate transaction memo
      console.log('7. Creating transaction memo...');
      const memo = BlockchainUtils.createTransactionMemo(
        'property_investment',
        'prop-123',
        'user-456',
        { amount: 1000, currency: 'USD' }
      );
      console.log(`   Memo: ${memo}`);
      
      const parsedMemo = BlockchainUtils.parseTransactionMemo(memo);
      console.log(`   Parsed Type: ${parsedMemo?.type}\n`);

      // 8. Demonstrate retry mechanism
      console.log('8. Testing retry mechanism...');
      let attemptCount = 0;
      const flakyOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Simulated network error');
        }
        return 'Success after retries';
      };

      const retryResult = await BlockchainUtils.retryOperation(flakyOperation, 3, 100);
      console.log(`   Retry Result: ${retryResult} (after ${attemptCount} attempts)\n`);

      // 9. Get network statistics
      console.log('9. Network statistics...');
      const networkStats = healthMonitor.getNetworkStatistics();
      console.log(`   Total Health Checks: ${networkStats.totalChecks}`);
      console.log(`   Healthy Percentage: ${networkStats.healthyPercentage.toFixed(1)}%`);
      console.log(`   Average Response Time: ${networkStats.averageResponseTime.toFixed(0)}ms\n`);

      // 10. Demonstrate cost estimation
      console.log('10. Transaction cost estimation...');
      const tokenCreateCost = BlockchainUtils.estimateTransactionFee('token_create');
      const transferCost = BlockchainUtils.estimateTransactionFee('token_transfer');
      console.log(`   Token Creation: ${BlockchainUtils.tinybarsToHbar(tokenCreateCost)} HBAR`);
      console.log(`   Token Transfer: ${BlockchainUtils.tinybarsToHbar(transferCost)} HBAR\n`);

    } else {
      console.log(`   ❌ Token creation failed: ${tokenResult.error}\n`);
    }

    // 11. Health summary
    console.log('11. Final health summary...');
    const healthSummary = healthMonitor.getHealthSummary();
    console.log(`   Status: ${healthSummary.status}`);
    console.log(`   Balance: ${healthSummary.balance}`);
    console.log(`   Uptime: ${healthSummary.uptime}`);
    console.log(`   Success Rate: ${healthSummary.successRate}\n`);

    console.log('✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Clean up
    hederaService.close();
  }
}

// Property tokenization workflow example
async function demonstratePropertyTokenization() {
  console.log('\n🏠 Property Tokenization Workflow Demo\n');

  const tokenizationService = new PropertyTokenizationService();

  try {
    // This would typically use a real property ID from the database
    const mockPropertyId = 'prop-123-456-789';

    // 1. Validate property for tokenization
    console.log('1. Validating property for tokenization...');
    const validation = await tokenizationService.validatePropertyForTokenization(mockPropertyId);
    
    if (!validation.valid) {
      console.log('   ❌ Property validation failed:');
      validation.errors.forEach(error => console.log(`     - ${error}`));
      return;
    }

    console.log('   ✅ Property validation passed');
    if (validation.warnings.length > 0) {
      console.log('   ⚠️  Warnings:');
      validation.warnings.forEach(warning => console.log(`     - ${warning}`));
    }

    // 2. Get cost estimate
    console.log('\n2. Getting tokenization cost estimate...');
    const costEstimate = await tokenizationService.getTokenizationCostEstimate();
    console.log(`   Total Cost: ${costEstimate.usdCost.toFixed(2)} USD (${BlockchainUtils.tinybarsToHbar(costEstimate.hbarCost)} HBAR)`);
    console.log(`   Breakdown:`);
    console.log(`     - Token Creation: ${BlockchainUtils.tinybarsToHbar(costEstimate.breakdown.tokenCreation)} HBAR`);
    console.log(`     - Association Fees: ${BlockchainUtils.tinybarsToHbar(costEstimate.breakdown.associationFees)} HBAR`);
    console.log(`     - Network Fees: ${BlockchainUtils.tinybarsToHbar(costEstimate.breakdown.networkFees)} HBAR`);

    // 3. Tokenization request (would fail with mock property ID)
    console.log('\n3. Tokenization request example...');
    const tokenizationRequest = {
      propertyId: mockPropertyId,
      tokenName: 'Lagos Premium Apartments',
      tokenSymbol: 'LAPAT',
      totalSupply: 50000,
      decimals: 0,
      metadata: {
        propertyType: 'residential',
        location: 'Lagos, Nigeria',
        valuation: 5000000
      }
    };

    console.log(`   Request prepared for property: ${tokenizationRequest.propertyId}`);
    console.log(`   Token Name: ${tokenizationRequest.tokenName}`);
    console.log(`   Token Symbol: ${tokenizationRequest.tokenSymbol}`);
    console.log(`   Total Supply: ${tokenizationRequest.totalSupply} tokens`);

    // Note: Actual tokenization would require a real property in the database
    console.log('\n   ℹ️  Actual tokenization requires valid property in database');

  } catch (error) {
    console.error('❌ Property tokenization demo failed:', error);
  }
}

// Run the demos
async function runDemos() {
  // Check if environment is properly configured
  if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
    console.log('❌ Please configure HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY environment variables');
    return;
  }

  await demonstrateHederaIntegration();
  await demonstratePropertyTokenization();
}

// Export for use in other files
export {
  demonstrateHederaIntegration,
  demonstratePropertyTokenization,
  runDemos
};

// Run if called directly
if (require.main === module) {
  runDemos().catch(console.error);
}