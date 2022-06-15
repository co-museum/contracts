import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20Mock } from "../typechain";
import { MembershipERC721 } from "../typechain/MembershipERC721";

describe("MembershipERC721", () => {
  let mockERC20: ERC20Mock;
  let membershipERC721: MembershipERC721;
  let signer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [signer, user] = await ethers.getSigners()

    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockERC20 = await MockERC20.deploy(
      "Mock", "MCK", signer.address, ethers.utils.parseEther("4000000")
    )
    await mockERC20.deployed()

    const MembershipERC721 = await ethers.getContractFactory("MembershipERC721");
    membershipERC721 = await MembershipERC721.deploy();
    await membershipERC721.deployed();
    await membershipERC721.initialize( "Membership", "MBR", mockERC20.address, 2, 4, 6);

    mockERC20.approve(
      membershipERC721.address,
      ethers.constants.MaxUint256,
    )

    mockERC20.connect(user).approve(
      membershipERC721.address,
      ethers.constants.MaxUint256,
    )

  })

  describe("redeem", () => {
    afterEach(async () => {
      expect(await mockERC20.balanceOf(user.address)).to.be.equal(0, "not locking correct amount of ERC20")
      expect(await membershipERC721.balanceOf(user.address)).to.be.equal(1, "not transferring membership NFT")
    })

    it("redeems genesis", async () => {
      const amt = ethers.utils.parseUnits("40000", await mockERC20.decimals())
      mockERC20.transfer(user.address, amt)
      await membershipERC721.connect(user).redeemGenesis()
    });

    it("redeems foundation", async () => {
      const amt = ethers.utils.parseUnits("4000", await mockERC20.decimals())
      mockERC20.transfer(user.address, amt)
      await membershipERC721.connect(user).redeemFoundation()
    });

    it("redeems friend", async () => {
      const amt = ethers.utils.parseUnits("400", await mockERC20.decimals())
      mockERC20.transfer(user.address, amt)
      await membershipERC721.connect(user).redeemFriend()
    });
  })

  describe("redeem insufficient ballance", () => {
    it("rejects insufficient genesis balance", async () => {
      const amt = ethers.utils.parseUnits("39999", await mockERC20.decimals())
      mockERC20.transfer(user.address, amt)
      await expect(membershipERC721.connect(user).redeemGenesis()).to.be.reverted;
    })
    it("rejects insufficient foundation balance", async () => {
      const amt = ethers.utils.parseUnits("3999", await mockERC20.decimals())
      mockERC20.transfer(user.address, amt)
      await expect(membershipERC721.connect(user).redeemFoundation()).to.be.reverted;
    })
    it("rejects insufficient foundation balance", async () => {
      const amt = ethers.utils.parseUnits("399", await mockERC20.decimals())
      mockERC20.transfer(user.address, amt)
      await expect(membershipERC721.connect(user).redeemFriend()).to.be.reverted;
    })
  })

  describe("release", () => {
    let genesisId: number;
    let foundationId: number;
    let friendId: number;

    before(async () => {
      genesisId = (await membershipERC721.genesisTier()).start
      foundationId = (await membershipERC721.foundationTier()).start
      friendId = (await membershipERC721.friendTier()).start
    })

    beforeEach(async () => {
      const amt = ethers.utils.parseUnits("44400", await mockERC20.decimals())
      mockERC20.transfer(user.address, amt)
      await membershipERC721.connect(user).redeemGenesis()
      await membershipERC721.connect(user).redeemFoundation()
      await membershipERC721.connect(user).redeemFriend()

      membershipERC721.connect(user).approve(membershipERC721.address, genesisId)
      membershipERC721.connect(user).approve(membershipERC721.address, foundationId)
      membershipERC721.connect(user).approve(membershipERC721.address, friendId)
    })

    it("releases genesis", async () => {
      await membershipERC721.connect(user).release(genesisId)
      const amt = ethers.utils.parseUnits("40000", await mockERC20.decimals())
      expect(await mockERC20.balanceOf(user.address)).to.be.equal(amt, "not releasing correct amount of ERC20")
    })

    it("releases foundation", async () => {
      await membershipERC721.connect(user).release(foundationId)
      const amt = ethers.utils.parseUnits("4000", await mockERC20.decimals())
      expect(await mockERC20.balanceOf(user.address)).to.be.equal(amt, "not releasing correct amount of ERC20")
    })

    it("releases friend", async () => {
      await membershipERC721.connect(user).release(friendId)
      const amt = ethers.utils.parseUnits("400", await mockERC20.decimals())
      expect(await mockERC20.balanceOf(user.address)).to.be.equal(amt, "not releasing correct amount of ERC20")
    })
  })

  describe("running out of tokens", () => {
    it("runs out of genesis", async () => {
      const start = (await membershipERC721.genesisTier()).start
      const end = (await membershipERC721.genesisTier()).end
      for (let i = start; i < end; i++) {
        await membershipERC721.redeemGenesis()
      }
      expect(membershipERC721.redeemGenesis()).to.be.reverted
    })

    it("runs out of foundation", async () => {
      const start = (await membershipERC721.foundationTier()).start
      const end = (await membershipERC721.foundationTier()).end
      for (let i = start; i < end; i++) {
        await membershipERC721.redeemFoundation()
      }
      expect(membershipERC721.redeemFoundation()).to.be.reverted
    })

    it("runs out of friend", async () => {
      const start = (await membershipERC721.friendTier()).start
      const end = (await membershipERC721.friendTier()).end
      for (let i = start; i < end; i++) {
        await membershipERC721.redeemFriend()
      }
      expect(membershipERC721.redeemFriend()).to.be.reverted
    })
  })

  describe("redeem released", () => {
    it("redeems released genesis", async () => {
      const start = (await membershipERC721.genesisTier()).start
      await expect(membershipERC721.redeemGenesis()).to.emit(
        membershipERC721, "Redeem"
      ).withArgs(signer.address, start)
      await expect(membershipERC721.release(start)).to.emit(
        membershipERC721, "Release"
      ).withArgs(signer.address, start)
      await expect(membershipERC721.redeemGenesis()).to.emit(
        membershipERC721, "Redeem"
      ).withArgs(signer.address, start)
    })

    it("redeems released foundation", async () => {
      const start = (await membershipERC721.foundationTier()).start
      await expect(membershipERC721.redeemFoundation()).to.emit(
        membershipERC721, "Redeem"
      ).withArgs(signer.address, start)
      await expect(membershipERC721.release(start)).to.emit(
        membershipERC721, "Release"
      ).withArgs(signer.address, start)
      await expect(membershipERC721.redeemFoundation()).to.emit(
        membershipERC721, "Redeem"
      ).withArgs(signer.address, start)
    })

    it("redeems released friend", async () => {
      const start = (await membershipERC721.friendTier()).start
      await expect(membershipERC721.redeemFriend()).to.emit(
        membershipERC721, "Redeem"
      ).withArgs(signer.address, start)
      await expect(membershipERC721.release(start)).to.emit(
        membershipERC721, "Release"
      ).withArgs(signer.address, start)
      await expect(membershipERC721.redeemFriend()).to.emit(
        membershipERC721, "Redeem"
      ).withArgs(signer.address, start)
    })
  })
});
