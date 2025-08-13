const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment of GlobalLand smart contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "HBAR");

  // Deploy PropertyToken contract
  console.log("\n1. Deploying PropertyToken contract...");
  const PropertyToken = await ethers.getContractFactory("PropertyToken");
  const propertyToken = await PropertyToken.deploy();
  await propertyToken.waitForDeployment();
  const propertyTokenAddress = await propertyToken.getAddress();
  console.log("PropertyToken deployed to:", propertyTokenAddress);

  // Deploy DividendDistributor contract
  console.log("\n2. Deploying DividendDistributor contract...");
  const DividendDistributor = await ethers.getContractFactory("DividendDistributor");
  const dividendDistributor = await DividendDistributor.deploy(propertyTokenAddress);
  await dividendDistributor.waitForDeployment();
  const dividendDistributorAddress = await dividendDistributor.getAddress();
  console.log("DividendDistributor deployed to:", dividendDistributorAddress);

  // Deploy PropertyGovernance contract
  console.log("\n3. Deploying PropertyGovernance contract...");
  const PropertyGovernance = await ethers.getContractFactory("PropertyGovernance");
  const propertyGovernance = await PropertyGovernance.deploy(propertyTokenAddress);
  await propertyGovernance.waitForDeployment();
  const propertyGovernanceAddress = await propertyGovernance.getAddress();
  console.log("PropertyGovernance deployed to:", propertyGovernanceAddress);

  // Set up initial roles and permissions
  console.log("\n4. Setting up roles and permissions...");
  
  // Grant distributor role to DividendDistributor contract
  const DISTRIBUTOR_ROLE = await dividendDistributor.DISTRIBUTOR_ROLE();
  await dividendDistributor.grantRole(DISTRIBUTOR_ROLE, dividendDistributorAddress);
  console.log("Granted DISTRIBUTOR_ROLE to DividendDistributor contract");

  // Grant property manager role to PropertyGovernance contract for governance actions
  const PROPERTY_MANAGER_ROLE = await propertyToken.PROPERTY_MANAGER_ROLE();
  await propertyToken.grantRole(PROPERTY_MANAGER_ROLE, propertyGovernanceAddress);
  console.log("Granted PROPERTY_MANAGER_ROLE to PropertyGovernance contract");

  // Verify deployments
  console.log("\n5. Verifying deployments...");
  
  // Check PropertyToken
  const totalTokens = await propertyToken.getTotalTokens();
  console.log("PropertyToken total tokens:", totalTokens.toString());
  
  // Check DividendDistributor
  const nextDistributionId = await dividendDistributor.nextDistributionId();
  console.log("DividendDistributor next distribution ID:", nextDistributionId.toString());
  
  // Check PropertyGovernance
  const nextProposalId = await propertyGovernance.nextProposalId();
  console.log("PropertyGovernance next proposal ID:", nextProposalId.toString());

  // Save deployment addresses to a file
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      PropertyToken: {
        address: propertyTokenAddress,
        constructorArgs: []
      },
      DividendDistributor: {
        address: dividendDistributorAddress,
        constructorArgs: [propertyTokenAddress]
      },
      PropertyGovernance: {
        address: propertyGovernanceAddress,
        constructorArgs: [propertyTokenAddress]
      }
    },
    roles: {
      PropertyToken: {
        DEFAULT_ADMIN_ROLE: await propertyToken.DEFAULT_ADMIN_ROLE(),
        TOKENIZER_ROLE: await propertyToken.TOKENIZER_ROLE(),
        PROPERTY_MANAGER_ROLE: await propertyToken.PROPERTY_MANAGER_ROLE()
      },
      DividendDistributor: {
        DEFAULT_ADMIN_ROLE: await dividendDistributor.DEFAULT_ADMIN_ROLE(),
        DISTRIBUTOR_ROLE: await dividendDistributor.DISTRIBUTOR_ROLE(),
        PROPERTY_MANAGER_ROLE: await dividendDistributor.PROPERTY_MANAGER_ROLE()
      },
      PropertyGovernance: {
        DEFAULT_ADMIN_ROLE: await propertyGovernance.DEFAULT_ADMIN_ROLE(),
        GOVERNANCE_ADMIN_ROLE: await propertyGovernance.GOVERNANCE_ADMIN_ROLE(),
        PROPERTY_MANAGER_ROLE: await propertyGovernance.PROPERTY_MANAGER_ROLE()
      }
    }
  };

  const fs = require('fs');
  const path = require('path');
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Save deployment info
  const deploymentFile = path.join(deploymentsDir, `${hre.network.name}-deployment.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentFile}`);

  console.log("\n✅ Deployment completed successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("PropertyToken:", propertyTokenAddress);
  console.log("DividendDistributor:", dividendDistributorAddress);
  console.log("PropertyGovernance:", propertyGovernanceAddress);

  console.log("\n🔧 Next Steps:");
  console.log("1. Verify contracts on Hedera explorer if deploying to testnet/mainnet");
  console.log("2. Update your application configuration with the new contract addresses");
  console.log("3. Test the contracts with sample transactions");
  console.log("4. Set up monitoring and alerting for the deployed contracts");

  // If deploying to testnet, provide additional information
  if (hre.network.name === 'hederaTestnet') {
    console.log("\n🌐 Hedera Testnet Information:");
    console.log("Explorer: https://hashscan.io/testnet");
    console.log("JSON-RPC: https://testnet.hashio.io/api");
    console.log("Chain ID: 296");
  } else if (hre.network.name === 'hederaMainnet') {
    console.log("\n🌐 Hedera Mainnet Information:");
    console.log("Explorer: https://hashscan.io/mainnet");
    console.log("JSON-RPC: https://mainnet.hashio.io/api");
    console.log("Chain ID: 295");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });