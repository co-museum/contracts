//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/// @title Contract implementing pausability with exceptions.
/// @notice onlySenderWhenPaused introduces a requirement that msg.sender must
/// have the sender role. The support role manages senders and pauses/unpauses.
/// When no addresses have the support role pausability as well as sender
/// management is disabled
/// @dev We need this so that contracts can send assets to users during the
/// crowdsale without secondary markets emerging before the crowdsale ends
contract PartiallyPausableUpgradeable is PausableUpgradeable, AccessControlUpgradeable {
    bytes32 public constant SUPPORT_ROLE = keccak256("SUPPORT_ROLE");
    bytes32 public constant SENDER_ROLE = keccak256("SENDER_ROLE");
    address public ownerAddress;

    /// @dev call inside initialize
    function __PartiallyPausableUpgradeable_init(address _ownerAddress) internal onlyInitializing {
        __Pausable_init();
        __AccessControl_init();
        _setRoleAdmin(SENDER_ROLE, SUPPORT_ROLE);
        ownerAddress = _ownerAddress;
        _setupRole(SUPPORT_ROLE, ownerAddress);
    }

    /// @notice give an address the sender role
    /// @param sender address to grant sender role to
    function addSender(address sender) external {
        _setupRole(SENDER_ROLE, sender);
    }

    /// @notice take sender role away from address
    /// @param sender address to revoke sender role from
    function removeSender(address sender) external {
        _revokeRole(SENDER_ROLE, sender);
    }

    /// @notice kick self from support role
    function renounceSupport() external {
        renounceRole(SUPPORT_ROLE, msg.sender);
    }

    /// @notice restrict onlySenderWhenPaused functions to senders
    function pause() external onlyRole(SUPPORT_ROLE) {
        _pause();
    }

    /// @notice lift all onlySenderWhenPaused restrictions
    function unpause() external onlyRole(SUPPORT_ROLE) {
        _unpause();
    }

    /// @notice modifier to restrict functions to senders when paused
    modifier onlySenderWhenPaused() {
        require(!paused() || hasRole(SENDER_ROLE, msg.sender), "No permission to send");
        _;
    }
}
