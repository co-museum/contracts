//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../membership/ERC721MembershipUpgradeable.sol";

/**
 * @title AllowanceCrowdsale
 * @dev Extension of Crowdsale where tokens are held by a wallet, which approves an allowance to the crowdsale.
 */
contract AllowanceCrowdsale is Ownable {
    using SafeERC20 for IERC20;
    mapping(address => bool) private _claimed;

    // ======== STRUCTS ========
    struct Whitelist {
        ERC721MembershipUpgradeable.TierCode tierCode;
        uint256 allocation; // in tokenAddress token
        bytes32 merkleRoot;
    }

    // ======== STATE VARIABLES ========
    address private _tokenWallet;
    bool public isActive;
    Whitelist[] private whitelists;
    uint256 public stablecoinRate; // NOTE: all stablecoins assumed to have same number of decimals as token
    uint256 public ethRate;
    address payable public treasuryWallet;
    address public tokenHoldingWallet;
    address[] public acceptedStablecoins;
    IERC20 public tokenContract;
    ERC721MembershipUpgradeable public membershipContract;

    // ======== CONSTRUCTOR ========
    /**
     * @dev Constructor, takes token wallet address.
     * @param _tokenAddress Address of the token being sold
     * @param _treasuryWallet Address where collected funds will be forwarded to
     * @param _tokenHoldingWallet Address holding the tokens, which has approved allowance to the crowdsale.
     * @param _membershipContract Address holding and minting memberships
     * @param _acceptedStablecoins Array of stablecoin
     */
    constructor(
        address _tokenAddress,
        address payable _treasuryWallet,
        address _tokenHoldingWallet,
        address _membershipContract,
        address[] memory _acceptedStablecoins
    ) {
        require(
            _tokenHoldingWallet != address(0),
            "Token wallet is the zero address"
        );
        isActive = false;
        tokenContract = IERC20(_tokenAddress);
        treasuryWallet = _treasuryWallet;
        tokenHoldingWallet = _tokenHoldingWallet;
        membershipContract = ERC721MembershipUpgradeable(_membershipContract);
        acceptedStablecoins = _acceptedStablecoins;
    }

    /**
     * @dev Reverts if not in crowdsale time range.
     */
    modifier onlyWhileOpen() {
        require(isActive, "Crowdsale: not open");
        _;
    }

    function setRates(uint256 _stablecoinRate, uint256 _ethRate) external {
        stablecoinRate = _stablecoinRate;
        ethRate = _ethRate;
    }

    function startSale(
        ERC721MembershipUpgradeable.TierCode[] calldata tierCodes,
        uint256[] calldata allocations,
        bytes32[] calldata merkleRoots
    ) external onlyOwner {
        require(
            tierCodes.length == allocations.length &&
                allocations.length == merkleRoots.length,
            "Whitelists arrays should be of equal length"
        );

        require(
            tierCodes.length != 0,
            "Whitelists arrays.length should be > 0"
        );

        isActive = true;

        for (uint256 i = 0; i < tierCodes.length; i++) {
            whitelists.push(
                Whitelist({
                    tierCode: tierCodes[i],
                    allocation: allocations[i],
                    merkleRoot: merkleRoots[i]
                })
            );
        }
    }

    function stopSale() external onlyOwner {
        isActive = false;
        // TODO: test when whitelist is uninitialised
        for (uint8 i = 0; i < whitelists.length; i++) {
            delete whitelists[i];
        }
    }

    function buyTokens(
        uint256 quantity,
        uint8 whitelistIndex,
        bytes32[] calldata proof,
        bool payWithEth,
        address _stablecoinAddress
    ) external payable {
        Whitelist storage whitelist = whitelists[whitelistIndex];
        uint256 allocation = whitelist.allocation;
        uint256 price = membershipContract.getTierPrice(whitelist.tierCode);
        _validatePurchase(
            allocation,
            quantity,
            price,
            proof,
            whitelist.merkleRoot
        );
        _receivePayment(payWithEth, quantity, _stablecoinAddress);
        tokenContract.safeTransferFrom(
            tokenHoldingWallet,
            msg.sender,
            quantity
        );
    }

    function buyNFTs(
        uint256 numNFTs,
        uint8 whitelistIndex,
        bytes32[] calldata proof,
        bool payWithEth,
        address _stablecoinAddress
    ) external payable {
        Whitelist storage whitelist = whitelists[whitelistIndex];
        uint256 allocation = whitelist.allocation;
        uint256 price = membershipContract.getTierPrice(whitelist.tierCode);
        uint256 quantity = numNFTs * price;
        _validatePurchase(
            allocation,
            quantity,
            price,
            proof,
            whitelist.merkleRoot
        );
        _receivePayment(payWithEth, quantity, _stablecoinAddress);
        membershipContract.redeem(
            whitelist.tierCode,
            tokenHoldingWallet,
            msg.sender
        );
    }

    function _validatePurchase(
        uint256 allocation,
        uint256 quantity,
        uint256 price,
        bytes32[] calldata proof,
        bytes32 batchRoot
    ) internal view {
        require(
            allocation % quantity == 0 && quantity % price == 0,
            "Must purchase tokens in discrete quantities based on allocation"
        );
        require(
            MerkleProof.verify(
                proof,
                batchRoot,
                keccak256(abi.encodePacked(msg.sender))
            ),
            "Invalid proof"
        );
    }

    function getStablecoin(address stablecoinAddress)
        internal
        view
        returns (IERC20)
    {
        bool hasTokenAddress = false;
        for (uint256 i = 0; i < acceptedStablecoins.length; i++) {
            if (stablecoinAddress == acceptedStablecoins[i]) {
                hasTokenAddress = true;
            }
        }
        require(hasTokenAddress, "Stablecoin not supported");
        return IERC20(stablecoinAddress);
    }

    function _forwardFunds() internal {
        treasuryWallet.transfer(msg.value);
    }

    function _receivePayment(
        bool payWithEth,
        uint256 quantity,
        address _stablecoinAddress
    ) internal {
        if (!payWithEth) {
            getStablecoin(_stablecoinAddress).transferFrom(
                msg.sender,
                treasuryWallet,
                quantity * stablecoinRate
            );
        } else {
            require(
                msg.value >= quantity * ethRate,
                "Insufficient funds to buy tokens"
            );
            _forwardFunds();
        }
    }
}
