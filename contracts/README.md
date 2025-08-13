# GlobalLand Smart Contracts

This directory contains the smart contracts for the GlobalLand real estate tokenization platform built on Hedera Hashgraph.

## Overview

The GlobalLand platform uses three main smart contracts to enable fractional real estate ownership:

1. **PropertyToken.sol** - Tokenizes real estate properties using Hedera Token Service (HTS)
2. **DividendDistributor.sol** - Manages rental income distribution to token holders
3. **PropertyGovernance.sol** - Enables token holder voting on property management decisions

## Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  PropertyToken  │    │ DividendDistributor  │    │ PropertyGovernance  │
│                 │    │                      │    │                     │
│ - Token Creation│◄───┤ - Dividend Calc      │    │ - Proposal Creation │
│ - Metadata Mgmt │    │ - Distribution       │    │ - Voting System     │
│ - Access Control│    │ - Fee Management     │    │ - Execution Logic   │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
         │                        │                           │
         └────────────────────────┼───────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │    Hedera Token Service    │
                    │                            │
                    │ - Native Token Creation    │
                    │ - Transfer Operations      │
                    │ - Balance Management       │
                    └────────────────────────────┘
```

## Smart Contracts

### PropertyToken.sol

The main contract for property tokenization using Hedera's native Token Service.

**Key Features:**
- Creates HTS tokens representing fractional property ownership
- Manages property metadata and documentation
- Implements role-based access control
- Supports multiple property types (residential, commercial, etc.)
- Tracks token holder balances and transfers

**Main Functions:**
- `createPropertyToken()` - Creates a new property token
- `updatePropertyMetadata()` - Updates property information
- `transferTokens()` - Handles token transfers
- `updatePropertyStatus()` - Changes property status

### DividendDistributor.sol

Manages the distribution of rental income to property token holders.

**Key Features:**
- Proportional dividend calculation based on token holdings
- Batch processing to handle large numbers of token holders
- Automatic management fee deduction
- Claim-based distribution system
- Emergency withdrawal functionality

**Main Functions:**
- `createDistribution()` - Initiates a new dividend distribution
- `processBatchDistribution()` - Processes distributions in batches
- `claimDividends()` - Allows token holders to claim their dividends
- `getPendingDividends()` - Returns pending dividend amounts

### PropertyGovernance.sol

Enables democratic governance for property management decisions.

**Key Features:**
- Proposal creation and voting system
- Multiple proposal types (fee changes, manager changes, etc.)
- Configurable quorum and majority requirements
- Time-based voting periods
- Automatic proposal execution

**Main Functions:**
- `createProposal()` - Creates a new governance proposal
- `castVote()` - Allows token holders to vote
- `executeProposal()` - Executes successful proposals
- `finalizeProposal()` - Finalizes voting after period ends

## Security Features

### Access Control
- Role-based permissions using OpenZeppelin's AccessControl
- Separate roles for different operations (tokenizer, property manager, etc.)
- Multi-signature support for critical operations

### Reentrancy Protection
- All state-changing functions protected with ReentrancyGuard
- Prevents common attack vectors

### Input Validation
- Comprehensive parameter validation
- Boundary checks for all numeric inputs
- Address validation for all external calls

### Emergency Features
- Emergency withdrawal functions for admin
- Pause functionality for critical situations
- Upgrade mechanisms for contract improvements

## Deployment

### Prerequisites
1. Node.js v18+ (Note: v23+ has warnings but works)
2. Hardhat development environment
3. Hedera testnet/mainnet account with HBAR

### Installation
```bash
npm install
```

### Compilation
```bash
npx hardhat compile
```

### Testing
```bash
npx hardhat test
```

### Deployment to Hedera Testnet
```bash
# Set environment variables
export HEDERA_PRIVATE_KEY="your-private-key"

# Deploy contracts
npx hardhat run scripts/deploy.js --network hederaTestnet
```

### Verification
```bash
npx hardhat run scripts/verify-contracts.js --network hederaTestnet
```

## Configuration

### Environment Variables
Create a `.env` file with the following variables:
```
HEDERA_PRIVATE_KEY=your-private-key-here
HEDERA_ACCOUNT_ID=0.0.your-account-id
```

### Network Configuration
The contracts are configured for:
- **Hedera Testnet**: Chain ID 296, RPC: https://testnet.hashio.io/api
- **Hedera Mainnet**: Chain ID 295, RPC: https://mainnet.hashio.io/api

## Usage Examples

### Creating a Property Token
```javascript
const propertyToken = await PropertyToken.deploy();
await propertyToken.createPropertyToken(
  "PROP_LAGOS_001",           // Property ID
  "Lagos Premium Apartments", // Token name
  "LPA",                      // Token symbol
  1000000,                    // Total supply
  100,                        // Price per token
  propertyManagerAddress,     // Property manager
  500,                        // 5% management fee
  "ipfs://metadata-hash",     // Metadata URI
  0                           // PropertyType.RESIDENTIAL
);
```

### Distributing Dividends
```javascript
const dividendDistributor = await DividendDistributor.deploy(propertyTokenAddress);
const distributionId = await dividendDistributor.createDistribution(
  tokenAddress,
  ethers.parseEther("10") // 10 HBAR dividend
);
await dividendDistributor.processBatchDistribution(distributionId, 50);
```

### Creating a Governance Proposal
```javascript
const propertyGovernance = await PropertyGovernance.deploy(propertyTokenAddress);
const proposalData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [700]); // 7% fee
await propertyGovernance.createProposal(
  tokenAddress,
  "Increase Management Fee",
  "Proposal to increase management fee to 7%",
  1, // ProposalType.FEE_CHANGE
  proposalData,
  7 * 24 * 60 * 60, // 7 days voting period
  2500, // 25% quorum
  5000  // 50% majority
);
```

## Gas Optimization

The contracts are optimized for gas efficiency:
- Use of `viaIR` compilation for better optimization
- Batch processing for operations affecting multiple users
- Efficient storage patterns to minimize gas costs
- View functions for read operations

## Testing

The test suite includes:
- **Unit Tests**: Individual contract function testing
- **Integration Tests**: Cross-contract interaction testing
- **Security Tests**: Reentrancy and access control testing
- **Gas Tests**: Performance and optimization verification

Run specific test suites:
```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/contracts/PropertyToken.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

## Monitoring and Maintenance

### Events
All contracts emit comprehensive events for monitoring:
- Property token creation and updates
- Dividend distributions and claims
- Governance proposals and votes
- Access control changes

### Upgrades
The contracts use a proxy pattern for upgrades:
- Admin can upgrade contract logic
- Storage layout preservation
- Migration scripts for data consistency

## Security Considerations

### Auditing
- Contracts should be audited before mainnet deployment
- Regular security reviews for updates
- Bug bounty program for community testing

### Best Practices
- Use multi-signature wallets for admin functions
- Implement timelock for critical operations
- Regular monitoring of contract interactions
- Backup and recovery procedures

## Support and Documentation

For additional support:
- Technical documentation: See inline code comments
- API documentation: Generated from contract interfaces
- Community support: GitHub issues and discussions
- Professional support: Contact the development team

## License

MIT License - see LICENSE file for details.