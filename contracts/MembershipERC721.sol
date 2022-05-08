// SPDX-License-Identifier:
pragma solidity ^0.8.0;

import "./fractional/OpenZeppelin/access/Ownable.sol";
import "./fractional/OpenZeppelin/token/ERC721/ERC721.sol";
import "./fractional/OpenZeppelin/token/ERC20/IERC20.sol";

contract MembershipERC721 is ERC721, Ownable {
    IERC20 public erc20;

    constructor(
        string memory name_,
        string memory symbol_,
        address erc20_,
        string baseURI_
    ) ERC721(name_, symbol_) {
        _setBaseURI(baseURI_);
        erc20 = IERC20(erc20_);
    }

    enum Tier {
        GENESIS,
        FOUNDATION,
        FRIEND
    }

    struct TierTracker {
        uint16 currId;
        uint16 maxId;
        uint16 price;
        uint16[] refundedIds;
    }

    // TODO: convert to mapping
    TierTracker[3] private tiers = [
        TierTracker({currId: 0, maxId: 99, price: 40000, refundedIds: []}),
        TierTracker({currId: 100, maxId: 1099, price: 4000, refundedIds: []}),
        TierTracker({currId: 1100, maxId: 11099, price: 400, refundedIds: []})
    ];

    function _nextID(Tier tier_) private returns (uint16 memory) {
        TierTracker memory tier = tiers[tier_];
        uint16 memory res;

        if (tiers[tier].currId < tiers[tier].maxId) {
            res = tier.currId;
            tier.currId++;
        } else {
            res = tier.refundedIds.pop();
        }

        return res;
    }
}
