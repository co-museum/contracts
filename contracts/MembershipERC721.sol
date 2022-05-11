// SPDX-License-Identifier:
pragma solidity ^0.8.0;

import "./fractional/OpenZeppelin/access/Ownable.sol";
import "./fractional/OpenZeppelin/token/ERC721/ERC721.sol";
import "./fractional/OpenZeppelin/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract MembershipERC721 is ERC721, Ownable {
    IERC20 public erc20;

    enum TierType {
        GENESIS,
        FOUNDATION,
        FRIEND
    }

    struct Tier {
        TierType tierType;
        uint16 currId;
        uint16 maxId;
        uint16 price;
        uint16[] refundedIds;
    }

    uint16[] refundedIdGenesis;
    uint16[] refundedIdFoundation;
    uint16[] refundedIdFriends;

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
            tierType: TierType.GENESIS,
            currId: 0,
            maxId: 99,
            price: 40000,
            refundedIds: refundedIdGenesis
        });
        tiers[TierType.FOUNDATION] = Tier({
            tierType: TierType.FOUNDATION,
            currId: 100,
            maxId: 1099,
            price: 4000,
            refundedIds: refundedIdFoundation
        });
        tiers[TierType.FRIEND] = Tier({
            tierType: TierType.FRIEND,
            currId: 1100,
            maxId: 11099,
            price: 400,
            refundedIds: refundedIdFriends
        });
    }

    function _nextID(TierType tier_) private returns (uint16) {
        Tier memory tier = tiers[tier_];
        uint16 res;

        refundedIdFriends.push(1);

        if (tier.currId < tier.maxId) {
            res = tier.currId;
            tier.currId++;
        } else {
            // TODO: check if it is reverted properly
            // TODO: does empty array cause revert as expected?
            // res = tier.refundedIds.pop();
        }

        return res;
    }

    function redeem(TierType tier_) public {
        console.log("HEREEE");
        console.log("Message Sender", msg.sender);
        console.log(
            "ERC20 balance of message sender",
            erc20.balanceOf(msg.sender)
        );
        Tier memory tier = tiers[tier_];
        uint256 price = tier.price;
        console.log("Price of tier", price);

        require(erc20.balanceOf(msg.sender) >= price, "insufficient balance");
        erc20.transferFrom(msg.sender, address(this), price);
        _safeMint(msg.sender, _nextID(tier.tierType));
    }
}
