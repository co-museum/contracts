// SPDX-License-Identifier: MIT
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
    }

    uint16[] private burntTokenIdsGenesis;
    uint16[] private burntTokenIdFoundation;
    uint16[] private burntTokenIdFriends;

    mapping(TierType => Tier) private tiers;
    mapping(TierType => mapping(uint => address)) private mintedTokenIdsByTierType;

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
            price: 40000
        });
        tiers[TierType.FOUNDATION] = Tier({
            tierType: TierType.FOUNDATION,
            currId: 100,
            maxId: 1099,
            price: 4000
        });
        tiers[TierType.FRIEND] = Tier({
            tierType: TierType.FRIEND,
            currId: 1100,
            maxId: 11099,
            price: 400 
        });
    }

    function _nextID(TierType tier_) private returns (uint16) {
        Tier memory tier = tiers[tier_];
        uint16 res;
        bool isPopped = false;

        if (tier_ == TierType.GENESIS && burntTokenIdsGenesis.length > 0) {
            res = burntTokenIdsGenesis[burntTokenIdsGenesis.length -1];
            burntTokenIdsGenesis.pop();
            isPopped = true;
        } else if (tier_ == TierType.FOUNDATION && burntTokenIdFoundation.length > 0) {
            res = burntTokenIdFriends[burntTokenIdFriends.length -1];
            burntTokenIdFriends.pop();
            isPopped = true;
        } else if(tier_ == TierType.FRIEND && burntTokenIdFriends.length > 0){
            res = burntTokenIdFriends[burntTokenIdFriends.length -1];
            burntTokenIdFriends.pop();
            isPopped = true;
        } 
    
        if (isPopped && tier.currId < tier.maxId) {
            res = tier.currId;
            tier.currId++;
        } 

        return res;
    }

    function redeem(TierType tier_) public {
        Tier memory tier = tiers[tier_];
        uint256 price = tier.price;
        console.log("Price of tier", price);
        require(erc20.balanceOf(msg.sender) >= price, "insufficient balance");
        erc20.transferFrom(msg.sender, address(this), price);
        uint16 tokenId = _nextID(tier.tierType);
        _safeMint(msg.sender, tokenId);
         mintedTokenIdsByTierType[tier_][tokenId] = msg.sender;
    }

    function release(TierType tier_, uint16 tokenId) public {
        Tier memory tier = tiers[tier_];
        uint256 price = tier.price;
        console.log("Price of tier", price);
        console.log("owner of NFT", mintedTokenIdsByTierType[tier_][tokenId]);
        require(mintedTokenIdsByTierType[tier_][tokenId] == msg.sender, "user not owner");
        erc20.approve(msg.sender, price);
        uint256 allowance = erc20.allowance(address(this), msg.sender);
        console.log("allowance",allowance);
        erc20.transfer(msg.sender, price);
        _burn(tokenId);
        if (tier_ == TierType.GENESIS) {
            burntTokenIdsGenesis.push(tokenId);
        } else if (tier_ == TierType.FOUNDATION) {
            burntTokenIdsGenesis.push(tokenId);
        } else if(tier_ == TierType.FRIEND ){
          burntTokenIdsGenesis.push(tokenId);
        }
    }
}
