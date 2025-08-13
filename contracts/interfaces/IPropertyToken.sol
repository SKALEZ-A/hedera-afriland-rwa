// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPropertyToken
 * @dev Interface for property tokenization contract
 */
interface IPropertyToken {
    
    enum PropertyType {
        RESIDENTIAL,
        COMMERCIAL,
        INDUSTRIAL,
        MIXED_USE,
        LAND,
        AGRICULTURAL
    }
    
    enum PropertyStatus {
        ACTIVE,
        PENDING,
        SOLD,
        SUSPENDED,
        DELISTED
    }
    
    struct PropertyTokenInfo {
        address tokenAddress;
        string propertyId;
        string name;
        string symbol;
        uint256 totalSupply;
        uint256 pricePerToken;
        address propertyManager;
        uint256 managementFeePercent;
        bool isActive;
        string metadataURI;
        uint256 createdAt;
        PropertyType propertyType;
        PropertyStatus status;
    }
    
    struct PropertyMetadata {
        string location;
        uint256 valuation;
        uint256 expectedYield;
        string[] documentHashes;
        uint256 lastUpdated;
    }

    // Events
    event PropertyTokenCreated(
        address indexed tokenAddress,
        string indexed propertyId,
        string name,
        uint256 totalSupply,
        address indexed propertyManager
    );
    
    event PropertyMetadataUpdated(
        address indexed tokenAddress,
        string metadataURI,
        uint256 timestamp
    );
    
    event TokensTransferred(
        address indexed tokenAddress,
        address indexed from,
        address indexed to,
        uint256 amount
    );
    
    event PropertyStatusUpdated(
        address indexed tokenAddress,
        PropertyStatus oldStatus,
        PropertyStatus newStatus
    );

    /**
     * @dev Creates a new property token
     */
    function createPropertyToken(
        string memory propertyId,
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint256 pricePerToken,
        address propertyManager,
        uint256 managementFeePercent,
        string memory metadataURI,
        PropertyType propertyType
    ) external returns (address);

    /**
     * @dev Updates property metadata
     */
    function updatePropertyMetadata(
        address tokenAddress,
        string memory location,
        uint256 valuation,
        uint256 expectedYield,
        string[] memory documentHashes,
        string memory metadataURI
    ) external;

    /**
     * @dev Transfers tokens between addresses
     */
    function transferTokens(
        address tokenAddress,
        address from,
        address to,
        uint256 amount
    ) external;

    /**
     * @dev Updates property status
     */
    function updatePropertyStatus(
        address tokenAddress,
        PropertyStatus newStatus
    ) external;

    /**
     * @dev Gets property token information
     */
    function getPropertyToken(address tokenAddress) 
        external 
        view 
        returns (PropertyTokenInfo memory);

    /**
     * @dev Gets property metadata
     */
    function getPropertyMetadata(address tokenAddress) 
        external 
        view 
        returns (PropertyMetadata memory);

    /**
     * @dev Gets investor balance for a specific token
     */
    function getInvestorBalance(address tokenAddress, address investor) 
        external 
        view 
        returns (uint256);

    /**
     * @dev Gets all properties managed by a specific manager
     */
    function getManagerProperties(address manager) 
        external 
        view 
        returns (address[] memory);

    /**
     * @dev Gets total number of property tokens
     */
    function getTotalTokens() external view returns (uint256);

    /**
     * @dev Gets property token by index
     */
    function getTokenByIndex(uint256 index) external view returns (address);

    /**
     * @dev Gets property token by property ID
     */
    function getTokenByPropertyId(string memory propertyId) 
        external 
        view 
        returns (address);
}