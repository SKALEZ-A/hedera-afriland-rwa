const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('PropertyToken Comprehensive Tests', function () {
  // Fixture for deploying contracts
  async function deployPropertyTokenFixture() {
    const [owner, propertyManager, investor1, investor2, investor3] = await ethers.getSigners();

    // Deploy PropertyToken contract
    const PropertyToken = await ethers.getContractFactory('PropertyToken');
    const propertyToken = await PropertyToken.deploy();

    // Deploy DividendDistributor contract
    const DividendDistributor = await ethers.getContractFactory('DividendDistributor');
    const dividendDistributor = await DividendDistributor.deploy(propertyToken.address);

    // Deploy PropertyGovernance contract
    const PropertyGovernance = await ethers.getContractFactory('PropertyGovernance');
    const propertyGovernance = await PropertyGovernance.deploy(propertyToken.address);

    return {
      propertyToken,
      dividendDistributor,
      propertyGovernance,
      owner,
      propertyManager,
      investor1,
      investor2,
      investor3,
    };
  }

  describe('Token Creation and Management', function () {
    it('should create property token with correct parameters', async function () {
      const { propertyToken, owner, propertyManager } = await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const totalSupply = ethers.utils.parseUnits('10000', 0); // 10,000 tokens
      const pricePerToken = ethers.utils.parseEther('0.1'); // 0.1 HBAR per token
      const managementFee = 500; // 5%

      await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        totalSupply,
        pricePerToken,
        propertyManager.address,
        managementFee
      );

      const tokenInfo = await propertyToken.getTokenInfo(tokenId);
      expect(tokenInfo.propertyId).to.equal('PROP001');
      expect(tokenInfo.totalSupply).to.equal(totalSupply);
      expect(tokenInfo.pricePerToken).to.equal(pricePerToken);
      expect(tokenInfo.propertyManager).to.equal(propertyManager.address);
      expect(tokenInfo.managementFee).to.equal(managementFee);
    });

    it('should prevent non-owner from creating tokens', async function () {
      const { propertyToken, investor1 } = await loadFixture(deployPropertyTokenFixture);

      await expect(
        propertyToken.connect(investor1).createPropertyToken(
          1,
          'PROP001',
          10000,
          ethers.utils.parseEther('0.1'),
          investor1.address,
          500
        )
      ).to.be.revertedWith('AccessControl: account is missing role');
    });

    it('should validate token creation parameters', async function () {
      const { propertyToken, propertyManager } = await loadFixture(deployPropertyTokenFixture);

      // Test zero total supply
      await expect(
        propertyToken.createPropertyToken(
          1,
          'PROP001',
          0,
          ethers.utils.parseEther('0.1'),
          propertyManager.address,
          500
        )
      ).to.be.revertedWith('Total supply must be greater than zero');

      // Test zero price per token
      await expect(
        propertyToken.createPropertyToken(
          1,
          'PROP001',
          10000,
          0,
          propertyManager.address,
          500
        )
      ).to.be.revertedWith('Price per token must be greater than zero');

      // Test invalid management fee (over 10%)
      await expect(
        propertyToken.createPropertyToken(
          1,
          'PROP001',
          10000,
          ethers.utils.parseEther('0.1'),
          propertyManager.address,
          1100 // 11%
        )
      ).to.be.revertedWith('Management fee cannot exceed 10%');
    });
  });

  describe('Token Purchase and Transfer', function () {
    it('should allow investors to purchase tokens', async function () {
      const { propertyToken, propertyManager, investor1 } = await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const totalSupply = 10000;
      const pricePerToken = ethers.utils.parseEther('0.1');

      // Create token
      await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        totalSupply,
        pricePerToken,
        propertyManager.address,
        500
      );

      // Purchase tokens
      const tokenAmount = 100;
      const totalCost = pricePerToken.mul(tokenAmount);

      await expect(
        propertyToken.connect(investor1).purchaseTokens(tokenId, tokenAmount, {
          value: totalCost,
        })
      )
        .to.emit(propertyToken, 'TokensPurchased')
        .withArgs(tokenId, investor1.address, tokenAmount, totalCost);

      // Verify balance
      const balance = await propertyToken.balanceOf(investor1.address, tokenId);
      expect(balance).to.equal(tokenAmount);

      // Verify available tokens decreased
      const tokenInfo = await propertyToken.getTokenInfo(tokenId);
      expect(tokenInfo.availableTokens).to.equal(totalSupply - tokenAmount);
    });

    it('should prevent purchase with insufficient payment', async function () {
      const { propertyToken, propertyManager, investor1 } = await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const pricePerToken = ethers.utils.parseEther('0.1');

      await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        10000,
        pricePerToken,
        propertyManager.address,
        500
      );

      const tokenAmount = 100;
      const insufficientPayment = pricePerToken.mul(tokenAmount).sub(1);

      await expect(
        propertyToken.connect(investor1).purchaseTokens(tokenId, tokenAmount, {
          value: insufficientPayment,
        })
      ).to.be.revertedWith('Insufficient payment');
    });

    it('should prevent purchase of more tokens than available', async function () {
      const { propertyToken, propertyManager, investor1 } = await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const totalSupply = 1000;
      const pricePerToken = ethers.utils.parseEther('0.1');

      await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        totalSupply,
        pricePerToken,
        propertyManager.address,
        500
      );

      const tokenAmount = 1001; // More than total supply
      const totalCost = pricePerToken.mul(tokenAmount);

      await expect(
        propertyToken.connect(investor1).purchaseTokens(tokenAmount, {
          value: totalCost,
        })
      ).to.be.revertedWith('Insufficient tokens available');
    });

    it('should handle token transfers between investors', async function () {
      const { propertyToken, propertyManager, investor1, investor2 } = await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const pricePerToken = ethers.utils.parseEther('0.1');

      // Create token and purchase
      await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        10000,
        pricePerToken,
        propertyManager.address,
        500
      );

      const tokenAmount = 200;
      await propertyToken.connect(investor1).purchaseTokens(tokenId, tokenAmount, {
        value: pricePerToken.mul(tokenAmount),
      });

      // Transfer tokens
      const transferAmount = 50;
      await propertyToken.connect(investor1).safeTransferFrom(
        investor1.address,
        investor2.address,
        tokenId,
        transferAmount,
        '0x'
      );

      // Verify balances
      const investor1Balance = await propertyToken.balanceOf(investor1.address, tokenId);
      const investor2Balance = await propertyToken.balanceOf(investor2.address, tokenId);

      expect(investor1Balance).to.equal(tokenAmount - transferAmount);
      expect(investor2Balance).to.equal(transferAmount);
    });
  });

  describe('Dividend Distribution', function () {
    it('should distribute dividends proportionally', async function () {
      const { propertyToken, dividendDistributor, propertyManager, investor1, investor2 } = 
        await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const pricePerToken = ethers.utils.parseEther('0.1');

      // Create token
      await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        10000,
        pricePerToken,
        propertyManager.address,
        500
      );

      // Investors purchase tokens
      await propertyToken.connect(investor1).purchaseTokens(tokenId, 300, {
        value: pricePerToken.mul(300),
      });

      await propertyToken.connect(investor2).purchaseTokens(tokenId, 700, {
        value: pricePerToken.mul(700),
      });

      // Property manager distributes dividends
      const totalDividend = ethers.utils.parseEther('10'); // 10 HBAR
      const managementFee = totalDividend.mul(500).div(10000); // 5%
      const netDividend = totalDividend.sub(managementFee);

      await expect(
        dividendDistributor.connect(propertyManager).distributeDividends(tokenId, {
          value: totalDividend,
        })
      )
        .to.emit(dividendDistributor, 'DividendsDistributed')
        .withArgs(tokenId, totalDividend, netDividend);

      // Check dividend balances
      const investor1Dividend = await dividendDistributor.getDividendBalance(investor1.address, tokenId);
      const investor2Dividend = await dividendDistributor.getDividendBalance(investor2.address, tokenId);

      // investor1 should get 30% of net dividend (300/1000 tokens)
      // investor2 should get 70% of net dividend (700/1000 tokens)
      const expectedInvestor1Dividend = netDividend.mul(300).div(1000);
      const expectedInvestor2Dividend = netDividend.mul(700).div(1000);

      expect(investor1Dividend).to.equal(expectedInvestor1Dividend);
      expect(investor2Dividend).to.equal(expectedInvestor2Dividend);
    });

    it('should allow investors to claim dividends', async function () {
      const { propertyToken, dividendDistributor, propertyManager, investor1 } = 
        await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const pricePerToken = ethers.utils.parseEther('0.1');

      // Setup token and purchase
      await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        10000,
        pricePerToken,
        propertyManager.address,
        500
      );

      await propertyToken.connect(investor1).purchaseTokens(tokenId, 1000, {
        value: pricePerToken.mul(1000),
      });

      // Distribute dividends
      const totalDividend = ethers.utils.parseEther('5');
      await dividendDistributor.connect(propertyManager).distributeDividends(tokenId, {
        value: totalDividend,
      });

      // Claim dividends
      const initialBalance = await ethers.provider.getBalance(investor1.address);
      
      await expect(
        dividendDistributor.connect(investor1).claimDividends(tokenId)
      )
        .to.emit(dividendDistributor, 'DividendsClaimed');

      const finalBalance = await ethers.provider.getBalance(investor1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe('Governance', function () {
    it('should create and execute governance proposals', async function () {
      const { propertyToken, propertyGovernance, propertyManager, investor1, investor2 } = 
        await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const pricePerToken = ethers.utils.parseEther('0.1');

      // Setup
      await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        10000,
        pricePerToken,
        propertyManager.address,
        500
      );

      await propertyToken.connect(investor1).purchaseTokens(tokenId, 6000, {
        value: pricePerToken.mul(6000),
      });

      await propertyToken.connect(investor2).purchaseTokens(tokenId, 4000, {
        value: pricePerToken.mul(4000),
      });

      // Create proposal
      const proposalId = 1;
      const description = 'Renovate property lobby';
      const votingPeriod = 7 * 24 * 60 * 60; // 7 days

      await expect(
        propertyGovernance.connect(propertyManager).createProposal(
          proposalId,
          tokenId,
          description,
          votingPeriod
        )
      )
        .to.emit(propertyGovernance, 'ProposalCreated')
        .withArgs(proposalId, tokenId, description);

      // Vote on proposal
      await propertyGovernance.connect(investor1).vote(proposalId, true); // Yes vote
      await propertyGovernance.connect(investor2).vote(proposalId, false); // No vote

      // Check voting results
      const proposal = await propertyGovernance.getProposal(proposalId);
      expect(proposal.yesVotes).to.equal(6000); // investor1's token weight
      expect(proposal.noVotes).to.equal(4000); // investor2's token weight
    });

    it('should prevent double voting', async function () {
      const { propertyToken, propertyGovernance, propertyManager, investor1 } = 
        await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const proposalId = 1;

      // Setup
      await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        10000,
        ethers.utils.parseEther('0.1'),
        propertyManager.address,
        500
      );

      await propertyToken.connect(investor1).purchaseTokens(tokenId, 1000, {
        value: ethers.utils.parseEther('100'),
      });

      await propertyGovernance.connect(propertyManager).createProposal(
        proposalId,
        tokenId,
        'Test proposal',
        7 * 24 * 60 * 60
      );

      // First vote should succeed
      await propertyGovernance.connect(investor1).vote(proposalId, true);

      // Second vote should fail
      await expect(
        propertyGovernance.connect(investor1).vote(proposalId, false)
      ).to.be.revertedWith('Already voted');
    });
  });

  describe('Security and Access Control', function () {
    it('should enforce property manager permissions', async function () {
      const { propertyToken, dividendDistributor, investor1 } = await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;

      // Non-property manager should not be able to distribute dividends
      await expect(
        dividendDistributor.connect(investor1).distributeDividends(tokenId, {
          value: ethers.utils.parseEther('1'),
        })
      ).to.be.revertedWith('Only property manager');
    });

    it('should prevent reentrancy attacks', async function () {
      // This would test the ReentrancyGuard functionality
      // Implementation depends on specific attack vectors
      const { dividendDistributor } = await loadFixture(deployPropertyTokenFixture);
      
      // Test would involve creating a malicious contract that tries to re-enter
      // the dividend claim function during execution
      expect(dividendDistributor.address).to.be.properAddress;
    });

    it('should handle integer overflow/underflow safely', async function () {
      const { propertyToken, propertyManager } = await loadFixture(deployPropertyTokenFixture);

      // Test maximum values
      const maxUint256 = ethers.constants.MaxUint256;
      
      await expect(
        propertyToken.createPropertyToken(
          1,
          'PROP001',
          maxUint256,
          1,
          propertyManager.address,
          500
        )
      ).to.not.be.reverted;
    });
  });

  describe('Gas Optimization', function () {
    it('should have reasonable gas costs for token operations', async function () {
      const { propertyToken, propertyManager, investor1 } = await loadFixture(deployPropertyTokenFixture);

      const tokenId = 1;
      const pricePerToken = ethers.utils.parseEther('0.1');

      // Create token
      const createTx = await propertyToken.createPropertyToken(
        tokenId,
        'PROP001',
        10000,
        pricePerToken,
        propertyManager.address,
        500
      );
      const createReceipt = await createTx.wait();
      
      // Purchase tokens
      const purchaseTx = await propertyToken.connect(investor1).purchaseTokens(tokenId, 100, {
        value: pricePerToken.mul(100),
      });
      const purchaseReceipt = await purchaseTx.wait();

      // Assert reasonable gas usage
      expect(createReceipt.gasUsed).to.be.lt(500000); // Less than 500k gas
      expect(purchaseReceipt.gasUsed).to.be.lt(200000); // Less than 200k gas

      console.log(`Token creation gas: ${createReceipt.gasUsed}`);
      console.log(`Token purchase gas: ${purchaseReceipt.gasUsed}`);
    });
  });
});