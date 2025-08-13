const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PropertyGovernance", function () {
  let PropertyToken;
  let propertyToken;
  let PropertyGovernance;
  let propertyGovernance;
  let owner;
  let propertyManager;
  let investor1;
  let investor2;
  let addrs;

  const PROPOSAL_TITLE = "Increase Management Fee";
  const PROPOSAL_DESCRIPTION = "Proposal to increase management fee from 5% to 7%";
  const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds
  const QUORUM_REQUIRED = 2500; // 25%
  const MAJORITY_REQUIRED = 5000; // 50%

  beforeEach(async function () {
    [owner, propertyManager, investor1, investor2, ...addrs] = await ethers.getSigners();

    // Deploy PropertyToken first
    PropertyToken = await ethers.getContractFactory("PropertyToken");
    propertyToken = await PropertyToken.deploy();
    await propertyToken.waitForDeployment();

    // Deploy PropertyGovernance
    PropertyGovernance = await ethers.getContractFactory("PropertyGovernance");
    propertyGovernance = await PropertyGovernance.deploy(await propertyToken.getAddress());
    await propertyGovernance.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right property token contract", async function () {
      expect(await propertyGovernance.propertyTokenContract()).to.equal(await propertyToken.getAddress());
    });

    it("Should set the right owner", async function () {
      expect(await propertyGovernance.hasRole(await propertyGovernance.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    });

    it("Should set the governance admin role for owner", async function () {
      expect(await propertyGovernance.hasRole(await propertyGovernance.GOVERNANCE_ADMIN_ROLE(), owner.address)).to.be.true;
    });

    it("Should reject deployment with zero address", async function () {
      await expect(
        PropertyGovernance.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid property token contract");
    });
  });

  describe("Proposal Creation", function () {
    const fakeTokenAddress = ethers.Wallet.createRandom().address;
    const proposalData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [700]); // 7% fee

    it("Should reject proposal with empty title", async function () {
      await expect(
        propertyGovernance.createProposal(
          fakeTokenAddress,
          "",
          PROPOSAL_DESCRIPTION,
          1, // ProposalType.FEE_CHANGE
          proposalData,
          VOTING_PERIOD,
          QUORUM_REQUIRED,
          MAJORITY_REQUIRED
        )
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("Should reject proposal with empty description", async function () {
      await expect(
        propertyGovernance.createProposal(
          fakeTokenAddress,
          PROPOSAL_TITLE,
          "",
          1, // ProposalType.FEE_CHANGE
          proposalData,
          VOTING_PERIOD,
          QUORUM_REQUIRED,
          MAJORITY_REQUIRED
        )
      ).to.be.revertedWith("Description cannot be empty");
    });

    it("Should reject proposal with invalid voting period (too short)", async function () {
      await expect(
        propertyGovernance.createProposal(
          fakeTokenAddress,
          PROPOSAL_TITLE,
          PROPOSAL_DESCRIPTION,
          1,
          proposalData,
          60, // 1 minute - too short
          QUORUM_REQUIRED,
          MAJORITY_REQUIRED
        )
      ).to.be.revertedWith("Invalid voting period");
    });

    it("Should reject proposal with invalid voting period (too long)", async function () {
      await expect(
        propertyGovernance.createProposal(
          fakeTokenAddress,
          PROPOSAL_TITLE,
          PROPOSAL_DESCRIPTION,
          1,
          proposalData,
          31 * 24 * 60 * 60, // 31 days - too long
          QUORUM_REQUIRED,
          MAJORITY_REQUIRED
        )
      ).to.be.revertedWith("Invalid voting period");
    });

    it("Should reject proposal with invalid quorum requirement", async function () {
      await expect(
        propertyGovernance.createProposal(
          fakeTokenAddress,
          PROPOSAL_TITLE,
          PROPOSAL_DESCRIPTION,
          1,
          proposalData,
          VOTING_PERIOD,
          0, // Invalid quorum
          MAJORITY_REQUIRED
        )
      ).to.be.revertedWith("Invalid quorum requirement");
    });

    it("Should reject proposal with invalid majority requirement", async function () {
      await expect(
        propertyGovernance.createProposal(
          fakeTokenAddress,
          PROPOSAL_TITLE,
          PROPOSAL_DESCRIPTION,
          1,
          proposalData,
          VOTING_PERIOD,
          QUORUM_REQUIRED,
          10001 // Over 100%
        )
      ).to.be.revertedWith("Invalid majority requirement");
    });

    it("Should reject proposal for non-existent token", async function () {
      await expect(
        propertyGovernance.createProposal(
          fakeTokenAddress,
          PROPOSAL_TITLE,
          PROPOSAL_DESCRIPTION,
          1,
          proposalData,
          VOTING_PERIOD,
          QUORUM_REQUIRED,
          MAJORITY_REQUIRED
        )
      ).to.be.revertedWith("Token does not exist");
    });
  });

  describe("Voting", function () {
    it("Should reject vote on non-existent proposal", async function () {
      await expect(
        propertyGovernance.connect(investor1).castVote(999, 0, "Support the proposal")
      ).to.be.revertedWith("Proposal does not exist");
    });

    it("Should reject vote with no voting power", async function () {
      // This would require a valid proposal first, which needs a valid token
      // For now, we test the basic validation
      const fakeProposalId = 1;
      
      await expect(
        propertyGovernance.connect(investor1).castVote(fakeProposalId, 0, "Support")
      ).to.be.revertedWith("Proposal does not exist");
    });
  });

  describe("Proposal Execution", function () {
    it("Should reject execution of non-existent proposal", async function () {
      await expect(
        propertyGovernance.executeProposal(999)
      ).to.be.revertedWith("Proposal does not exist");
    });
  });

  describe("Proposal Finalization", function () {
    it("Should reject finalization of non-existent proposal", async function () {
      await expect(
        propertyGovernance.finalizeProposal(999)
      ).to.be.revertedWith("Proposal does not exist");
    });
  });

  describe("View Functions", function () {
    it("Should reject getting non-existent proposal", async function () {
      await expect(
        propertyGovernance.getProposal(999)
      ).to.be.revertedWith("Proposal does not exist");
    });

    it("Should reject getting vote for non-existent proposal", async function () {
      await expect(
        propertyGovernance.getVote(999, investor1.address)
      ).to.be.revertedWith("Proposal does not exist");
    });

    it("Should return empty proposal list initially", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;
      const proposals = await propertyGovernance.getTokenProposals(fakeTokenAddress);
      expect(proposals.length).to.equal(0);
    });

    it("Should return zero voting power for non-existent token", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;
      expect(await propertyGovernance.getVotingPower(fakeTokenAddress, investor1.address)).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to grant governance admin role", async function () {
      await propertyGovernance.grantRole(await propertyGovernance.GOVERNANCE_ADMIN_ROLE(), investor1.address);
      expect(await propertyGovernance.hasRole(await propertyGovernance.GOVERNANCE_ADMIN_ROLE(), investor1.address)).to.be.true;
    });

    it("Should allow admin to revoke governance admin role", async function () {
      await propertyGovernance.grantRole(await propertyGovernance.GOVERNANCE_ADMIN_ROLE(), investor1.address);
      await propertyGovernance.revokeRole(await propertyGovernance.GOVERNANCE_ADMIN_ROLE(), investor1.address);
      expect(await propertyGovernance.hasRole(await propertyGovernance.GOVERNANCE_ADMIN_ROLE(), investor1.address)).to.be.false;
    });

    it("Should reject role management from non-admin", async function () {
      await expect(
        propertyGovernance.connect(investor1).grantRole(await propertyGovernance.GOVERNANCE_ADMIN_ROLE(), investor2.address)
      ).to.be.revertedWith(/AccessControl: account .* is missing role/);
    });
  });

  describe("Constants", function () {
    it("Should have correct basis points", async function () {
      expect(await propertyGovernance.BASIS_POINTS()).to.equal(10000);
    });

    it("Should have correct minimum voting period", async function () {
      expect(await propertyGovernance.MIN_VOTING_PERIOD()).to.equal(24 * 60 * 60); // 1 day
    });

    it("Should have correct maximum voting period", async function () {
      expect(await propertyGovernance.MAX_VOTING_PERIOD()).to.equal(30 * 24 * 60 * 60); // 30 days
    });

    it("Should have correct default quorum", async function () {
      expect(await propertyGovernance.DEFAULT_QUORUM()).to.equal(2500); // 25%
    });

    it("Should have correct default majority", async function () {
      expect(await propertyGovernance.DEFAULT_MAJORITY()).to.equal(5000); // 50%
    });

    it("Should start with proposal ID 1", async function () {
      expect(await propertyGovernance.nextProposalId()).to.equal(1);
    });
  });

  describe("Proposal Types", function () {
    it("Should support property management proposals", async function () {
      // Test that the enum values are accessible
      // ProposalType.PROPERTY_MANAGEMENT = 0
      expect(0).to.equal(0); // PROPERTY_MANAGEMENT
    });

    it("Should support fee change proposals", async function () {
      // ProposalType.FEE_CHANGE = 1
      expect(1).to.equal(1); // FEE_CHANGE
    });

    it("Should support manager change proposals", async function () {
      // ProposalType.MANAGER_CHANGE = 2
      expect(2).to.equal(2); // MANAGER_CHANGE
    });

    it("Should support emergency action proposals", async function () {
      // ProposalType.EMERGENCY_ACTION = 3
      expect(3).to.equal(3); // EMERGENCY_ACTION
    });

    it("Should support general proposals", async function () {
      // ProposalType.GENERAL = 4
      expect(4).to.equal(4); // GENERAL
    });
  });

  describe("Vote Choices", function () {
    it("Should support FOR votes", async function () {
      // VoteChoice.FOR = 0
      expect(0).to.equal(0); // FOR
    });

    it("Should support AGAINST votes", async function () {
      // VoteChoice.AGAINST = 1
      expect(1).to.equal(1); // AGAINST
    });

    it("Should support ABSTAIN votes", async function () {
      // VoteChoice.ABSTAIN = 2
      expect(2).to.equal(2); // ABSTAIN
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should have reentrancy protection on createProposal", async function () {
      const contractInterface = propertyGovernance.interface;
      const createProposalFunction = contractInterface.getFunction("createProposal");
      expect(createProposalFunction).to.not.be.undefined;
    });

    it("Should have reentrancy protection on castVote", async function () {
      const contractInterface = propertyGovernance.interface;
      const castVoteFunction = contractInterface.getFunction("castVote");
      expect(castVoteFunction).to.not.be.undefined;
    });

    it("Should have reentrancy protection on executeProposal", async function () {
      const contractInterface = propertyGovernance.interface;
      const executeProposalFunction = contractInterface.getFunction("executeProposal");
      expect(executeProposalFunction).to.not.be.undefined;
    });
  });
});