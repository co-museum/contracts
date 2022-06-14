// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ComuseumGenesis is ERC721Royalty, Ownable {
    uint256 public totalSupply;
    string private _baseURIExtended;
    address payable public immutable receiverAddress;

    constructor(address payable receiverAddress_) ERC721("test7898", "TESTG") {
        require(receiverAddress_ != address(0), "Receiver can't be 0x0");
        receiverAddress = payable(receiverAddress_);
    }

    /**
     * @notice Mints a series of tokens a sends it to recipient address.
     * @param numberToMint Quantity of tokens to mint.
     */
    function devMintSeries(uint256 numberToMint) external onlyOwner {
        _mintTokens(msg.sender, numberToMint);
    }

    /**
     * @notice Public mint function.
     * @param to Recipient address.
     * @param numberToMint Quantity of tokens to mint.
     */
    function airdrop(address to, uint256 numberToMint) external onlyOwner {
        _mintTokens(to, numberToMint);
    }

    /**
     * @notice Set a new base URI for token metadata.
     * @param baseURI_ The new base URI to set.
     */
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseURIExtended = baseURI_;
    }

    /**
     * @notice Withdraw funds.
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = receiverAddress.call{value: balance}("");
        require(success, "Withdraw failed");
    }

    /**
     * @dev Handles minting from multiple functions.
     * @param to Recipient of the tokens.
     * @param numberToMint Quantity of tokens to mint.
     */
    function _mintTokens(address to, uint256 numberToMint) internal {
        require(numberToMint > 0, "Zero mint");
        uint256 currentSupply_ = totalSupply; // memory variable
        for (uint256 i; i < numberToMint; ++i) {
            _safeMint(to, currentSupply_++); // mint then increment
        }
        totalSupply = currentSupply_; // update storage
    }

    /**
     * @dev Override ERC721 to return a baseURI prefix on tokenURI().
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIExtended;
    }

    /**
     * @dev Override supers.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ERC2981 Royalty functions
    /**
     * @dev See {ERC2981-_setDefaultRoyalty}.
     * Sets the royalty information that all ids in this contract will default to
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /**
     * @dev See {ERC2981-_deleteDefaultRoyalty}.
     */
    function deleteDefaultRoyalty() external onlyOwner {
        _deleteDefaultRoyalty();
    }

    /**
     * @dev See {ERC2981-_setTokenRoyalty}.
     * Sets the royalty information for a specific token id, overriding the global default.
     */
    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeNumerator
    ) external onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    /**
     * @dev See {ERC2981-_resetTokenRoyalty}.
     * Resets royalty information for the token id back to the global default.
     */
    function resetTokenRoyalty(uint256 tokenId) external onlyOwner {
        _resetTokenRoyalty(tokenId);
    }
}