// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IHederaTokenService.sol";
import "./interfaces/IPropertyToken.sol";
import "./interfaces/IDividendDistributor.sol";
import "./security/AccessControl.sol";
import "./security/ReentrancyGuard.sol";
import "./utils/SafeMath.sol";

/**
 * @title DividendDistributor
 * @dev Smart contract for distributing rental income dividends to property token holders
 * Implements proportional distribution based on token holdings
 */
contract DividendDistributor is IDividendDistributor, AccessControl, ReentrancyGuard {
    using SafeMath for uint256;

    // Hedera Token Service precompiled contract address
    address constant HTS_PRECOMPILED = address(0x167);
    
    // Role definitions
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant PROPERTY_MANAGER_ROLE = keccak256("PROPERTY_MANAGER_ROLE");
    
    // Property token contract reference
    IPropertyToken public immutable propertyTokenContract;
    
    // Distribution structure
    struct DividendDistribution {
        uint256 distributionId;
        address tokenAddress;
        uint256 totalAmount;
        uint256 totalTokenSupply;
        uint256 distributionDate;
        uint256 managementFeePercent;
        uint256 managementFeeAmount;
        uint256 netDistributionAmount;
        IDividendDistributor.DistributionStatus status;
        mapping(address => uint256) claimedAmounts;
        mapping(address => bool) hasClaimed;
        address[] eligibleHolders;
        uint256[] holderBalances;
    }
    
    // Distribution tracking
    mapping(uint256 => DividendDistribution) public distributions;
    mapping(address => uint256[]) public tokenDistributions; // token -> distribution IDs
    mapping(address => mapping(address => uint256)) public pendingDividends; // token -> holder -> amount
    mapping(address => uint256) public totalDistributed; // token -> total amount
    
    uint256 public nextDistributionId = 1;
    uint256 public constant MAX_HOLDERS_PER_BATCH = 100; // Gas optimization
    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000 basis points
    
    // Events are defined in the interface

    constructor(address _propertyTokenContract) {
        require(_propertyTokenContract != address(0), "Invalid property token contract");
        propertyTokenContract = IPropertyToken(_propertyTokenContract);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DISTRIBUTOR_ROLE, msg.sender);
    }

    /**
     * @dev Creates a new dividend distribution for a property token
     * @param tokenAddress Address of the property token
     * @param totalAmount Total dividend amount to distribute
     */
    function createDistribution(
        address tokenAddress,
        uint256 totalAmount
    ) external override onlyRole(DISTRIBUTOR_ROLE) nonReentrant returns (uint256) {
        require(totalAmount > 0, "Distribution amount must be greater than 0");
        
        // Get property token information
        IPropertyToken.PropertyTokenInfo memory tokenInfo = propertyTokenContract.getPropertyToken(tokenAddress);
        require(tokenInfo.isActive, "Property token is not active");
        
        uint256 distributionId = nextDistributionId++;
        DividendDistribution storage distribution = distributions[distributionId];
        
        // Calculate management fee
        uint256 managementFeeAmount = totalAmount.mul(tokenInfo.managementFeePercent).div(BASIS_POINTS);
        uint256 netDistributionAmount = totalAmount.sub(managementFeeAmount);
        
        // Initialize distribution
        distribution.distributionId = distributionId;
        distribution.tokenAddress = tokenAddress;
        distribution.totalAmount = totalAmount;
        distribution.totalTokenSupply = tokenInfo.totalSupply;
        distribution.distributionDate = block.timestamp;
        distribution.managementFeePercent = tokenInfo.managementFeePercent;
        distribution.managementFeeAmount = managementFeeAmount;
        distribution.netDistributionAmount = netDistributionAmount;
        distribution.status = IDividendDistributor.DistributionStatus.CREATED;
        
        // Add to token distributions
        tokenDistributions[tokenAddress].push(distributionId);
        
        // Collect management fee
        if (managementFeeAmount > 0) {
            _transferHBAR(tokenInfo.propertyManager, managementFeeAmount);
            emit ManagementFeeCollected(tokenAddress, tokenInfo.propertyManager, managementFeeAmount);
        }
        
        emit DividendDistributionCreated(
            distributionId,
            tokenAddress,
            totalAmount,
            netDistributionAmount,
            managementFeeAmount
        );
        
        return distributionId;
    }

    /**
     * @dev Processes dividend distribution in batches to avoid gas limits
     * @param distributionId ID of the distribution to process
     * @param batchSize Number of holders to process in this batch
     */
    function processBatchDistribution(
        uint256 distributionId,
        uint256 batchSize
    ) external override onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        require(batchSize > 0 && batchSize <= MAX_HOLDERS_PER_BATCH, "Invalid batch size");
        
        DividendDistribution storage distribution = distributions[distributionId];
        require(distribution.distributionId != 0, "Distribution does not exist");
        require(
            distribution.status == IDividendDistributor.DistributionStatus.CREATED || 
            distribution.status == IDividendDistributor.DistributionStatus.PROCESSING,
            "Invalid distribution status"
        );
        
        if (distribution.status == IDividendDistributor.DistributionStatus.CREATED) {
            distribution.status = IDividendDistributor.DistributionStatus.PROCESSING;
            _loadEligibleHolders(distributionId);
        }
        
        uint256 startIndex = distribution.eligibleHolders.length > batchSize ? 
            distribution.eligibleHolders.length - batchSize : 0;
        uint256 endIndex = distribution.eligibleHolders.length;
        uint256 processedCount = 0;
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            address holder = distribution.eligibleHolders[i];
            uint256 holderBalance = distribution.holderBalances[i];
            
            if (holderBalance > 0 && !distribution.hasClaimed[holder]) {
                uint256 dividendAmount = distribution.netDistributionAmount
                    .mul(holderBalance)
                    .div(distribution.totalTokenSupply);
                
                if (dividendAmount > 0) {
                    pendingDividends[distribution.tokenAddress][holder] = 
                        pendingDividends[distribution.tokenAddress][holder].add(dividendAmount);
                    distribution.claimedAmounts[holder] = dividendAmount;
                    processedCount++;
                }
            }
        }
        
        // Remove processed holders
        for (uint256 i = 0; i < batchSize && distribution.eligibleHolders.length > 0; i++) {
            distribution.eligibleHolders.pop();
            distribution.holderBalances.pop();
        }
        
        // Check if distribution is complete
        if (distribution.eligibleHolders.length == 0) {
            distribution.status = IDividendDistributor.DistributionStatus.COMPLETED;
        }
        
        emit BatchDistributionProcessed(distributionId, startIndex, processedCount);
    }

    /**
     * @dev Allows token holders to claim their pending dividends
     * @param tokenAddress Address of the property token
     */
    function claimDividends(address tokenAddress) external override nonReentrant {
        uint256 pendingAmount = pendingDividends[tokenAddress][msg.sender];
        require(pendingAmount > 0, "No pending dividends");
        
        pendingDividends[tokenAddress][msg.sender] = 0;
        totalDistributed[tokenAddress] = totalDistributed[tokenAddress].add(pendingAmount);
        
        _transferHBAR(msg.sender, pendingAmount);
        
        // Find and mark distributions as claimed
        uint256[] memory distributionIds = tokenDistributions[tokenAddress];
        for (uint256 i = 0; i < distributionIds.length; i++) {
            uint256 distributionId = distributionIds[i];
            DividendDistribution storage distribution = distributions[distributionId];
            
            if (distribution.claimedAmounts[msg.sender] > 0 && !distribution.hasClaimed[msg.sender]) {
                distribution.hasClaimed[msg.sender] = true;
                emit DividendClaimed(distributionId, tokenAddress, msg.sender, distribution.claimedAmounts[msg.sender]);
            }
        }
    }

    /**
     * @dev Loads eligible token holders for a distribution
     */
    function _loadEligibleHolders(uint256 distributionId) internal {
        DividendDistribution storage distribution = distributions[distributionId];
        address tokenAddress = distribution.tokenAddress;
        
        // Get total number of tokens to determine holders
        uint256 totalTokens = propertyTokenContract.getTotalTokens();
        
        // This is a simplified approach - in production, you'd need a more efficient way
        // to track token holders, possibly through events or a separate registry
        for (uint256 i = 0; i < totalTokens; i++) {
            address currentToken = propertyTokenContract.getTokenByIndex(i);
            if (currentToken == tokenAddress) {
                // Get token holders - this would need to be implemented differently
                // as HTS doesn't provide direct holder enumeration
                // For now, we'll use a placeholder approach
                break;
            }
        }
    }

    /**
     * @dev Internal function to transfer HBAR
     */
    function _transferHBAR(address to, uint256 amount) internal {
        require(address(this).balance >= amount, "Insufficient contract balance");
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "HBAR transfer failed");
    }

    /**
     * @dev Gets distribution information
     */
    function getDistribution(uint256 distributionId) 
        external 
        view 
        override 
        returns (
            address tokenAddress,
            uint256 totalAmount,
            uint256 netAmount,
            uint256 managementFee,
            uint256 distributionDate,
            IDividendDistributor.DistributionStatus status
        ) 
    {
        DividendDistribution storage distribution = distributions[distributionId];
        require(distribution.distributionId != 0, "Distribution does not exist");
        
        return (
            distribution.tokenAddress,
            distribution.totalAmount,
            distribution.netDistributionAmount,
            distribution.managementFeeAmount,
            distribution.distributionDate,
            distribution.status
        );
    }

    /**
     * @dev Gets pending dividends for a holder
     */
    function getPendingDividends(address tokenAddress, address holder) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return pendingDividends[tokenAddress][holder];
    }

    /**
     * @dev Gets distribution history for a token
     */
    function getTokenDistributions(address tokenAddress) 
        external 
        view 
        override 
        returns (uint256[] memory) 
    {
        return tokenDistributions[tokenAddress];
    }

    /**
     * @dev Gets total distributed amount for a token
     */
    function getTotalDistributed(address tokenAddress) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return totalDistributed[tokenAddress];
    }

    /**
     * @dev Allows contract to receive HBAR for dividend distributions
     */
    receive() external payable {
        // Contract can receive HBAR for dividend distributions
    }

    /**
     * @dev Emergency function to withdraw contract balance (admin only)
     */
    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
}