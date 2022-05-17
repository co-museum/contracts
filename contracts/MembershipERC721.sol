// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./fractional/OpenZeppelin/access/Ownable.sol";
import "./fractional/OpenZeppelin/token/ERC721/ERC721.sol";
import "./fractional/OpenZeppelin/token/ERC20/IERC20.sol";

interface IERC20Decimal is IERC20 {
    function decimals() external view returns (uint8);
}

contract MembershipERC721 is ERC721 {
    IERC20Decimal public erc20;

    struct Tier {
        uint16 currId;
        uint16 end;
        uint256 price;
        uint16[] releasedIds;
    }

    uint16[] private friendIdStack;
    uint16[] private foundationIdStack;
    uint16[] private genesisIdStack;

    Tier private friendTier;
    Tier private foundationTier;
    Tier private genesisTier;

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

    constructor(
        string memory name_,
        string memory symbol_,
        address erc20_,
        string memory baseURI_
    ) ERC721(name_, symbol_) {
        _setBaseURI(baseURI_);
        erc20 = IERC20Decimal(erc20_);

        friendTier = Tier({
            currId: 0,
            end: 100,
            price: 400 * 10**erc20.decimals(),
            releasedIds: friendIdStack
        });

        foundationTier = Tier({
            currId: friendTier.end,
            end: 1100,
            price: 4000 * 10**erc20.decimals(),
            releasedIds: foundationIdStack
        });

        genesisTier = Tier({
            currId: foundationTier.end,
            end: 11100,
            price: 40000 * 10**erc20.decimals(),
            releasedIds: genesisIdStack
        });
    }

    function _redeem(Tier storage tier) private {
        require(
            erc20.balanceOf(msg.sender) >= tier.price,
            "insufficient balance"
        );

        erc20.transferFrom(msg.sender, address(this), tier.price);
        uint16 id;
        if (tier.releasedIds.length > 0) {
            id = tier.releasedIds[tier.releasedIds.length - 1];
            tier.releasedIds.pop();
        } else {
            require(
                tier.currId < tier.end - 1,
                "cannot mint more tokens at tier"
            );
            id = tier.currId;
            tier.currId++;
        }
        _safeMint(msg.sender, id);
    }

    function redeemGenesis() public {
        _redeem(genesisTier);
    }

    function redeemFoundation() public {
        _redeem(foundationTier);
    }

    function redeemFriend() public {
        _redeem(friendTier);
    }

    function release(uint16 id) public {
        Tier storage tier = getTier(id);
        erc20.transfer(msg.sender, tier.price);
        safeTransferFrom(msg.sender, address(0), id);
    }
}
