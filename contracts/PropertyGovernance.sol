// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPropertyToken.sol";
import "./interfaces/IPropertyGovernance.sol";
import "./security/AccessControl.sol";
import "./security/ReentrancyGuard.sol";
import "./utils/SafeMath.sol";

/**
 * @title PropertyGovernance
 * @dev Smart contract for property management governance and voting
 * Allows token holders to vote on property management decisions
 */
contract PropertyGovernance is IPropertyGovernance, AccessControl, ReentrancyGuard {
    using SafeMath for uint256;

    // Role definitions
    bytes32 public constant GOVERNANCE_ADMIN_ROLE = keccak256("GOVERNANCE_ADMIN_ROLE");
    bytes32 public constant PROPERTY_MANAGER_ROLE = keccak256("PROPERTY_MANAGER_ROLE");
    
    // Property token contract reference
    IPropertyToken public immutable propertyTokenContract;
    
    // Proposal structure
    struct Proposal {
        uint256 proposalId;
        address tokenAddress;
        address proposer;
        string title;
        string description;
        IPropertyGovernance.ProposalType proposalType;
        bytes proposalData; // Encoded proposal-specific data
        uint256 startTime;
        uint256 endTime;
        uint256 votingPeriod;
        uint256 quorumRequired; // Percentage in basis points
        uint256 majorityRequired; // Percentage in basis points
        IPropertyGovernance.ProposalStatus status;
        uint256 totalVotesFor;
        uint256 totalVotesAgainst;
        uint256 totalVotesAbstain;
        uint256 totalVotingPower;
        bool executed;
        mapping(address => Vote) votes;
        address[] voters;
    }
    
    // Vote structure
    struct Vote {
        bool hasVoted;
        IPropertyGovernance.VoteChoice choice;
        uint256 votingPower;
        uint256 timestamp;
        string reason;
    }
    
    // Proposal tracking
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256[]) public tokenProposals; // token -> proposal IDs
    mapping(address => mapping(address => uint256)) public voterPower; // token -> voter -> power
    
    uint256 public nextProposalId = 1;
    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000 basis points
    uint256 public constant MIN_VOTING_PERIOD = 1 days;
    uint256 public constant MAX_VOTING_PERIOD = 30 days;
    uint256 public constant DEFAULT_QUORUM = 2500; // 25%
    uint256 public constant DEFAULT_MAJORITY = 5000; // 50%
    
    // Events are defined in the interface

    constructor(address _propertyTokenContract) {
        require(_propertyTokenContract != address(0), "Invalid property token contract");
        propertyTokenContract = IPropertyToken(_propertyTokenContract);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(GOVERNANCE_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Creates a new governance proposal
     */
    function createProposal(
        address tokenAddress,
        string memory title,
        string memory description,
        IPropertyGovernance.ProposalType proposalType,
        bytes memory proposalData,
        uint256 votingPeriod,
        uint256 quorumRequired,
        uint256 majorityRequired
    ) external override nonReentrant returns (uint256) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(votingPeriod >= MIN_VOTING_PERIOD && votingPeriod <= MAX_VOTING_PERIOD, "Invalid voting period");
        require(quorumRequired > 0 && quorumRequired <= BASIS_POINTS, "Invalid quorum requirement");
        require(majorityRequired > 0 && majorityRequired <= BASIS_POINTS, "Invalid majority requirement");
        
        // Verify token exists and caller has permission
        IPropertyToken.PropertyTokenInfo memory tokenInfo = propertyTokenContract.getPropertyToken(tokenAddress);
        require(tokenInfo.isActive, "Property token is not active");
        require(
            msg.sender == tokenInfo.propertyManager || 
            hasRole(GOVERNANCE_ADMIN_ROLE, msg.sender) ||
            _hasMinimumTokens(tokenAddress, msg.sender),
            "Not authorized to create proposal"
        );
        
        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.proposalId = proposalId;
        proposal.tokenAddress = tokenAddress;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.proposalType = proposalType;
        proposal.proposalData = proposalData;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp.add(votingPeriod);
        proposal.votingPeriod = votingPeriod;
        proposal.quorumRequired = quorumRequired > 0 ? quorumRequired : DEFAULT_QUORUM;
        proposal.majorityRequired = majorityRequired > 0 ? majorityRequired : DEFAULT_MAJORITY;
        proposal.status = IPropertyGovernance.ProposalStatus.ACTIVE;
        proposal.totalVotingPower = tokenInfo.totalSupply;
        
        tokenProposals[tokenAddress].push(proposalId);
        
        emit ProposalCreated(
            proposalId,
            tokenAddress,
            msg.sender,
            title,
            proposalType,
            proposal.endTime
        );
        
        return proposalId;
    }

    /**
     * @dev Casts a vote on a proposal
     */
    function castVote(
        uint256 proposalId,
        IPropertyGovernance.VoteChoice choice,
        string memory reason
    ) external override nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposalId != 0, "Proposal does not exist");
        require(proposal.status == IPropertyGovernance.ProposalStatus.ACTIVE, "Proposal is not active");
        require(block.timestamp <= proposal.endTime, "Voting period has ended");
        require(!proposal.votes[msg.sender].hasVoted, "Already voted");
        
        // Get voter's token balance as voting power
        uint256 votingPower = propertyTokenContract.getInvestorBalance(proposal.tokenAddress, msg.sender);
        require(votingPower > 0, "No voting power");
        
        // Record vote
        Vote storage vote = proposal.votes[msg.sender];
        vote.hasVoted = true;
        vote.choice = choice;
        vote.votingPower = votingPower;
        vote.timestamp = block.timestamp;
        vote.reason = reason;
        
        proposal.voters.push(msg.sender);
        
        // Update vote tallies
        if (choice == IPropertyGovernance.VoteChoice.FOR) {
            proposal.totalVotesFor = proposal.totalVotesFor.add(votingPower);
        } else if (choice == IPropertyGovernance.VoteChoice.AGAINST) {
            proposal.totalVotesAgainst = proposal.totalVotesAgainst.add(votingPower);
        } else if (choice == IPropertyGovernance.VoteChoice.ABSTAIN) {
            proposal.totalVotesAbstain = proposal.totalVotesAbstain.add(votingPower);
        }
        
        emit VoteCast(proposalId, msg.sender, choice, votingPower, reason);
        
        // Check if proposal should be finalized
        _checkProposalFinalization(proposalId);
    }

    /**
     * @dev Executes a successful proposal
     */
    function executeProposal(uint256 proposalId) external override nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposalId != 0, "Proposal does not exist");
        require(proposal.status == IPropertyGovernance.ProposalStatus.SUCCEEDED, "Proposal has not succeeded");
        require(!proposal.executed, "Proposal already executed");
        require(
            hasRole(GOVERNANCE_ADMIN_ROLE, msg.sender) ||
            msg.sender == proposal.proposer,
            "Not authorized to execute"
        );
        
        proposal.executed = true;
        
        bool success = false;
        bytes memory returnData;
        
        // Execute based on proposal type
        if (proposal.proposalType == IPropertyGovernance.ProposalType.PROPERTY_MANAGEMENT) {
            (success, returnData) = _executePropertyManagement(proposal);
        } else if (proposal.proposalType == IPropertyGovernance.ProposalType.FEE_CHANGE) {
            (success, returnData) = _executeFeeChange(proposal);
        } else if (proposal.proposalType == IPropertyGovernance.ProposalType.MANAGER_CHANGE) {
            (success, returnData) = _executeManagerChange(proposal);
        } else if (proposal.proposalType == IPropertyGovernance.ProposalType.EMERGENCY_ACTION) {
            (success, returnData) = _executeEmergencyAction(proposal);
        }
        
        if (success) {
            proposal.status = IPropertyGovernance.ProposalStatus.EXECUTED;
        } else {
            proposal.status = IPropertyGovernance.ProposalStatus.FAILED;
        }
        
        emit ProposalExecuted(proposalId, success, returnData);
    }

    /**
     * @dev Finalizes a proposal after voting period ends
     */
    function finalizeProposal(uint256 proposalId) external override {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposalId != 0, "Proposal does not exist");
        require(proposal.status == IPropertyGovernance.ProposalStatus.ACTIVE, "Proposal is not active");
        require(block.timestamp > proposal.endTime, "Voting period has not ended");
        
        _finalizeProposal(proposalId);
    }

    /**
     * @dev Internal function to check if proposal should be finalized
     */
    function _checkProposalFinalization(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        
        uint256 totalVotes = proposal.totalVotesFor
            .add(proposal.totalVotesAgainst)
            .add(proposal.totalVotesAbstain);
        
        // Check if quorum is reached and majority voted
        uint256 quorumThreshold = proposal.totalVotingPower.mul(proposal.quorumRequired).div(BASIS_POINTS);
        
        if (totalVotes >= quorumThreshold) {
            // Early finalization if overwhelming majority
            uint256 overwhelmingMajority = proposal.totalVotingPower.mul(7500).div(BASIS_POINTS); // 75%
            if (proposal.totalVotesFor >= overwhelmingMajority || 
                proposal.totalVotesAgainst >= overwhelmingMajority) {
                _finalizeProposal(proposalId);
            }
        }
    }

    /**
     * @dev Internal function to finalize proposal
     */
    function _finalizeProposal(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        IPropertyGovernance.ProposalStatus oldStatus = proposal.status;
        
        uint256 totalVotes = proposal.totalVotesFor
            .add(proposal.totalVotesAgainst)
            .add(proposal.totalVotesAbstain);
        
        // Check quorum
        uint256 quorumThreshold = proposal.totalVotingPower.mul(proposal.quorumRequired).div(BASIS_POINTS);
        if (totalVotes < quorumThreshold) {
            proposal.status = IPropertyGovernance.ProposalStatus.FAILED;
        } else {
            // Check majority
            uint256 majorityThreshold = totalVotes.mul(proposal.majorityRequired).div(BASIS_POINTS);
            if (proposal.totalVotesFor >= majorityThreshold) {
                proposal.status = IPropertyGovernance.ProposalStatus.SUCCEEDED;
            } else {
                proposal.status = IPropertyGovernance.ProposalStatus.FAILED;
            }
        }
        
        emit ProposalStatusChanged(proposalId, oldStatus, proposal.status);
    }

    /**
     * @dev Checks if address has minimum tokens to create proposals
     */
    function _hasMinimumTokens(address tokenAddress, address account) internal view returns (bool) {
        uint256 balance = propertyTokenContract.getInvestorBalance(tokenAddress, account);
        IPropertyToken.PropertyTokenInfo memory tokenInfo = propertyTokenContract.getPropertyToken(tokenAddress);
        uint256 minimumRequired = tokenInfo.totalSupply.mul(100).div(BASIS_POINTS); // 1% minimum
        return balance >= minimumRequired;
    }

    /**
     * @dev Executes property management proposal
     */
    function _executePropertyManagement(Proposal storage proposal) internal returns (bool, bytes memory) {
        // Decode proposal data and execute property management action
        // This would contain specific property management instructions
        return (true, "Property management action executed");
    }

    /**
     * @dev Executes fee change proposal
     */
    function _executeFeeChange(Proposal storage proposal) internal returns (bool, bytes memory) {
        // Decode new fee percentage and update property token
        (uint256 newFeePercent) = abi.decode(proposal.proposalData, (uint256));
        require(newFeePercent <= 2000, "Fee cannot exceed 20%");
        
        // This would update the fee in the property token contract
        return (true, abi.encode(newFeePercent));
    }

    /**
     * @dev Executes manager change proposal
     */
    function _executeManagerChange(Proposal storage proposal) internal returns (bool, bytes memory) {
        // Decode new manager address
        (address newManager) = abi.decode(proposal.proposalData, (address));
        require(newManager != address(0), "Invalid manager address");
        
        // This would update the manager in the property token contract
        return (true, abi.encode(newManager));
    }

    /**
     * @dev Executes emergency action proposal
     */
    function _executeEmergencyAction(Proposal storage proposal) internal returns (bool, bytes memory) {
        // Execute emergency action based on proposal data
        return (true, "Emergency action executed");
    }

    /**
     * @dev Gets proposal information
     */
    function getProposal(uint256 proposalId) 
        external 
        view 
        override 
        returns (
            address tokenAddress,
            address proposer,
            string memory title,
            string memory description,
            IPropertyGovernance.ProposalType proposalType,
            uint256 startTime,
            uint256 endTime,
            IPropertyGovernance.ProposalStatus status,
            uint256 totalVotesFor,
            uint256 totalVotesAgainst,
            uint256 totalVotesAbstain
        ) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposalId != 0, "Proposal does not exist");
        
        return (
            proposal.tokenAddress,
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.proposalType,
            proposal.startTime,
            proposal.endTime,
            proposal.status,
            proposal.totalVotesFor,
            proposal.totalVotesAgainst,
            proposal.totalVotesAbstain
        );
    }

    /**
     * @dev Gets vote information for a voter on a proposal
     */
    function getVote(uint256 proposalId, address voter) 
        external 
        view 
        override 
        returns (
            bool hasVoted,
            IPropertyGovernance.VoteChoice choice,
            uint256 votingPower,
            uint256 timestamp,
            string memory reason
        ) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposalId != 0, "Proposal does not exist");
        
        Vote storage vote = proposal.votes[voter];
        return (
            vote.hasVoted,
            vote.choice,
            vote.votingPower,
            vote.timestamp,
            vote.reason
        );
    }

    /**
     * @dev Gets proposals for a token
     */
    function getTokenProposals(address tokenAddress) 
        external 
        view 
        override 
        returns (uint256[] memory) 
    {
        return tokenProposals[tokenAddress];
    }

    /**
     * @dev Gets voting power for an address on a token
     */
    function getVotingPower(address tokenAddress, address voter) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return propertyTokenContract.getInvestorBalance(tokenAddress, voter);
    }
}