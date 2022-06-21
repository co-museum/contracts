// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../fractional/ERC721TokenVault.sol";

contract VoteDelegator is OwnableUpgradeable {
    TokenVault private vault;

    function initialize(address _vault) external initializer {
        __Ownable_init();
        vault = TokenVault(_vault);
    }

    function updateUserPrice(uint256 _new) external onlyOwner {
        vault.updateUserPrice(_new);
    }

    function withdraw(address to) external onlyOwner {
        vault.transfer(to, vault.balanceOf(address(this)));
    }
}
