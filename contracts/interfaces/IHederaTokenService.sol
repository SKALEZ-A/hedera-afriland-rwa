// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IHederaTokenService
 * @dev Interface for Hedera Token Service precompiled contract
 */
interface IHederaTokenService {
    
    struct HederaToken {
        string name;
        string symbol;
        address treasury;
        string memo;
        bool tokenSupplyType; // true for FINITE, false for INFINITE
        int64 maxSupply;
        bool freezeDefault;
        TokenKey[] tokenKeys;
        Expiry expiry;
    }

    struct TokenKey {
        uint keyType;
        bool inheritAccountKey;
        address contractId;
        bytes ed25519;
        bytes ECDSA_secp256k1;
    }

    struct Expiry {
        int64 second;
        address autoRenewAccount;
        int64 autoRenewPeriod;
    }

    struct FixedFee {
        int64 amount;
        address tokenId;
        bool useHbarsForPayment;
        bool useCurrentTokenForPayment;
        address feeCollector;
    }

    struct FractionalFee {
        int64 numerator;
        int64 denominator;
        int64 minimumAmount;
        int64 maximumAmount;
        bool netOfTransfers;
        address feeCollector;
    }

    struct RoyaltyFee {
        int64 numerator;
        int64 denominator;
        int64 amount;
        address tokenId;
        bool useHbarsForPayment;
        address feeCollector;
    }

    /**
     * @dev Creates a fungible token
     */
    function createFungibleToken(
        HederaToken memory token,
        uint256 initialTotalSupply,
        uint32 decimals
    ) external returns (int responseCode, address tokenAddress);

    /**
     * @dev Creates a non-fungible token
     */
    function createNonFungibleToken(
        HederaToken memory token
    ) external returns (int responseCode, address tokenAddress);

    /**
     * @dev Transfers tokens
     */
    function transferToken(
        address token,
        address sender,
        address receiver,
        int64 amount
    ) external returns (int responseCode);

    /**
     * @dev Transfers multiple tokens
     */
    function transferTokens(
        address token,
        address[] memory accountIds,
        int64[] memory amounts
    ) external returns (int responseCode);

    /**
     * @dev Mints tokens
     */
    function mintToken(
        address token,
        uint64 amount,
        bytes[] memory metadata
    ) external returns (int responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);

    /**
     * @dev Burns tokens
     */
    function burnToken(
        address token,
        uint64 amount,
        int64[] memory serialNumbers
    ) external returns (int responseCode, uint64 newTotalSupply);

    /**
     * @dev Associates account with token
     */
    function associateToken(
        address account,
        address token
    ) external returns (int responseCode);

    /**
     * @dev Associates account with multiple tokens
     */
    function associateTokens(
        address account,
        address[] memory tokens
    ) external returns (int responseCode);

    /**
     * @dev Dissociates account from token
     */
    function dissociateToken(
        address account,
        address token
    ) external returns (int responseCode);

    /**
     * @dev Gets token information
     */
    function getTokenInfo(
        address token
    ) external returns (int responseCode, HederaToken memory tokenInfo);

    /**
     * @dev Gets fungible token information
     */
    function getFungibleTokenInfo(
        address token
    ) external returns (int responseCode, HederaToken memory tokenInfo, uint32 decimals);

    /**
     * @dev Gets non-fungible token information
     */
    function getNonFungibleTokenInfo(
        address token,
        int64 serialNumber
    ) external returns (int responseCode, HederaToken memory tokenInfo, bytes memory metadata);

    /**
     * @dev Gets token default freeze status
     */
    function getTokenDefaultFreezeStatus(
        address token
    ) external returns (int responseCode, bool freezeStatus);

    /**
     * @dev Gets token default KYC status
     */
    function getTokenDefaultKycStatus(
        address token
    ) external returns (int responseCode, bool kycStatus);

    /**
     * @dev Freezes token for account
     */
    function freezeToken(
        address token,
        address account
    ) external returns (int responseCode);

    /**
     * @dev Unfreezes token for account
     */
    function unfreezeToken(
        address token,
        address account
    ) external returns (int responseCode);

    /**
     * @dev Grants KYC to account for token
     */
    function grantTokenKyc(
        address token,
        address account
    ) external returns (int responseCode);

    /**
     * @dev Revokes KYC from account for token
     */
    function revokeTokenKyc(
        address token,
        address account
    ) external returns (int responseCode);

    /**
     * @dev Pauses token
     */
    function pauseToken(
        address token
    ) external returns (int responseCode);

    /**
     * @dev Unpauses token
     */
    function unpauseToken(
        address token
    ) external returns (int responseCode);

    /**
     * @dev Wipes token from account
     */
    function wipeTokenAccount(
        address token,
        address account,
        uint32 amount
    ) external returns (int responseCode);

    /**
     * @dev Updates token information
     */
    function updateTokenInfo(
        address token,
        HederaToken memory tokenInfo
    ) external returns (int responseCode);

    /**
     * @dev Updates token keys
     */
    function updateTokenKeys(
        address token,
        TokenKey[] memory keys
    ) external returns (int responseCode);

    /**
     * @dev Deletes token
     */
    function deleteToken(
        address token
    ) external returns (int responseCode);
}