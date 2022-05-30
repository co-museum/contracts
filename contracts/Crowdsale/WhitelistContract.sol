//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract WhitelistContract is Ownable {
    mapping(address => bool) public allowed;

    function setWhitelistCompleted(address _addr) public onlyOwner {
        allowed[_addr] = true;
    }

    function setWhitelistRevoked(address _addr) public onlyOwner {
        allowed[_addr] = false;
    }

    function whitelistCompleted(address _addr) public view returns(bool) {
        return allowed[_addr];
    }
}