//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "./Crowdsale.sol";
import "./WhitelistContract.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/utils/math/SafeMath.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/utils/math/Math.sol";

/**
 * @title AllowanceCrowdsale
 * @dev Extension of Crowdsale where tokens are held by a wallet, which approves an allowance to the crowdsale.
 */
contract TimedAllowanceCrowdsale is Crowdsale, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address private _tokenWallet;
    uint256 private _openingTime;
    uint256 private _closingTime;

    WhitelistContract private whitelist;

    mapping(address => uint256) private _contributions;
    mapping(address => uint256) private _caps;

    /**
     * Event for crowdsale extending
     * @param newClosingTime new closing time
     * @param prevClosingTime old closing time
     */
    event TimedCrowdsaleExtended(
        uint256 prevClosingTime,
        uint256 newClosingTime
    );

    /**
     * @dev Reverts if not in crowdsale time range.
     */
    modifier onlyWhileOpen() {
        // require(isOpen(), "TimedCrowdsale: not open");
        _;
    }

    /**
     * @dev Constructor, takes token wallet address.
       @param r Number of token units a buyer gets per wei
     * @dev The rate is the conversion between wei and the smallest and indivisible
     * token unit. So, if you are using a rate of 1 with a ERC20Detailed token
     * with 3 decimals called TOK, 1 wei will give you 1 unit, or 0.001 TOK.
     * @param w Address where collected funds will be forwarded to
     * @param t Address of the token being sold
     * @param tw Address holding the tokens, which has approved allowance to the crowdsale.
    * @param openTime Crowdsale opening time
     * @param closeTime Crowdsale closing time
     */
    constructor(
        uint256 r,
        address payable w,
        address t,
        address usdc,
        address usdt,
        address tw,
        uint256 openTime,
        uint256 closeTime,
        WhitelistContract _kyc
    ) Crowdsale(r, w, t, usdc, usdt) {
        require(tw != address(0), "Tken wallet is the zero address");
        // solhint-disable-next-line not-rely-on-time
        require(
            openTime >= block.timestamp,
            "Opening time before current time"
        );
        // solhint-disable-next-line max-line-length
        require(closeTime > openTime, "Opening time isn't before closing time");

        _openingTime = openTime;
        _closingTime = closeTime;
        _tokenWallet = tw;
        whitelist = _kyc;
    }

    /**
     * @return the address of the wallet that will hold the tokens.
     */
    function tokenWallet() public view returns (address) {
        return _tokenWallet;
    }

    /**
     * @dev Checks the amount of tokens left in the allowance.
     * @return Amount of tokens left in the allowance
     */
    function remainingTokens() public view returns (uint256) {
        return
            Math.min(
                token().balanceOf(_tokenWallet),
                token().allowance(_tokenWallet, address(this))
            );
    }

    /**
     * @dev Overrides parent behavior by transferring tokens from wallet.
     * @param beneficiary Token purchaser
     * @param tokenAmount Amount of tokens purchased
     */
    function _deliverTokens(address beneficiary, uint256 tokenAmount)
        internal
        override
    {
        token().safeTransferFrom(_tokenWallet, beneficiary, tokenAmount);
    }

    /**
     * @return the crowdsale opening time.
     */
    function openingTime() public view returns (uint256) {
        return _openingTime;
    }

    /**
     * @return the crowdsale closing time.
     */
    function closingTime() public view returns (uint256) {
        return _closingTime;
    }

    /**
     * @return true if the crowdsale is open, false otherwise.
     */
    function isOpen() public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        return
            block.timestamp >= _openingTime && block.timestamp <= _closingTime;
    }

    /**
     * @dev Checks whether the period in which the crowdsale is open has already elapsed.
     * @return Whether crowdsale period has elapsed
     */
    function hasClosed() public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp > _closingTime;
    }

    /**
     * @dev Extend parent behavior requiring to be within contributing period.
     * @param beneficiary Token purchaser
     * @param usdAmount Amount of usd contributed in terms of 6 decimal places
     */
    function _preValidatePurchase(
        address beneficiary,
        uint256 usdAmount,
        IERC20 stablecoin
    ) internal view override onlyWhileOpen {
        super._preValidatePurchase(beneficiary, usdAmount, stablecoin);
        // TODO: Remove the whitelist scenario - the cap with automatically create a whitelist
        // require(whitelist.whitelistCompleted(beneficiary), "KYC not completed yet, aborting");
        require(
            _contributions[beneficiary].add(usdAmount) <= _caps[beneficiary],
            "beneficiary's cap exceeded"
        );
    }

    /**
     * @dev Extend crowdsaƒle.
     * @param newClosingTime Crowdsale closing time
     */
    function _extendTime(uint256 newClosingTime) internal {
        require(!hasClosed(), "Already closed");
        // solhint-disable-next-line max-line-length
        require(
            newClosingTime > _closingTime,
            "New closing time is before current closing time"
        );
        emit TimedCrowdsaleExtended(_closingTime, newClosingTime);
        _closingTime = newClosingTime;
    }

    /**
     * @dev Sets a specific beneficiary's maximum contribution.
     * @param beneficiary Address to be capped
     * @param cap Wei limit for individual contribution
     */
    function setCap(address beneficiary, uint256 cap) external onlyOwner {
        _caps[beneficiary] = cap;
    }

    /**
     * @dev Returns the cap of a specific beneficiary.
     * @param beneficiary Address whose cap is to be checked
     * @return Current cap for individual beneficiary
     */
    function getCap(address beneficiary) public view returns (uint256) {
        return _caps[beneficiary];
    }

    /**
     * @dev Returns the amount contributed so far by a specific beneficiary.
     * @param beneficiary Address of contributor
     * @return Beneficiary contribution so far
     */
    function getContribution(address beneficiary)
        public
        view
        returns (uint256)
    {
        return _contributions[beneficiary];
    }

    /**
     * @dev Extend parent behavior to update beneficiary contributions.
     * @param beneficiary Token purchaser
     * @param usdAmount Amount of wei contributed
     */
    function _updatePurchasingState(address beneficiary, uint256 usdAmount)
        internal
        override
    {
        super._updatePurchasingState(beneficiary, usdAmount);
        _contributions[beneficiary] = _contributions[beneficiary].add(
            usdAmount
        );
    }
}
