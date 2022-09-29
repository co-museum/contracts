//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../nfts/ERC721MembershipUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title A discrete whitelisted allowance crowdsale for $ART tokens and
/// membership NFTs
/// @notice You can only sell discrete number of tokens and associated number of
/// membership NFTs in a proportion determined by the membership contract and
/// the allocation determined by the seller.
/// @dev Whitelists are stored as merkle tree roots. Merkle proofs are provided
/// by a client software that is communicating with a backend storing the entire
/// merkle tree. The crowdsale needs to be aware of both the token contract and
/// the membership contract.
contract AllowanceCrowdsale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev The claimed variable represents whether the user has claimed their
    /// $ART tokens allocation fully or partially without regard to crowdsale
    /// rounds
    mapping(address => bool) public claimed;

    /// @notice Struct represeting a single group of whitelisted users
    /// determined by the merkle root of a list of addresses, their
    /// allocations, and their tier. Each address can only ever be whitelisted once across
    /// rounds.
    /// @param tierCode The code associated with a particular tier in the
    /// membership contract
    /// @param allocation The address allocation expressed in $ART tokens
    /// (number of membership NFTs is computed by dividing by NFT price)
    /// @param merkleRoot The merkle root of a list of addresses
    struct Whitelist {
        ERC721MembershipUpgradeable.TierCode tierCode;
        uint256 allocation;
        bytes32 merkleRoot;
    }

    /// @return isActice Checks whether sale is active.
    bool public isActive;
    /// @return stablecoinRate Price of smallest unit of $ART token in smallest
    /// unit of stablecoin assuming same number of decimals in stablecoin and
    /// $ART token
    uint256 public stablecoinRate;
    /// @return ethRate Price of smallest unit of $ART token in wei
    uint256 public ethRate;
    /// @return treasuryWallet Address of wallet receiving crowdsale funds
    address payable public immutable treasuryWallet;
    /// @return tokenHoldingWallet Address holding the tokens, which has
    /// given allowance to the crowdsale
    address public immutable tokenHoldingWallet;
    /// @return acceptedStablecoins An array of accepted stablecoin addresses
    address[] public acceptedStablecoins;
    /// @return tokenContract Address of $ART token contract
    address public immutable tokenContract;
    /// @return membershipContract Address holding and minting memberships
    address public immutable membershipContract;
    /// @dev Array of whitelists in ongoing sale
    Whitelist[] private whitelists;

    /// @param _tokenContract Address of $ART token contract
    /// @param _treasuryWallet Address of wallet receiving crowdsale funds
    /// @param _tokenHoldingWallet Address holding the tokens, which has
    /// approved allowance to the crowdsale
    /// @param _membershipContract Address holding and minting memberships
    /// @param _acceptedStablecoins An array of accepted stablecoin addresses
    constructor(
        address _tokenContract,
        address payable _treasuryWallet,
        address _tokenHoldingWallet,
        address _membershipContract,
        address[] memory _acceptedStablecoins
    ) {
        require(_tokenHoldingWallet != address(0), "crowdsale:token wallet is the zero address");
        isActive = false;
        tokenContract = _tokenContract;
        treasuryWallet = _treasuryWallet;
        tokenHoldingWallet = _tokenHoldingWallet;
        membershipContract = _membershipContract;
        acceptedStablecoins = _acceptedStablecoins;
    }

    /// @dev Reverts if sale is not active.
    modifier onlyWhileOpen() {
        require(isActive, "crowdsale:not open");
        _;
    }

    /// @notice Sets the rate for the smallest unit of $ART token for
    /// stablecoins and ETH
    /// @dev We assume that stablecoin and $ART token have same decimals
    /// @param _stablecoinRate Price of smallest unit of $ART token in smallest
    /// unit of stablecoin assuming same number of decimals in stabslecoin and
    /// $ART token
    /// @param _ethRate Price of smallest unit of $ART token in wei
    function setRates(uint256 _stablecoinRate, uint256 _ethRate) external onlyOwner {
        stablecoinRate = _stablecoinRate;
        ethRate = _ethRate;
    }

    /// @notice Starts a sale for a batch of $ART token/associated NFTs for
    /// whitelisted addresses
    /// @dev Index i in each array represents the associated parameter in
    /// whitelists[i], giving the contract information about the whitelisted
    /// addresses for this batch.
    /// @param tierCodes An array of codes associated with a partcular tier in
    /// the membership contract
    /// @param allocations An array of address allocation expressed in $ART
    /// tokens (number of membershio NFTs is computed by dividing by NFT price)
    /// @param merkleRoots An array of merkle roots of a list of addresses
    /// @dev There can be several batches of token sale, but the same whitelisted address cannot claim tokens/NFTs if they have claimed already
    function startSale(
        ERC721MembershipUpgradeable.TierCode[] calldata tierCodes,
        uint256[] calldata allocations,
        bytes32[] calldata merkleRoots
    ) external onlyOwner {
        require(
            tierCodes.length == allocations.length && allocations.length == merkleRoots.length,
            "crowdsale:whitelists arrays should be of equal length"
        );

        require(tierCodes.length != 0, "crowdsale:whitelists arrays.length should be > 0");

        require(!isActive, "sale still active");

        isActive = true;

        for (uint256 i = 0; i < tierCodes.length; i++) {
            whitelists.push(
                Whitelist({tierCode: tierCodes[i], allocation: allocations[i], merkleRoot: merkleRoots[i]})
            );
        }
    }

    /// @notice Stops a sale for a batch of $ART tokens/associated NFTs for
    /// whitelisted addresses
    /// @dev Whitelists array is cleared at end of batch.
    function stopSale() external onlyOwner {
        isActive = false;
        for (uint256 i = 0; i < whitelists.length; i++) {
            delete whitelists[i];
        }
    }

    /// @notice Helps a whitelisted user buy membership NFTs based on their
    /// allocation
    /// @param numNFTs Number of NFTs a user wants to buy
    /// @param whitelistIndex Index of the whitelist in the array of whitelists
    /// @dev There can be several whitelists in a batch of token sale with
    /// different allocations. WhiltelistIndex represents which whitelist
    /// a user belongs to
    /// @param proof Merkle proof used to verify that the msg.sender is a part
    /// of a Merkle tree
    /// @param payWithEth  Whether msg.sender pays with ETH or stablecoin
    /// @param _stablecoinAddress Stablecoin addresses used to buy tokens
    /// @dev _stablecoinAddress is passed as the zero address if payWithEth is
    /// true
    function buyNFTs(
        uint256 numNFTs,
        uint256 whitelistIndex,
        bytes32[] calldata proof,
        bool payWithEth,
        address _stablecoinAddress
    ) external payable onlyWhileOpen nonReentrant {
        require(!claimed[msg.sender], "crowdsale:user has already claimed allocation");
        Whitelist storage whitelist = whitelists[whitelistIndex];
        uint256 allocation = whitelist.allocation;
        uint256 price = ERC721MembershipUpgradeable(membershipContract).getTierPrice(whitelist.tierCode);
        uint256 quantity = numNFTs * price;
        _validatePurchase(allocation, quantity, price, proof, whitelist.merkleRoot);
        _receivePayment(payWithEth, quantity, _stablecoinAddress);
        claimed[msg.sender] = true;
        for (uint256 i = 0; i < numNFTs; i++) {
            ERC721MembershipUpgradeable(membershipContract).redeem(whitelist.tierCode, tokenHoldingWallet, msg.sender);
        }
    }

    /// @dev Validates if the purchase is being made in a discrete number of
    /// tokens, the discrete numbers being determined by the price of NFTs in
    /// terms of $ART tokens
    /// @dev quantity % price -> Ensures discreteness  because quantity has to
    /// be a integer * price
    /// @dev allocation % quantity -> Ensure you cannot buy a lower tier because
    /// if quantity > allocation, the reaminder != 0 (== quantity)
    /// @param allocation The address allocation expressed in $ART tokens
    /// (number of membershio NFTs is computed by dividing by NFT price)
    /// @param quantity Number of $ART tokens a user wants to buy (For NFTs,
    /// compute in terms of $ART tokens based on tier)
    /// @param price Price of tier in terms of $ART token
    /// @param whitelistRoot The merkle root of a list of addresses for
    /// whitelists[i]
    function _validatePurchase(
        uint256 allocation,
        uint256 quantity,
        uint256 price,
        bytes32[] calldata proof,
        bytes32 whitelistRoot
    ) internal view {
        require(
            allocation % quantity == 0 && quantity % price == 0,
            "crowdsale:must purchase tokens in discrete quantities based on allocation"
        );
        require(MerkleProof.verify(proof, whitelistRoot, keccak256(abi.encodePacked(msg.sender))), "Invalid proof");
    }

    /// @dev Checks whether stablecoin is accepted and returns the stablecoin
    /// @param stablecoinAddress Address of stablecoin
    function getStablecoin(address stablecoinAddress) internal view returns (IERC20) {
        bool hasTokenAddress = false;
        for (uint256 i = 0; i < acceptedStablecoins.length; i++) {
            if (stablecoinAddress == acceptedStablecoins[i]) {
                hasTokenAddress = true;
                break;
            }
        }
        require(hasTokenAddress, "crowdsale:stablecoin not supported");
        return IERC20(stablecoinAddress);
    }

    /// @dev Transfers either stablecoin or ETH to treasury wallet
    /// @param payWithEth Whether msg.sender pays with ETH or stablecoin
    /// @param quantity Number of $ART tokens a user wants to buy (For NFTs,
    /// compute in terms of $ART tokens based on tier)
    /// @param _stablecoinAddress Stablecoin addresses used to buy tokens
    function _receivePayment(
        bool payWithEth,
        uint256 quantity,
        address _stablecoinAddress
    ) internal {
        if (!payWithEth) {
            require(stablecoinRate > 0, "crowdsale:stablecoinRate <= 0");
            getStablecoin(_stablecoinAddress).transferFrom(msg.sender, treasuryWallet, quantity * stablecoinRate);
        } else {
            require(ethRate > 0, "crowdsale:ethRate <= 0");
            require(msg.value >= quantity * ethRate, "crowdsale:not enough eth");
            require(msg.value >= quantity * ethRate, "crowdsale:not enough eth");
            Address.sendValue(treasuryWallet, quantity * ethRate);
            uint256 back = msg.value - quantity * ethRate;
            if (back > 0) {
                (bool success, ) = msg.sender.call{value: back}("");
                require(success, "unable to send value");
            }
        }
    }
}
