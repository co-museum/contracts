import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { removeAllListeners } from "process";
import { ERC20Mock, KycContract, TimedAllowanceCrowdsale } from "../typechain";
import { MembershipERC721 } from "../typechain/MembershipERC721";

describe("TimedAllowanceCrowdsale", () => {
  let mockERC20: ERC20Mock;
  let mockUSDC: ERC20Mock;
  let signer: SignerWithAddress;
  let userOne: SignerWithAddress;
  let userTwo: SignerWithAddress;
  let wallet: SignerWithAddress;
  let kycContract: KycContract;
  let timedAllowanceCrowdsale: TimedAllowanceCrowdsale;

  beforeEach(async () => {
     /**
     * @dev Initializing signers for our tests.
     * @param signer The default signer for our contracts
     * @param userOne Address of first paricipating user in Crowdsale
     * @param userTwo Address of second paricipating user in Crowdsale
     * @param wallet Address where collected USDC will be forwarded to and address that holds $BKLN tokens
     * @param rate Number of token units a buyer gets per USDC
     */

    [signer, userOne, userTwo, wallet] = await ethers.getSigners()
    const rate = 1
   
    /**
     * @param mockERC20 Mock ERC20 token representing tokens associated with our art work
     * @param totalSupplyOfERC20 total supply of our mockERC20
     */
    const totalSupplyOfERC20 = 4000000000000;
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockERC20 = await MockERC20.deploy(
      "Mock", "MCK", wallet.address, totalSupplyOfERC20.toString()
    )
    await mockERC20.deployed()
    mockERC20.approve(
        wallet.address,
        ethers.constants.MaxUint256,
      )


    /**
     * @param mockUSDC Mock ERC20 token representing USDC
     * @param totalSupplyOfERC20 total supply of our mockERC20
     */
    const MockUSDC = await ethers.getContractFactory("ERC20Mock");
    const totalSupplyOfMockUSDC = 4000000000000;
    mockUSDC = await MockUSDC.deploy(
      "Usdc", "USDC", signer.address, totalSupplyOfMockUSDC.toString()
    )
    await mockUSDC.deployed()
    mockUSDC.approve(
        userOne.address,
        4000000000000,
      )
    await mockUSDC.connect(userOne).transferFrom(signer.address,userTwo.address, 2000000000000)
    await mockUSDC.connect(userOne).transferFrom(signer.address,userOne.address, 2000000000000)
    expect(await mockUSDC.balanceOf(userOne.address)).to.be.equal(2000000000000, "userOne has 2000000000000 units of USDC")
    expect(await mockUSDC.balanceOf(userTwo.address)).to.be.equal(2000000000000, "userTwo has 2000000000000 units of USDC")


   const KycContract = await ethers.getContractFactory("KycContract");
   kycContract = await KycContract.deploy();
   await kycContract.deployed();

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const openingTime = await blockBefore.timestamp + 4*3600*1000;
    const saleDuration = 4*3600*1000;
    const closingTime = openingTime + saleDuration;

    const TimedAllowanceCrowdsale = await ethers.getContractFactory("TimedAllowanceCrowdsale");
    timedAllowanceCrowdsale = await TimedAllowanceCrowdsale.deploy(rate, wallet.address, mockERC20.address, mockUSDC.address, wallet.address,
        openingTime, closingTime, kycContract.address);
    await timedAllowanceCrowdsale.deployed();
  })

  describe("Crowdsale with KYC", () => {
    // afterEach(async () => {
    //   expect(await mockERC20.balanceOf(user.address)).to.be.equal(0, "not locking correct amount of ERC20")
    //   expect(await membershipERC721.balanceOf(user.address)).to.be.equal(1, "not transferring membership NFT")
    // })

    it("when userOne buys BKLNs", async () => {
     await kycContract.setKycCompleted(userOne.address)
     await mockUSDC.connect(userOne).approve(timedAllowanceCrowdsale.address, 1000000000000)
     await mockERC20.connect(wallet).approve(timedAllowanceCrowdsale.address, 4000000000000)

    await timedAllowanceCrowdsale.connect(userOne).buyTokens(userOne.address, 1000000000000)
    expect(await mockERC20.balanceOf(userOne.address)).to.be.equal(1000000000000, "userOne has 1000000000000 units of BKLNs")
    expect(await mockUSDC.balanceOf(userOne.address)).to.be.equal(1000000000000, "userOne has 1000000000000 units of USDC left")
    });

    it("when both users buy BKLNs", async () => {
        await kycContract.setKycCompleted(userOne.address)
        await kycContract.setKycCompleted(userTwo.address)
        await mockUSDC.connect(userOne).approve(timedAllowanceCrowdsale.address, 1000000000000)
        await mockUSDC.connect(userTwo).approve(timedAllowanceCrowdsale.address, 1000000000000)
        await mockERC20.connect(wallet).approve(timedAllowanceCrowdsale.address, 4000000000000)
   
       await timedAllowanceCrowdsale.connect(userOne).buyTokens(userOne.address, 1000000000000)
       await timedAllowanceCrowdsale.connect(userTwo).buyTokens(userTwo.address, 1000000000000)
       expect(await mockERC20.balanceOf(userOne.address)).to.be.equal(1000000000000, "userOne has 1000000000000 units of BKLNs")
       expect(await mockERC20.balanceOf(userTwo.address)).to.be.equal(1000000000000, "userTwo has 1000000000000 units of BKLNs")
       expect(await mockUSDC.balanceOf(userOne.address)).to.be.equal(1000000000000, "userOne has 1000000000000 units of USDC left")
       expect(await mockUSDC.balanceOf(userTwo.address)).to.be.equal(1000000000000, "userTwo has 1000000000000 units of USDC left")
       });

  })
});
