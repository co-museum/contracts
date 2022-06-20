// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../fractional/ERC721TokenVault.sol";

contract VoteDelegator is OwnableUpgradeable {
    IERC20 private erc20;
    TokenVault private vault;

    function initialize(address _erc20, address _vault) external initializer {
        __Ownable_init();
        erc20 = IERC20(_erc20);
        vault = TokenVault(_vault);
    }

    function updateUserPrice(uint256 _new) external onlyOwner {
        vault.updateUserPrice(_new);
    }

    function withdraw() external onlyOwner {
        erc20.transfer(owner(), erc20.balanceOf(address(this)));
    }
}
