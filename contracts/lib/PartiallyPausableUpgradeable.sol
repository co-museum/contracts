//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract PartiallyPausableUpgradeable is PausableUpgradeable, AccessControlUpgradeable {
    bytes32 public constant SUPPORT_ROLE = keccak256("SUPPORT_ROLE");
    bytes32 public constant SENDER_ROLE = keccak256("SENDER_ROLE");
    address public ownerAddress;


    function __PartiallyPausableUpgradeable_init(address _ownerAddress) internal onlyInitializing {
        __Pausable_init();
        __AccessControl_init();
        _setRoleAdmin(SENDER_ROLE, SUPPORT_ROLE);
        ownerAddress = _ownerAddress;
        _setupRole(SUPPORT_ROLE, ownerAddress);
    }

    function addSender(address sender) external {
        _setupRole(SENDER_ROLE, sender);
    }

    function renounceSupport() external {
        renounceRole(SUPPORT_ROLE, msg.sender);
    }

    function pause() external onlyRole(SUPPORT_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(SUPPORT_ROLE) {
        _unpause();
    }


    modifier onlySenderWhenPaused () {
        require(
            !paused() || hasRole(SENDER_ROLE, msg.sender),
            "No permission to send"
        );
        _;
    }
}