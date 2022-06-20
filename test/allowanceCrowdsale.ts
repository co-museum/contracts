import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumberish, utils, constants, BigNumber } from "ethers";
import { MerkleTree } from "merkletreejs";
import {
  ERC20Mock,
  AllowanceCrowdsale,
  ERC721MembershipUpgradeable,
} from "../typechain";

describe("AllowanceCrowdsale", () => {
  let mockERC20: ERC20Mock;
  let mockUSDC: ERC20Mock;
  let mockUSDT: ERC20Mock;
  let acceptedStablecoins: string[];
  let signer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let tokeHoldingWallet: SignerWithAddress;
  let treasuryWallet: SignerWithAddress;
  let allowanceCrowdsale: AllowanceCrowdsale;
  let membershipContract: ERC721MembershipUpgradeable;
  const decimals = 6;
  const ethUSDPrice = 1000;
  const totalSupplyOfERC20 = utils.parseUnits("4000000", decimals);
  const totalSupplyOfMockUSDC = utils.parseUnits("9000000", decimals);
  const totalSupplyOfMockUSDT = utils.parseUnits("9000000", decimals);

  function calculateEthRate(ethPrice: BigNumberish): BigNumber {
    // assuming BKLN has 6 decimals and is worht 1 USD
    return ethers.BigNumber.from(10).pow(12).div(ethUSDPrice)
  }

  beforeEach(async () => {

    [signer, user1, user2, user3, tokeHoldingWallet, treasuryWallet] = await ethers.getSigners();
    const rate = 1;

    /**
     * @param mockERC20 Mock ERC20 token representing tokens associated with our art work
     * @param totalSupplyOfERC20 total supply of our mockERC20
     */
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockERC20 = await MockERC20.deploy(
      "Mock",
      "MCK",
      tokeHoldingWallet.address,
      totalSupplyOfERC20.toString(),
      6
    );
    await mockERC20.deployed();

    /**
     * @param mockUSDC Mock ERC20 token representing USDC
     * @param totalSupplyOfERC20 total supply of our mockERC20
     */
    const MockUSDC = await ethers.getContractFactory("ERC20Mock");
    mockUSDC = await MockUSDC.deploy(
      "Usdc",
      "USDC",
      signer.address,
      totalSupplyOfMockUSDC.toString(),
      6
    );
    await mockUSDC.deployed();
    await mockUSDC.transfer(user1.address, totalSupplyOfMockUSDC.div(3))
    await mockUSDC.transfer(user2.address, totalSupplyOfMockUSDC.div(3))
    await mockUSDC.transfer(user3.address, totalSupplyOfMockUSDC.div(3))

    /**
     * @param mockUSDT Mock ERC20 token representing USDT
     * @param totalSupplyOfMockUSDT total supply of our mockERC20
     */
    const MockUSDT = await ethers.getContractFactory("ERC20Mock");
    mockUSDT = await MockUSDC.deploy(
      "Usdc",
      "USDC",
      signer.address,
      totalSupplyOfMockUSDC.toString(),
      6
    );
    await mockUSDT.deployed();
    mockUSDT.approve(user1.address, totalSupplyOfMockUSDT);
    await mockUSDT.transfer(user1.address, totalSupplyOfMockUSDT.div(3))
    await mockUSDT.transfer(user2.address, totalSupplyOfMockUSDT.div(3))
    await mockUSDT.transfer(user3.address, totalSupplyOfMockUSDT.div(3))

    acceptedStablecoins = [mockUSDC.address, mockUSDT.address]

    const MembershipContract = await ethers.getContractFactory("ERC721MembershipUpgradeable")
    membershipContract = await MembershipContract.deploy()
    await membershipContract.deployed()
    await membershipContract.initialize("Membership", "MBR", mockERC20.address, 2, 4, 6)

    const AllowanceCrowdsale = await ethers.getContractFactory("AllowanceCrowdsale");
    allowanceCrowdsale = await AllowanceCrowdsale.deploy(
      mockERC20.address,
      treasuryWallet.address,
      tokeHoldingWallet.address,
      membershipContract.address,
      acceptedStablecoins,
    );
    await allowanceCrowdsale.deployed();
    mockERC20.connect(tokeHoldingWallet).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256);

  });

  describe("whitelisted", () => {
    let treeSingle: MerkleTree
    let treeDouble: MerkleTree

    beforeEach(async () => {
      // one NFT allocated
      const leavesSingle = [user1.address].map(address => utils.keccak256(address))
      treeSingle = new MerkleTree(leavesSingle, utils.keccak256, { sort: true })
      const rootSingle = treeSingle.getHexRoot()

      // two NFTs allocated
      const leavesDouble = [user2.address].map(address => utils.keccak256(address))
      treeDouble = new MerkleTree(leavesDouble, utils.keccak256, { sort: true })
      const rootDouble = treeDouble.getHexRoot()
      await allowanceCrowdsale.setRates(1, calculateEthRate(ethUSDPrice))
      await allowanceCrowdsale.startSale(
        [2, 2], // friend, friend
        [utils.parseUnits("400", decimals), utils.parseUnits("800", decimals)], // BKLN tokens
        [rootSingle, rootDouble] // merkle roots
      )
    })

    describe("BKLN supply", () => {
      it("sells BKLN tokens when there is sufficient supply", async () => {
        await allowanceCrowdsale.connect(user1).buyTokens(
          utils.parseUnits("400", decimals), 0, treeSingle.getHexProof(user1.address), true, constants.AddressZero,
          { value: calculateEthRate(ethUSDPrice).mul(utils.parseUnits("400", decimals)) }
        )
      })
      it("fails to sell BKLN tokens when there is insufficient supply", async () => {
        expect(true).to.be.true
      })
    })
    describe("accepting payment with different currencies", () => { })
  })

  describe("not whitelisted", () => {
    describe("BKLN supply", () => {
    })
    describe("payment with different currencies", () => { })
  })
});
