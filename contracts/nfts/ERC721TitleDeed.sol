// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ERC721TitleDeed is ERC721Royalty, Ownable {
    using Strings for uint256;
    address payable public immutable receiverAddress;
    string private _baseTokenURI;
    string private baseExtension = ".json";

    constructor(address payable receiverAddress_) ERC721("CoMuseumTitleDeeds", "COMUTD") {
        require(receiverAddress_ != address(0), "Receiver can't be 0x0");
        receiverAddress = payable(receiverAddress_);
    }

    ///  @notice Public mint function.
    function mintTitleDeed() external onlyOwner {
        _safeMint(address(this), 1);
    }

    ///@notice Withdraw funds.
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = receiverAddress.call{value: balance}("");
        require(success, "Withdraw failed");
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
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString(), baseExtension));
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
