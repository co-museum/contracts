import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  ERC20Mock,
  TimedAllowanceCrowdsale,
} from "../typechain";

describe("TimedAllowanceCrowdsale", () => {
  let mockERC20: ERC20Mock;
  let mockUSDC: ERC20Mock;
  let mockUSDT: ERC20Mock;
  let signer: SignerWithAddress;
  let userOne: SignerWithAddress;
  let userTwo: SignerWithAddress;
  let wallet: SignerWithAddress;
  let timedAllowanceCrowdsale: TimedAllowanceCrowdsale;
  const totalSupplyOfERC20 = 4000000000000;
  const totalSupplyOfMockUSDC = 10000000000000;
  const totalSupplyOfMockUSDT = 10000000000000;

  beforeEach(async () => {
    /**
     * @dev Initializing signers for our tests.
     * @param signer The default signer for our contracts
     * @param userOne Address of first paricipating user in Crowdsale
     * @param userTwo Address of second paricipating user in Crowdsale
     * @param wallet Address where collected USDC will be forwarded to and address that holds $BKLN tokens
     * @param rate Number of token units a buyer gets per USDC
     */

    [signer, userOne, userTwo, wallet] = await ethers.getSigners();
    const rate = 1;

    /**
     * @param mockERC20 Mock ERC20 token representing tokens associated with our art work
     * @param totalSupplyOfERC20 total supply of our mockERC20
     */
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockERC20 = await MockERC20.deploy(
      "Mock",
      "MCK",
      wallet.address,
      totalSupplyOfERC20.toString()
    );
    await mockERC20.deployed();
    mockERC20.approve(wallet.address, ethers.constants.MaxUint256);

    /**
     * @param mockUSDC Mock ERC20 token representing USDC
     * @param totalSupplyOfERC20 total supply of our mockERC20
     */
    const MockUSDC = await ethers.getContractFactory("ERC20Mock");
    mockUSDC = await MockUSDC.deploy(
      "Usdc",
      "USDC",
      signer.address,
      totalSupplyOfMockUSDC.toString()
    );
    await mockUSDC.deployed();
    mockUSDC.approve(userOne.address, totalSupplyOfMockUSDC);
    await mockUSDC
      .connect(userOne)
      .transferFrom(signer.address, userTwo.address, totalSupplyOfMockUSDC / 2);
    await mockUSDC
      .connect(userOne)
      .transferFrom(signer.address, userOne.address, totalSupplyOfMockUSDC / 2);
    expect(await mockUSDC.balanceOf(userOne.address)).to.be.equal(
      totalSupplyOfMockUSDC / 2,
      "userOne has 5000000000000 units of USDC"
    );
    expect(await mockUSDC.balanceOf(userTwo.address)).to.be.equal(
      totalSupplyOfMockUSDC / 2,
      "userTwo has 5000000000000 units of USDC"
    );

    /**
     * @param mockUSDT Mock ERC20 token representing USDT
     * @param totalSupplyOfMockUSDT total supply of our mockERC20
     */
    const MockUSDT = await ethers.getContractFactory("ERC20Mock");
    mockUSDT = await MockUSDC.deploy(
      "Usdc",
      "USDC",
      signer.address,
      totalSupplyOfMockUSDC.toString()
    );
    await mockUSDT.deployed();
    mockUSDT.approve(userOne.address, totalSupplyOfMockUSDT);
    await mockUSDT
      .connect(userOne)
      .transferFrom(signer.address, userTwo.address, totalSupplyOfMockUSDT / 2);
    await mockUSDT
      .connect(userOne)
      .transferFrom(signer.address, userOne.address, totalSupplyOfMockUSDT / 2);
    expect(await mockUSDT.balanceOf(userOne.address)).to.be.equal(
      totalSupplyOfMockUSDT / 2,
      "userOne has 5000000000000 units of USDT"
    );
    expect(await mockUSDT.balanceOf(userTwo.address)).to.be.equal(
      totalSupplyOfMockUSDT / 2,
      "userTwo has 5000000000000 units of USDT"
    );

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const openingTime = (await blockBefore.timestamp) + 4 * 3600 * 1000;
    const saleDuration = 4 * 3600 * 1000;
    const closingTime = openingTime + saleDuration;

    const TimedAllowanceCrowdsale = await ethers.getContractFactory(
      "TimedAllowanceCrowdsale"
    );
    timedAllowanceCrowdsale = await TimedAllowanceCrowdsale.deploy(
      rate,
      wallet.address,
      mockERC20.address,
      mockUSDC.address,
      mockUSDT.address,
      wallet.address,
      openingTime,
      closingTime,
    );
    await timedAllowanceCrowdsale.deployed();

    await mockUSDC
      .connect(userOne)
      .approve(timedAllowanceCrowdsale.address, totalSupplyOfMockUSDC / 2);
    await mockUSDC
      .connect(userTwo)
      .approve(timedAllowanceCrowdsale.address, totalSupplyOfMockUSDC / 2);
    await mockUSDT
      .connect(userOne)
      .approve(timedAllowanceCrowdsale.address, totalSupplyOfMockUSDT / 2);
    await mockUSDT
      .connect(userTwo)
      .approve(timedAllowanceCrowdsale.address, totalSupplyOfMockUSDT / 2);
    await mockERC20
      .connect(wallet)
      .approve(timedAllowanceCrowdsale.address, totalSupplyOfERC20);
  });

  describe("Crowdsale with Whitelist", () => {
    describe("Crowdsale where buyers are whitelisted", () => {
      describe("when one user buys BKLNs that is less than the total supply with USDC", () => {
        it("then the BKLN tokens should be reflected in the users wallet and stable coins removed from their wallet.", async () => {
          await timedAllowanceCrowdsale.setCap(
            userOne.address,
            totalSupplyOfERC20 / 4
          );

          await timedAllowanceCrowdsale
            .connect(userOne)
            .buyTokens(
              userOne.address,
              totalSupplyOfERC20 / 4,
              mockUSDC.address
            );
          expect(await mockERC20.balanceOf(userOne.address)).to.be.equal(
            totalSupplyOfERC20 / 4,
            "userOne has ${totalSupplyOfERC20 / 4}$ units of BKLNs"
          );
          expect(await mockUSDC.balanceOf(userOne.address)).to.be.equal(
            totalSupplyOfMockUSDC / 2 - totalSupplyOfERC20 / 4,
            "userOne has ${totalSupplyOfMockUSDC / 2 - totalSupplyOfERC20 / 4}$ units of USDC left"
          );
          expect(await timedAllowanceCrowdsale.remainingTokens()).to.be.equal(
            totalSupplyOfERC20 - totalSupplyOfERC20 / 4,
            "there are ${totalSupplyOfERC20 - totalSupplyOfERC20 / 4}$ remaining tokens"
          );
          expect(await mockUSDC.balanceOf(wallet.address)).to.be.equal(
            totalSupplyOfERC20 / 4,
            "wallet has $totalSupplyOfERC20 / 4$ units of USDC left"
          );
        });

        describe("when multiple users buy BKLNs that is less than the total supply using USDT and USDC", () => {
          it("when both users buy BKLNs", async () => {
            await timedAllowanceCrowdsale.setCap(
              userOne.address,
              totalSupplyOfERC20 / 4
            );
            await timedAllowanceCrowdsale.setCap(
              userTwo.address,
              totalSupplyOfERC20 / 4
            );

            await timedAllowanceCrowdsale
              .connect(userOne)
              .buyTokens(
                userOne.address,
                totalSupplyOfERC20 / 4,
                mockUSDC.address
              );
            await timedAllowanceCrowdsale
              .connect(userTwo)
              .buyTokens(
                userTwo.address,
                totalSupplyOfERC20 / 4,
                mockUSDT.address
              );
            expect(await mockERC20.balanceOf(userOne.address)).to.be.equal(
              totalSupplyOfERC20 / 4,
              "userOne has 1000000000000 units of BKLNs"
            );

            expect(await mockERC20.balanceOf(userTwo.address)).to.be.equal(
              totalSupplyOfERC20 / 4,
              "userTwo has ${totalSupplyOfERC20 / 4}$ units of BKLNs"
            );

            expect(await mockUSDC.balanceOf(userOne.address)).to.be.equal(
              totalSupplyOfMockUSDC / 2 - totalSupplyOfERC20 / 4,
              "userOne has ${totalSupplyOfMockUSDC / 2 - totalSupplyOfERC20 / 4}$ units of USDC left"
            );
            expect(await mockUSDT.balanceOf(userTwo.address)).to.be.equal(
              totalSupplyOfMockUSDT / 2 - totalSupplyOfERC20 / 4,
              "userTwo has ${totalSupplyOfMockUSDT / 2 - totalSupplyOfERC20 / 4}$ units of USDC left"
            );

            expect(await timedAllowanceCrowdsale.remainingTokens()).to.be.equal(
              totalSupplyOfERC20 - totalSupplyOfERC20 / 2,
              "there are ${totalSupplyOfERC20 - totalSupplyOfERC20 / 2}$ remaining tokens"
            );
          });
        });
      });

      describe("when multiple users try to buy BKLNs that is more than the total supply using USDT and USD", () => {
        it("only purchases BLKNs that are within the purchasing limits", async () => {
          await timedAllowanceCrowdsale.setCap(
            userOne.address,
            totalSupplyOfERC20 / 4
          );
          const usdcBalanceOfUserOne = await mockUSDC.balanceOf(
            userOne.address
          );
          await expect(
            timedAllowanceCrowdsale
              .connect(userOne)
              .buyTokens(
                userOne.address,
                totalSupplyOfERC20 * 2,
                mockUSDC.address
              )
          ).to.be.revertedWith("beneficiary's cap exceeded");

          expect(await mockERC20.balanceOf(userOne.address)).to.be.equal(
            0,
            "userOne has 0 units of BKLNs"
          );
          expect(await mockUSDC.balanceOf(userOne.address)).to.be.equal(
            usdcBalanceOfUserOne,
            "userOne has ${usdcBalanceOfUserOne}$ units of USDC left"
          );
        });
      });
    });
  });
});
