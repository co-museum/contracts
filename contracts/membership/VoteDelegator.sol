// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../fractional/ERC721TokenVault.sol";

/// @title Logic contract (used through a proxy) to vote for reserve price in
/// TokenVault by membership NFT
contract VoteDelegator is OwnableUpgradeable {
    /// @dev address token vault to cast votes in
    address private vault;

    /// @dev asign vault to cast votes in
    /// @param _vault address token vault to cast votes in
    function initialize(address _vault) external initializer {
        __Ownable_init();
        vault = _vault;
    }

    /// @notice update reserve price for membership NFT VoteDelegator proxy is
    /// associated with
    /// @param _new new reserve price
    function updateUserPrice(uint256 _new) external onlyOwner {
        TokenVault(vault).updateUserPrice(_new);
    }

    /// @notice refund $ART tokens to address _to
    /// @param _to is the membership contract when transfering and the user address when
    /// releasing
    function withdraw(address _to) external onlyOwner {
        TokenVault(vault).transfer(_to, TokenVault(vault).balanceOf(address(this)));
    }
}
