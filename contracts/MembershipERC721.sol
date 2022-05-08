// SPDX-License-Identifier:
pragma solidity ^0.8.0;

import "./fractional/OpenZeppelin/access/Ownable.sol";
import "./fractional/OpenZeppelin/token/ERC721/ERC721.sol";
import "./fractional/OpenZeppelin/token/ERC20/IERC20.sol";

contract MembershipERC721 is ERC721, Ownable {
    IERC20 public erc20;

    enum TierType {
        GENESIS,
        FOUNDATION,
        FRIEND
    }

    struct Tier {
        uint16 currId;
        uint16 maxId;
        uint16 price;
        uint16[] refundedIds;
    }

    mapping(TierType => Tier) private tiers;

    constructor(
        string memory name_,
        string memory symbol_,
        address erc20_,
        string memory baseURI_
    ) ERC721(name_, symbol_) {
        _setBaseURI(baseURI_);
        erc20 = IERC20(erc20_);

        tiers[TierType.GENESIS] = Tier({
            currId: 0,
            maxId: 99,
            price: 40000,
            refundedIds: []
        });
        tiers[TierType.FOUNDATION] = Tier({
            currId: 100,
            maxId: 1099,
            price: 4000,
            refundedIds: []
        });
        tiers[TierType.FRIEND] = Tier({
            currId: 1100,
            maxId: 11099,
            price: 400,
            refundedIds: []
        });
    }

    function _nextID(TierType tier_) private returns (uint16) {
        Tier memory tier = tiers[tier_];
        uint16 res;

        if (tier.currId < tier.maxId) {
            res = tier.currId;
            tier.currId++;
        } else {
            // TODO: check if it is reverted properly
            // TODO: does empty array cause revert as expected?
            res = tier.refundedIds.pop();
        }

        return res;
    }

    function mint(TierType tier_) public {
        Tier memory tier = tiers[tier_];
        uint256 price = tier.price * erc20.decimals();
        require(erc20.balanceOf(msg.sender) >= price, "insufficient balance");
        erc20.approve(address(this), price);
        erc20.transferFrom(msg.sender, address(this), price);
        _safeMint(msg.sender, _nextID());
    }
}
