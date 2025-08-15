require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        count: 20,
        accountsBalance: '10000000000000000000000', // 10,000 ETH
      },
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
    },
    hedera_testnet: {
      url: 'https://testnet.hashio.io/api',
      chainId: 296,
      accounts: process.env.HEDERA_PRIVATE_KEY ? [process.env.HEDERA_PRIVATE_KEY] : [],
    },
    hedera_mainnet: {
      url: 'https://mainnet.hashio.io/api',
      chainId: 295,
      accounts: process.env.HEDERA_MAINNET_PRIVATE_KEY ? [process.env.HEDERA_MAINNET_PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
    gasPrice: 21,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  etherscan: {
    apiKey: {
      hedera_testnet: 'abc', // Placeholder for Hedera
      hedera_mainnet: 'abc', // Placeholder for Hedera
    },
    customChains: [
      {
        network: 'hedera_testnet',
        chainId: 296,
        urls: {
          apiURL: 'https://server-verify.hashscan.io',
          browserURL: 'https://hashscan.io/testnet',
        },
      },
      {
        network: 'hedera_mainnet',
        chainId: 295,
        urls: {
          apiURL: 'https://server-verify.hashscan.io',
          browserURL: 'https://hashscan.io/mainnet',
        },
      },
    ],
  },
  mocha: {
    timeout: 60000,
  },
  paths: {
    sources: './contracts',
    tests: './test/contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
};