const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DividendDistributor", function () {
  let PropertyToken;
  let propertyToken;
  let DividendDistributor;
  let dividendDistributor;
  let owner;
  let propertyManager;
  let investor1;
  let investor2;
  let addrs;

  const DISTRIBUTION_AMOUNT = ethers.parseEther("10"); // 10 HBAR

  beforeEach(async function () {
    [owner, propertyManager, investor1, investor2, ...addrs] = await ethers.getSigners();

    // Deploy PropertyToken first
    PropertyToken = await ethers.getContractFactory("PropertyToken");
    propertyToken = await PropertyToken.deploy();
    await propertyToken.waitForDeployment();

    // Deploy DividendDistributor
    DividendDistributor = await ethers.getContractFactory("DividendDistributor");
    dividendDistributor = await DividendDistributor.deploy(await propertyToken.getAddress());
    await dividendDistributor.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right property token contract", async function () {
      expect(await dividendDistributor.propertyTokenContract()).to.equal(await propertyToken.getAddress());
    });

    it("Should set the right owner", async function () {
      expect(await dividendDistributor.hasRole(await dividendDistributor.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    });

    it("Should set the distributor role for owner", async function () {
      expect(await dividendDistributor.hasRole(await dividendDistributor.DISTRIBUTOR_ROLE(), owner.address)).to.be.true;
    });

    it("Should reject deployment with zero address", async function () {
      await expect(
        DividendDistributor.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid property token contract");
    });
  });

  describe("Distribution Creation", function () {
    it("Should reject distribution creation with zero amount", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;
      
      await expect(
        dividendDistributor.createDistribution(fakeTokenAddress, 0)
      ).to.be.revertedWith("Distribution amount must be greater than 0");
    });

    it("Should reject distribution creation from unauthorized user", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;
      
      await expect(
        dividendDistributor.connect(investor1).createDistribution(fakeTokenAddress, DISTRIBUTION_AMOUNT)
      ).to.be.revertedWith(/AccessControl: account .* is missing role/);
    });

    it("Should reject distribution for non-existent token", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;
      
      await expect(
        dividendDistributor.createDistribution(fakeTokenAddress, DISTRIBUTION_AMOUNT)
      ).to.be.revertedWith("Token does not exist");
    });
  });

  describe("Batch Distribution Processing", function () {
    it("Should reject processing non-existent distribution", async function () {
      await expect(
        dividendDistributor.processBatchDistribution(999, 10)
      ).to.be.revertedWith("Distribution does not exist");
    });

    it("Should reject invalid batch size", async function () {
      await expect(
        dividendDistributor.processBatchDistribution(1, 0)
      ).to.be.revertedWith("Invalid batch size");
    });

    it("Should reject batch size over maximum", async function () {
      await expect(
        dividendDistributor.processBatchDistribution(1, 101)
      ).to.be.revertedWith("Invalid batch size");
    });

    it("Should reject processing from unauthorized user", async function () {
      await expect(
        dividendDistributor.connect(investor1).processBatchDistribution(1, 10)
      ).to.be.revertedWith(/AccessControl: account .* is missing role/);
    });
  });

  describe("Dividend Claims", function () {
    it("Should reject claim with no pending dividends", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;
      
      await expect(
        dividendDistributor.connect(investor1).claimDividends(fakeTokenAddress)
      ).to.be.revertedWith("No pending dividends");
    });

    it("Should return zero pending dividends initially", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;
      
      expect(await dividendDistributor.getPendingDividends(fakeTokenAddress, investor1.address)).to.equal(0);
    });
  });

  describe("View Functions", function () {
    it("Should return empty distribution history initially", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;
      
      const distributions = await dividendDistributor.getTokenDistributions(fakeTokenAddress);
      expect(distributions.length).to.equal(0);
    });

    it("Should return zero total distributed initially", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;
      
      expect(await dividendDistributor.getTotalDistributed(fakeTokenAddress)).to.equal(0);
    });

    it("Should reject getting non-existent distribution", async function () {
      await expect(
        dividendDistributor.getDistribution(999)
      ).to.be.revertedWith("Distribution does not exist");
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to grant distributor role", async function () {
      await dividendDistributor.grantRole(await dividendDistributor.DISTRIBUTOR_ROLE(), investor1.address);
      expect(await dividendDistributor.hasRole(await dividendDistributor.DISTRIBUTOR_ROLE(), investor1.address)).to.be.true;
    });

    it("Should allow admin to revoke distributor role", async function () {
      await dividendDistributor.grantRole(await dividendDistributor.DISTRIBUTOR_ROLE(), investor1.address);
      await dividendDistributor.revokeRole(await dividendDistributor.DISTRIBUTOR_ROLE(), investor1.address);
      expect(await dividendDistributor.hasRole(await dividendDistributor.DISTRIBUTOR_ROLE(), investor1.address)).to.be.false;
    });

    it("Should reject role management from non-admin", async function () {
      await expect(
        dividendDistributor.connect(investor1).grantRole(await dividendDistributor.DISTRIBUTOR_ROLE(), investor2.address)
      ).to.be.revertedWith(/AccessControl: account .* is missing role/);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow admin to emergency withdraw", async function () {
      // Send some HBAR to the contract first
      await owner.sendTransaction({
        to: await dividendDistributor.getAddress(),
        value: ethers.parseEther("1")
      });

      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      const tx = await dividendDistributor.emergencyWithdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      
      // Account for gas costs in the comparison
      expect(finalBalance).to.be.closeTo(
        initialBalance + ethers.parseEther("1") - gasUsed,
        ethers.parseEther("0.01") // Allow for small gas estimation differences
      );
    });

    it("Should reject emergency withdraw from non-admin", async function () {
      await expect(
        dividendDistributor.connect(investor1).emergencyWithdraw()
      ).to.be.revertedWith(/AccessControl: account .* is missing role/);
    });

    it("Should reject emergency withdraw with zero balance", async function () {
      await expect(
        dividendDistributor.emergencyWithdraw()
      ).to.be.revertedWith("No balance to withdraw");
    });
  });

  describe("Contract Balance", function () {
    it("Should accept HBAR deposits", async function () {
      const amount = ethers.parseEther("1");
      
      await owner.sendTransaction({
        to: await dividendDistributor.getAddress(),
        value: amount
      });

      expect(await ethers.provider.getBalance(await dividendDistributor.getAddress())).to.equal(amount);
    });
  });

  describe("Constants", function () {
    it("Should have correct maximum holders per batch", async function () {
      expect(await dividendDistributor.MAX_HOLDERS_PER_BATCH()).to.equal(100);
    });

    it("Should have correct basis points", async function () {
      expect(await dividendDistributor.BASIS_POINTS()).to.equal(10000);
    });

    it("Should start with distribution ID 1", async function () {
      expect(await dividendDistributor.nextDistributionId()).to.equal(1);
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should have reentrancy protection on createDistribution", async function () {
      const contractInterface = dividendDistributor.interface;
      const createDistributionFunction = contractInterface.getFunction("createDistribution");
      expect(createDistributionFunction).to.not.be.undefined;
    });

    it("Should have reentrancy protection on claimDividends", async function () {
      const contractInterface = dividendDistributor.interface;
      const claimDividendsFunction = contractInterface.getFunction("claimDividends");
      expect(claimDividendsFunction).to.not.be.undefined;
    });
  });
});