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

contract ERC721MembershipUpgradeable is
    ERC721BurnableUpgradeable,
    ERC721RoyaltyUpgradeable,
    PartiallyPausableUpgradeable,
    OwnableUpgradeable
{
    string private _membershipBaseURI;
    TokenVault private vault;

    struct Tier {
        uint256 currId;
        uint256 start;
        uint256 end;
        uint256 price;
        uint256[] releasedIds;
    }

    event Redeem(address indexed owner, uint256 indexed id);
    event Release(address indexed owner, uint256 indexed id);

    address private voteDelegatorLogic;

    uint256[] private friendIdStack;
    uint256[] private foundationIdStack;
    uint256[] private genesisIdStack;

    mapping(uint256 => address) public voteDelegators;

    enum TierCode {
        GENESIS,
        FOUNDATION,
        FRIEND
    }
    Tier public friendTier;
    Tier public foundationTier;
    Tier public genesisTier;

    function getTierPrice(TierCode tierCode) public view returns (uint256) {
        Tier storage tier = _getTierByCode(tierCode);
        return tier.price;
    }

    // NOTE: for some reason mappings don't work for this use case
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

        vault = TokenVault(vault_);
        voteDelegatorLogic = voteDelegatorLogic_;

        genesisTier = Tier({
            currId: 0,
            start: 0,
            end: genesisEnd,
            price: 40000 * 10**vault.decimals(),
            releasedIds: friendIdStack
        });

        foundationTier = Tier({
            currId: genesisEnd,
            start: genesisEnd,
            end: foundationEnd,
            price: 4000 * 10**vault.decimals(),
            releasedIds: foundationIdStack
        });

        friendTier = Tier({
            currId: foundationEnd,
            start: foundationEnd,
            end: friendEnd,
            price: 400 * 10**vault.decimals(),
            releasedIds: genesisIdStack
        });
    }

    // TODO: Implement releaseFor
    function release(uint256 id) external {
        require(msg.sender == ownerOf(id), "can only release your own membership");
        Tier storage tier = _getTier(id);

        address voteDelegatorAddress = voteDelegators[id];
        if (voteDelegatorAddress != address(0)) {
            VoteDelegator voteDelegator = VoteDelegator(voteDelegatorAddress);
            voteDelegator.withdraw(msg.sender);
        } else {
            vault.transfer(msg.sender, tier.price);
        }

        tier.releasedIds.push(id);
        emit Release(msg.sender, id);
        burn(id);
    }

    function _baseURI() internal view override returns (string memory) {
        return _membershipBaseURI;
    }

    function setBaseURI(string calldata membershipBaseURI_) external onlyOwner {
        _membershipBaseURI = membershipBaseURI_;
    }

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
            require(tier.currId < tier.end, "cannot mint more tokens at tier");
            id = tier.currId;
            tier.currId++;
        }
        emit Redeem(nftTo, id);
        _safeMint(nftTo, id);

        require(vault.balanceOf(erc20From) >= tier.price, "insufficient balance");
        vault.transferFrom(erc20From, address(this), tier.price);
    }

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

    function updateUserPrice(uint16 nftID, uint256 newPrice) external {
        require(ownerOf(nftID) == msg.sender, "can only delegate votes for sender's membership NFTs");

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
        uint256 amount = tier.price - vault.balanceOf(voteDelegatorAddress);
        vault.transfer(voteDelegatorAddress, amount);
        voteDelegator.updateUserPrice(newPrice);
    }

    function _burn(uint256 tokenId) internal virtual override(ERC721RoyaltyUpgradeable, ERC721Upgradeable) {
        ERC721RoyaltyUpgradeable._burn(tokenId);
    }

    // ERC2981 Royalty functions
    /**
     * @dev See {ERC2981-_setDefaultRoyalty}.
     * Sets the royalty information that all ids in this contract will default to
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /**
     * @dev See {ERC2981-_deleteDefaultRoyalty}.
     */
    function deleteDefaultRoyalty() external onlyOwner {
        _deleteDefaultRoyalty();
    }
}
