// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IHederaTokenService.sol";
import "./interfaces/IPropertyToken.sol";
import "./security/AccessControl.sol";
import "./security/ReentrancyGuard.sol";
import "./utils/SafeMath.sol";

/**
 * @title PropertyToken
 * @dev Smart contract for tokenizing real estate properties using Hedera Token Service (HTS)
 * Implements property tokenization with metadata management and supply control
 */
contract PropertyToken is IPropertyToken, AccessControl, ReentrancyGuard {
    using SafeMath for uint256;

    // Hedera Token Service precompiled contract address
    address constant HTS_PRECOMPILED = address(0x167);
    
    // Role definitions
    bytes32 public constant PROPERTY_MANAGER_ROLE = keccak256("PROPERTY_MANAGER_ROLE");
    bytes32 public constant TOKENIZER_ROLE = keccak256("TOKENIZER_ROLE");
    
    // Use interface types directly
    
    // Mappings
    mapping(address => IPropertyToken.PropertyTokenInfo) public propertyTokens;
    mapping(address => IPropertyToken.PropertyMetadata) public propertyMetadata;
    mapping(address => mapping(address => uint256)) public investorBalances;
    mapping(address => address[]) public managerProperties;
    mapping(string => address) public propertyIdToToken;
    
    // Arrays for enumeration
    address[] public allTokens;
    
    // Events are defined in the interface

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(TOKENIZER_ROLE, msg.sender);
    }

    /**
     * @dev Creates a new property token using Hedera Token Service
     * @param propertyId Unique identifier for the property
     * @param name Token name
     * @param symbol Token symbol
     * @param totalSupply Total number of tokens to create
     * @param pricePerToken Price per token in smallest unit
     * @param propertyManager Address of the property manager
     * @param managementFeePercent Management fee in basis points
     * @param metadataURI URI pointing to property metadata
     * @param propertyType Type of property (residential, commercial, etc.)
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
        IPropertyToken.PropertyType propertyType
    ) external override onlyRole(TOKENIZER_ROLE) nonReentrant returns (address) {
        require(bytes(propertyId).length > 0, "Property ID cannot be empty");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(totalSupply > 0, "Total supply must be greater than 0");
        require(pricePerToken > 0, "Price per token must be greater than 0");
        require(propertyManager != address(0), "Invalid property manager address");
        require(managementFeePercent <= 2000, "Management fee cannot exceed 20%"); // Max 20%
        require(propertyIdToToken[propertyId] == address(0), "Property ID already exists");

        // Create HTS token
        address tokenAddress = _createHederaToken(name, symbol, totalSupply);
        
        // Store property token information
        IPropertyToken.PropertyTokenInfo storage tokenInfo = propertyTokens[tokenAddress];
        tokenInfo.tokenAddress = tokenAddress;
        tokenInfo.propertyId = propertyId;
        tokenInfo.name = name;
        tokenInfo.symbol = symbol;
        tokenInfo.totalSupply = totalSupply;
        tokenInfo.pricePerToken = pricePerToken;
        tokenInfo.propertyManager = propertyManager;
        tokenInfo.managementFeePercent = managementFeePercent;
        tokenInfo.isActive = true;
        tokenInfo.metadataURI = metadataURI;
        tokenInfo.createdAt = block.timestamp;
        tokenInfo.propertyType = propertyType;
        tokenInfo.status = IPropertyToken.PropertyStatus.ACTIVE;
        
        // Update mappings
        propertyIdToToken[propertyId] = tokenAddress;
        managerProperties[propertyManager].push(tokenAddress);
        allTokens.push(tokenAddress);
        
        // Grant property manager role for this specific token
        _grantRole(PROPERTY_MANAGER_ROLE, propertyManager);
        
        emit PropertyTokenCreated(tokenAddress, propertyId, name, totalSupply, propertyManager);
        
        return tokenAddress;
    }

    /**
     * @dev Internal function to create Hedera token using HTS
     */
    function _createHederaToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) internal returns (address) {
        // Prepare HTS token creation parameters
        IHederaTokenService.HederaToken memory token;
        token.name = name;
        token.symbol = symbol;
        token.treasury = address(this);
        token.memo = "GlobalLand Property Token";
        token.tokenSupplyType = true; // FINITE
        token.maxSupply = int64(int256(totalSupply));
        token.freezeDefault = false;
        
        // Token keys - only supply key needed for minting
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = IHederaTokenService.TokenKey(1, false, address(this), "", ""); // SUPPLY_KEY
        
        // Create token
        (int responseCode, address tokenAddress) = IHederaTokenService(HTS_PRECOMPILED)
            .createFungibleToken(token, totalSupply, 0);
            
        require(responseCode == 22, "Token creation failed"); // SUCCESS = 22
        
        return tokenAddress;
    }

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
    ) external override {
        require(propertyTokens[tokenAddress].isActive, "Token does not exist");
        require(
            hasRole(PROPERTY_MANAGER_ROLE, msg.sender) || 
            propertyTokens[tokenAddress].propertyManager == msg.sender,
            "Not authorized to update metadata"
        );
        
        IPropertyToken.PropertyMetadata storage metadata = propertyMetadata[tokenAddress];
        metadata.location = location;
        metadata.valuation = valuation;
        metadata.expectedYield = expectedYield;
        metadata.documentHashes = documentHashes;
        metadata.lastUpdated = block.timestamp;
        
        propertyTokens[tokenAddress].metadataURI = metadataURI;
        
        emit PropertyMetadataUpdated(tokenAddress, metadataURI, block.timestamp);
    }

    /**
     * @dev Transfers tokens between addresses using HTS
     */
    function transferTokens(
        address tokenAddress,
        address from,
        address to,
        uint256 amount
    ) external override nonReentrant {
        require(propertyTokens[tokenAddress].isActive, "Token does not exist");
        require(from != address(0) && to != address(0), "Invalid addresses");
        require(amount > 0, "Amount must be greater than 0");
        require(
            msg.sender == from || 
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized to transfer"
        );
        
        // Use HTS transfer
        int responseCode = IHederaTokenService(HTS_PRECOMPILED)
            .transferToken(tokenAddress, from, to, int64(int256(amount)));
            
        require(responseCode == 22, "Transfer failed");
        
        // Update internal balances
        investorBalances[tokenAddress][from] = investorBalances[tokenAddress][from].sub(amount);
        investorBalances[tokenAddress][to] = investorBalances[tokenAddress][to].add(amount);
        
        emit TokensTransferred(tokenAddress, from, to, amount);
    }

    /**
     * @dev Updates property status
     */
    function updatePropertyStatus(
        address tokenAddress,
        IPropertyToken.PropertyStatus newStatus
    ) external override {
        require(propertyTokens[tokenAddress].isActive, "Token does not exist");
        require(
            hasRole(PROPERTY_MANAGER_ROLE, msg.sender) || 
            propertyTokens[tokenAddress].propertyManager == msg.sender,
            "Not authorized"
        );
        
        IPropertyToken.PropertyStatus oldStatus = propertyTokens[tokenAddress].status;
        propertyTokens[tokenAddress].status = newStatus;
        
        emit PropertyStatusUpdated(tokenAddress, oldStatus, newStatus);
    }

    /**
     * @dev Gets property token information
     */
    function getPropertyToken(address tokenAddress) 
        external 
        view 
        override 
        returns (IPropertyToken.PropertyTokenInfo memory) 
    {
        require(propertyTokens[tokenAddress].isActive, "Token does not exist");
        return propertyTokens[tokenAddress];
    }

    /**
     * @dev Gets property metadata
     */
    function getPropertyMetadata(address tokenAddress) 
        external 
        view 
        override 
        returns (IPropertyToken.PropertyMetadata memory) 
    {
        require(propertyTokens[tokenAddress].isActive, "Token does not exist");
        return propertyMetadata[tokenAddress];
    }

    /**
     * @dev Gets investor balance for a specific token
     */
    function getInvestorBalance(address tokenAddress, address investor) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return investorBalances[tokenAddress][investor];
    }

    /**
     * @dev Gets all properties managed by a specific manager
     */
    function getManagerProperties(address manager) 
        external 
        view 
        override 
        returns (address[] memory) 
    {
        return managerProperties[manager];
    }

    /**
     * @dev Gets total number of property tokens
     */
    function getTotalTokens() external view override returns (uint256) {
        return allTokens.length;
    }

    /**
     * @dev Gets property token by index
     */
    function getTokenByIndex(uint256 index) external view override returns (address) {
        require(index < allTokens.length, "Index out of bounds");
        return allTokens[index];
    }

    /**
     * @dev Gets property token by property ID
     */
    function getTokenByPropertyId(string memory propertyId) 
        external 
        view 
        override 
        returns (address) 
    {
        return propertyIdToToken[propertyId];
    }
}