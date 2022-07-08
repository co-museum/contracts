// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ERC721CoMuseumGenesis is ERC721A, ERC2981, Ownable {
    using Strings for uint256;
    address payable public immutable receiverAddress;
    string private _baseTokenURI;
    string private baseExtension = ".json";

    constructor(address payable receiverAddress_) ERC721A("CoMuseumGenesis", "COMUGE") {
        require(receiverAddress_ != address(0), "Receiver can't be 0x0");
        receiverAddress = payable(receiverAddress_);
    }

    ///  @notice Public mint function.
    ///  @param to Recipient address.
    ///  @param numberToMint Quantity of tokens to mint.
    function airdrop(address to, uint256 numberToMint) external onlyOwner {
        _mintTokens(to, numberToMint);
    }

    ///@notice Withdraw funds.
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = receiverAddress.call{value: balance}("");
        require(success, "Withdraw failed");
    }

    ///  @dev Handles minting from multiple functions.
    ///  @param to Recipient of the tokens.
    ///  @param numberToMint Quantity of tokens to mint.
    function _mintTokens(address to, uint256 numberToMint) internal {
        require(numberToMint > 0, "Zero mint");
        _safeMint(to, numberToMint);
    }

    /// @return _baseTokenURI
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /// @notice set _baseTokenURI (reveal collection)
    /// @param membershipBaseURI_ base URI
    function setBaseURI(string calldata membershipBaseURI_) external onlyOwner {
        _baseTokenURI = membershipBaseURI_;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        // console.log(_exists(tokenId));
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString(), baseExtension));
    }

    /// @notice make sure ERC165 advertises all inherited interfaces
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC2981, ERC721A) returns (bool) {
        return ERC2981.supportsInterface(interfaceId) || ERC721A.supportsInterface(interfaceId);
    }

    // ERC2981 Royalty functions

    /// @notice Sets the royalty information that all ids in this contract will default to
    /// @param receiver who the royalty goes to
    /// @param feeNumerator royalty ammount
    /// @dev _feeDenominator defaults to basis points so feeNumerator == 500 <=> 5%
    /// @dev See {ERC2981-_setDefaultRoyalty}.
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /// @notice Deletes the royalty information that all ids in this contract will default to
    /// @dev See {ERC2981-_deleteDefaultRoyalty}.
    function deleteDefaultRoyalty() external onlyOwner {
        _deleteDefaultRoyalty();
    }

    /// @dev See {ERC2981-_setTokenRoyalty}.
    ///  Sets the royalty information for a specific token id, overriding the global default.
    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeNumerator
    ) external onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    ///  @dev See {ERC2981-_resetTokenRoyalty}.
    ///  Resets royalty information for the token id back to the global default.
    function resetTokenRoyalty(uint256 tokenId) external onlyOwner {
        _resetTokenRoyalty(tokenId);
    }
}
