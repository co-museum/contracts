// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../lib/PartiallyPausableUpgradeable.sol";

interface IERC20Decimal is IERC20 {
    function decimals() external view returns (uint8);
}

contract MembershipERC721 is ERC721BurnableUpgradeable, PartiallyPausableUpgradeable, OwnableUpgradeable {
    IERC20Decimal public erc20;
    string private _membershipBaseURI;

    struct Tier {
        uint16 currId;
        uint16 start;
        uint16 end;
        uint256 price;
        uint16[] releasedIds;
    }

    event Redeem(address indexed owner, uint16 indexed id);
    event Release(address indexed owner, uint16 indexed id);

    uint16[] private friendIdStack;
    uint16[] private foundationIdStack;
    uint16[] private genesisIdStack;

    Tier public friendTier;
    Tier public foundationTier;
    Tier public genesisTier;

    function getTier(uint16 id) private view returns (Tier storage) {
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
        address erc20_,
        uint16 genesisEnd,
        uint16 foundationEnd,
        uint16 friendEnd
    ) external initializer {
        __ERC721_init(name_, symbol_);
        __Ownable_init_unchained();
        __PartiallyPausableUpgradeable_init(owner());


       erc20 = IERC20Decimal(erc20_);

        genesisTier = Tier({
            currId: 0,
            start: 0,
            end: genesisEnd,
            price: 40000 * 10**erc20.decimals(),
            releasedIds: friendIdStack
        });

        foundationTier = Tier({
            currId: genesisEnd,
            start: genesisEnd,
            end: foundationEnd,
            price: 4000 * 10**erc20.decimals(),
            releasedIds: foundationIdStack
        });

        friendTier = Tier({
            currId: foundationEnd,
            start: foundationEnd,
            end: friendEnd,
            price: 400 * 10**erc20.decimals(),
            releasedIds: genesisIdStack
        });
    }

    function release(uint16 id) external {
        Tier storage tier = getTier(id);
        erc20.transfer(msg.sender, tier.price);
        tier.releasedIds.push(id);
        emit Release(msg.sender, id);
        burn(id);
    }

    function redeemGenesis() external {
        _redeem(genesisTier);
    }

    function redeemFoundation() external {
        _redeem(foundationTier);
    }

    function redeemFriend() external {
        _redeem(friendTier);
    }

    function _baseURI() internal view override returns (string memory) {
        return _membershipBaseURI;
    }

    function setBaseURI(string calldata membershipBaseURI_) external onlyOwner {
        _membershipBaseURI = membershipBaseURI_;
    }

    function _redeem(Tier storage tier) private {
        uint16 id;
        if (tier.releasedIds.length > 0) {
            id = tier.releasedIds[tier.releasedIds.length - 1];
            tier.releasedIds.pop();
        } else {
            require(tier.currId < tier.end, "cannot mint more tokens at tier");
            id = tier.currId;
            tier.currId++;
        }
        emit Redeem(msg.sender, id);
        _safeMint(msg.sender, id);

        require(
            erc20.balanceOf(msg.sender) >= tier.price,
            "insufficient balance"
        );
        erc20.transferFrom(msg.sender, address(this), tier.price);
    }

    function _beforeTokenTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal virtual override onlySenderWhenPaused {
        super._beforeTokenTransfer(_from, _to, _amount);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControlUpgradeable, ERC721Upgradeable) returns (bool)  {
        return super.supportsInterface(interfaceId);
    }
}
