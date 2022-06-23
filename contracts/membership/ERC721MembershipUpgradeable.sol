// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721RoyaltyUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "../lib/PartiallyPausableUpgradeable.sol";
import "hardhat/console.sol";
import "../fractional/ERC721TokenVault.sol";
import "../fractional/InitializedProxy.sol";
import "./VoteDelegator.sol";

/// @title Membership NFT contract allowing users to redeem memberships in
/// exchange for $ART tokens and release memberships to get $ART tokens back.
/// Allows users to vote on reserve price of NFT locked in TokenVault through
/// VoteDelegator proxies associated with each NFT ID.
contract ERC721MembershipUpgradeable is
    ERC721BurnableUpgradeable,
    ERC721RoyaltyUpgradeable,
    PartiallyPausableUpgradeable,
    OwnableUpgradeable
{
    /// @dev metadata url prefix
    string private _membershipBaseURI;
    /// @return vault address of associated token vault
    address public vault;

    /// @notice membership tier abstraction
    /// @param currId the ID about to be redeemed (barring any released IDs)
    /// @param start starting ID (inclusive) of tier
    /// @param end ending ID (exclusive) of tier
    /// @param price price of tier in terms of $ART token
    /// @param releasedIds stack of IDs users released (all must be redeemed
    /// again before currId is redeemed)
    struct Tier {
        uint256 currId;
        uint256 start;
        uint256 end;
        uint256 price;
        uint256[] releasedIds;
    }

    /// @notice trigerred after successful redemption of membership NFT
    /// @param owner address of owner of redeemed NFT
    /// @param id ID of redeemed NFT
    event Redeem(address indexed owner, uint256 indexed id);

    /// @notice trigerred after successful release of membership NFT
    /// @param owner address of owner of redeemed NFT
    /// @param id ID of released NFT
    event Release(address indexed owner, uint256 indexed id);

    /// Lets make this public?
    address private voteDelegatorLogic;

    /// @dev Arrays holding released NFT Ids for each tier
    uint256[] private friendIdStack;
    uint256[] private foundationIdStack;
    uint256[] private genesisIdStack;

    /// @return voteDelegators Returns address to VoteDelegator proxy contract for a given NFT ID
    mapping(uint256 => address) public voteDelegators;

    /// @notice Enum representing the different tiers of membership
    /// @dev GENESIS tier code is 0, FOUNDATION is 1, and, FRIEND is 2
    enum TierCode {
        GENESIS,
        FOUNDATION,
        FRIEND
    }

    /// @notice Returns a tuple with (currId, start, end, price)
    Tier public friendTier;
    Tier public foundationTier;
    Tier public genesisTier;

    /// @notice Returns tierPrice for tierCode
    /// @param tierCode Code for tier
    /// @return price Returns price of given tier
    function getTierPrice(TierCode tierCode) public view returns (uint256) {
        Tier storage tier = _getTierByCode(tierCode);
        return tier.price;
    }

    /// @dev mappings don't work for this use case (storage state is not updated)
    /// @dev Gives tier details given tierCode
    /// @param tierCode Code for tier
    /// @return Tier tier details
    function _getTierByCode(TierCode tierCode) internal view returns (Tier storage) {
        if (tierCode == TierCode.GENESIS) {
            return genesisTier;
        }
        if (tierCode == TierCode.FOUNDATION) {
            return foundationTier;
        }
        if (tierCode == TierCode.FRIEND) {
            return friendTier;
        }

        revert("tier code out of range");
    }

    /// @dev Gives tier details given NFT id
    /// @param id NFT id
    /// @return Tier tier details
    function _getTier(uint256 id) internal view returns (Tier storage) {
        if (id < genesisTier.end) {
            return genesisTier;
        }
        if (id < foundationTier.end) {
            return foundationTier;
        }
        if (id < friendTier.end) {
            return friendTier;
        }

        revert("id out of range");
    }

    /// @param name_ name of membership NFT
    /// @param symbol_ symbol of NFT
    /// @param vault_ address of token vault to cast votes in
    /// @param voteDelegatorLogic_ address of logic contract for voteDelegator
    /// @param genesisEnd end of genesis membership NFT IDs
    /// @param foundationEnd end of foundation membership NFT IDs
    /// @param friendEnd end of friend membership NFT IDs
    function initialize(
        string memory name_,
        string memory symbol_,
        address vault_,
        address voteDelegatorLogic_,
        uint256 genesisEnd,
        uint256 foundationEnd,
        uint256 friendEnd
    ) external initializer {
        __ERC721_init(name_, symbol_);
        __Ownable_init();
        __PartiallyPausableUpgradeable_init(owner());

        vault = vault_;
        voteDelegatorLogic = voteDelegatorLogic_;

        genesisTier = Tier({
            currId: 0,
            start: 0,
            end: genesisEnd,
            price: 40000 * 10**TokenVault(vault).decimals(),
            releasedIds: friendIdStack
        });

        foundationTier = Tier({
            currId: genesisEnd,
            start: genesisEnd,
            end: foundationEnd,
            price: 4000 * 10**TokenVault(vault).decimals(),
            releasedIds: foundationIdStack
        });

        friendTier = Tier({
            currId: foundationEnd,
            start: foundationEnd,
            end: friendEnd,
            price: 400 * 10**TokenVault(vault).decimals(),
            releasedIds: genesisIdStack
        });
    }

    /// @dev source address parameter is omitted as function is only used by end users
    /// @notice Releases membership NFTs and sends msg.sender $ART tokens
    /// @param id NFT id
    function release(uint256 id) external {
        require(msg.sender == ownerOf(id), "membership:can only release your own membership");
        Tier storage tier = _getTier(id);

        address voteDelegatorAddress = voteDelegators[id];
        if (voteDelegatorAddress != address(0)) {
            VoteDelegator voteDelegator = VoteDelegator(voteDelegatorAddress);
            voteDelegator.withdraw(msg.sender);
        } else {
            TokenVault(vault).transfer(msg.sender, tier.price);
        }

        tier.releasedIds.push(id);
        emit Release(msg.sender, id);
        burn(id);
    }

    /// @return _membershipBaseURI
    function _baseURI() internal view override returns (string memory) {
        return _membershipBaseURI;
    }

    /// @notice set _membershipBaseURI (reveal collection)
    /// @param membershipBaseURI_ base URI
    function setBaseURI(string calldata membershipBaseURI_) external onlyOwner {
        _membershipBaseURI = membershipBaseURI_;
    }

    /// @notice redeem membership associated with tierCode
    /// @param tierCode tier code associated with tier by _getTierByCode
    /// @param nftTo to send membership to (only != msg.sender in Crowdsale contract)
    function redeem(
        TierCode tierCode,
        address erc20From,
        address nftTo
    ) public {
        uint256 id;
        Tier storage tier = _getTierByCode(tierCode);

        if (tier.releasedIds.length > 0) {
            id = tier.releasedIds[tier.releasedIds.length - 1];
            tier.releasedIds.pop();
        } else {
            require(tier.currId < tier.end, "membership:cannot mint more tokens at tier");
            id = tier.currId;
            tier.currId++;
        }
        emit Redeem(nftTo, id);
        _safeMint(nftTo, id);

        require(TokenVault(vault).balanceOf(erc20From) >= tier.price, "membership:insufficient balance");
        TokenVault(vault).transferFrom(erc20From, address(this), tier.price);
    }

    /// @notice witdraws funds from vote delegator proxy on token transfer to
    /// make token vault update the reserve price
    function _beforeTokenTransfer(
        address _from,
        address _to,
        uint256 _tokenId
    ) internal virtual override onlySenderWhenPaused {
        super._beforeTokenTransfer(_from, _to, _tokenId);
        // only run when not minting and not burning
        address voteDelegatorAddress = voteDelegators[_tokenId];
        // do not withdraw if there is no vote delegator, when minting, or when burning
        if (voteDelegatorAddress != address(0) && _from != address(0) && _to != address(0)) {
            VoteDelegator voteDelegator = VoteDelegator(voteDelegatorAddress);
            voteDelegator.withdraw(address(this));
        }
    }

    /// @notice make sure ERC165 advertises all inherited interfaces
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlUpgradeable, ERC721Upgradeable, ERC721RoyaltyUpgradeable)
        returns (bool)
    {
        return
            AccessControlUpgradeable.supportsInterface(interfaceId) ||
            ERC721Upgradeable.supportsInterface(interfaceId) ||
            ERC721RoyaltyUpgradeable.supportsInterface(interfaceId);
    }

    /// @notice delegate voting to vote delegator proxy
    /// @param nftID ID of NFT to vote on behalf of
    /// @param newPrice proposed reserve price
    function updateUserPrice(uint16 nftID, uint256 newPrice) external {
        require(ownerOf(nftID) == msg.sender, "membership:can only delegate votes for sender's membership NFTs");

        address voteDelegatorAddress = voteDelegators[nftID];
        // doesn't have vote delegator yet
        if (voteDelegatorAddress == address(0)) {
            bytes memory _initializationCalldata = abi.encodeWithSignature("initialize(address)", vault);

            voteDelegatorAddress = address(new InitializedProxy(voteDelegatorLogic, _initializationCalldata));

            voteDelegators[nftID] = voteDelegatorAddress;
        }

        VoteDelegator voteDelegator = VoteDelegator(voteDelegatorAddress);
        Tier storage tier = _getTier(nftID);
        // 0 if voting again and tier.price if after transfer/mint
        uint256 amount = tier.price - TokenVault(vault).balanceOf(voteDelegatorAddress);
        TokenVault(vault).transfer(voteDelegatorAddress, amount);
        voteDelegator.updateUserPrice(newPrice);
    }

    /// @dev resolve conflict between conflicting inherited contract
    function _burn(uint256 tokenId) internal virtual override(ERC721RoyaltyUpgradeable, ERC721Upgradeable) {
        ERC721RoyaltyUpgradeable._burn(tokenId);
    }

    /// @notice Sets the royalty information that all ids in this contract will default to
    /// @param receiver who the royalty goes to
    /// @param feeNumerator royalty ammount
    /// @dev _feeDenominator defaults to basis points so feeNumerator == 500 <=> 5%
    /// @dev See {ERC2981-_setDefaultRoyalty}.
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /// @notice Deletes the royalty information that all ids in this contract will default to
    /// @dev See {ERC2981-_deleteDefaultRoyalty}.
    function deleteDefaultRoyalty() external onlyOwner {
        _deleteDefaultRoyalty();
    }
}
