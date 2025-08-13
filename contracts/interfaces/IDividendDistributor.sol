// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IDividendDistributor
 * @dev Interface for dividend distribution contract
 */
interface IDividendDistributor {
    
    enum DistributionStatus {
        CREATED,
        PROCESSING,
        COMPLETED,
        CANCELLED
    }

    // Events
    event DividendDistributionCreated(
        uint256 indexed distributionId,
        address indexed tokenAddress,
        uint256 totalAmount,
        uint256 netAmount,
        uint256 managementFee
    );
    
    event DividendClaimed(
        uint256 indexed distributionId,
        address indexed tokenAddress,
        address indexed holder,
        uint256 amount
    );
    
    event BatchDistributionProcessed(
        uint256 indexed distributionId,
        uint256 batchNumber,
        uint256 holdersProcessed
    );
    
    event ManagementFeeCollected(
        address indexed tokenAddress,
        address indexed manager,
        uint256 amount
    );

    /**
     * @dev Creates a new dividend distribution for a property token
     */
    function createDistribution(
        address tokenAddress,
        uint256 totalAmount
    ) external returns (uint256);

    /**
     * @dev Processes dividend distribution in batches to avoid gas limits
     */
    function processBatchDistribution(
        uint256 distributionId,
        uint256 batchSize
    ) external;

    /**
     * @dev Allows token holders to claim their pending dividends
     */
    function claimDividends(address tokenAddress) external;

    /**
     * @dev Gets distribution information
     */
    function getDistribution(uint256 distributionId) 
        external 
        view 
        returns (
            address tokenAddress,
            uint256 totalAmount,
            uint256 netAmount,
            uint256 managementFee,
            uint256 distributionDate,
            DistributionStatus status
        );

    /**
     * @dev Gets pending dividends for a holder
     */
    function getPendingDividends(address tokenAddress, address holder) 
        external 
        view 
        returns (uint256);

    /**
     * @dev Gets distribution history for a token
     */
    function getTokenDistributions(address tokenAddress) 
        external 
        view 
        returns (uint256[] memory);

    /**
     * @dev Gets total distributed amount for a token
     */
    function getTotalDistributed(address tokenAddress) 
        external 
        view 
        returns (uint256);
}