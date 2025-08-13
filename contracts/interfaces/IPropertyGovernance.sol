// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPropertyGovernance
 * @dev Interface for property governance contract
 */
interface IPropertyGovernance {
    
    enum ProposalType {
        PROPERTY_MANAGEMENT,
        FEE_CHANGE,
        MANAGER_CHANGE,
        EMERGENCY_ACTION,
        GENERAL
    }
    
    enum ProposalStatus {
        ACTIVE,
        SUCCEEDED,
        FAILED,
        EXECUTED,
        CANCELLED
    }
    
    enum VoteChoice {
        FOR,
        AGAINST,
        ABSTAIN
    }

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed tokenAddress,
        address indexed proposer,
        string title,
        ProposalType proposalType,
        uint256 endTime
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteChoice choice,
        uint256 votingPower,
        string reason
    );
    
    event ProposalExecuted(
        uint256 indexed proposalId,
        bool success,
        bytes returnData
    );
    
    event ProposalStatusChanged(
        uint256 indexed proposalId,
        ProposalStatus oldStatus,
        ProposalStatus newStatus
    );

    /**
     * @dev Creates a new governance proposal
     */
    function createProposal(
        address tokenAddress,
        string memory title,
        string memory description,
        ProposalType proposalType,
        bytes memory proposalData,
        uint256 votingPeriod,
        uint256 quorumRequired,
        uint256 majorityRequired
    ) external returns (uint256);

    /**
     * @dev Casts a vote on a proposal
     */
    function castVote(
        uint256 proposalId,
        VoteChoice choice,
        string memory reason
    ) external;

    /**
     * @dev Executes a successful proposal
     */
    function executeProposal(uint256 proposalId) external;

    /**
     * @dev Finalizes a proposal after voting period ends
     */
    function finalizeProposal(uint256 proposalId) external;

    /**
     * @dev Gets proposal information
     */
    function getProposal(uint256 proposalId) 
        external 
        view 
        returns (
            address tokenAddress,
            address proposer,
            string memory title,
            string memory description,
            ProposalType proposalType,
            uint256 startTime,
            uint256 endTime,
            ProposalStatus status,
            uint256 totalVotesFor,
            uint256 totalVotesAgainst,
            uint256 totalVotesAbstain
        );

    /**
     * @dev Gets vote information for a voter on a proposal
     */
    function getVote(uint256 proposalId, address voter) 
        external 
        view 
        returns (
            bool hasVoted,
            VoteChoice choice,
            uint256 votingPower,
            uint256 timestamp,
            string memory reason
        );

    /**
     * @dev Gets proposals for a token
     */
    function getTokenProposals(address tokenAddress) 
        external 
        view 
        returns (uint256[] memory);

    /**
     * @dev Gets voting power for an address on a token
     */
    function getVotingPower(address tokenAddress, address voter) 
        external 
        view 
        returns (uint256);
}