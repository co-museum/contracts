import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC721MembershipUpgradeable, ERC20Mock } from "../typechain";

describe("ERC721MembershipUpgradeable", () => {
  let mockERC20: ERC20Mock;
  let membershipERC721: ERC721MembershipUpgradeable;
  let signer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [signer, user] = await ethers.getSigners()

    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockERC20 = await MockERC20.deploy(
      "Mock", "MCK", signer.address, ethers.utils.parseEther("4000000")
    )
    await mockERC20.deployed()

    const MembershipERC721 = await ethers.getContractFactory("ERC721MembershipUpgradeable");
    membershipERC721 = await MembershipERC721.deploy();
    await membershipERC721.deployed();
    await membershipERC721.initialize("Membership", "MBR", mockERC20.address, 2, 4, 6);

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

  describe("pausability", () => {
    let signer: SignerWithAddress;
    let user: SignerWithAddress;
    let membershipERC721: ERC721MembershipUpgradeable
    let mockERC20: ERC20Mock
    let supportRole: string
    let senderRole: string

    beforeEach(async () => {
      [signer, user] = await ethers.getSigners()

      const MockERC20 = await ethers.getContractFactory("ERC20Mock");
      mockERC20 = await MockERC20.deploy("Dummy", "DMY", signer.address, ethers.utils.parseEther("4000000"));
      await mockERC20.deployed();

      const MembershipERC721 = await ethers.getContractFactory("ERC721MembershipUpgradeable");
      membershipERC721 = await MembershipERC721.deploy();
      await membershipERC721.deployed()
      await membershipERC721.initialize("Member", "MBR", mockERC20.address, 2, 4, 6)

      supportRole = await membershipERC721.SUPPORT_ROLE()
      senderRole = await membershipERC721.SENDER_ROLE()
    })

    describe("pausing access control", () => {
      it("signer is support", async () => {
        expect(await membershipERC721.hasRole(supportRole, signer.address)).to.be.true
      })

      it("user is not support", async () => {
        expect(await membershipERC721.hasRole(supportRole, user.address)).to.be.false
      })

      it("support can pause", async () => {
        await membershipERC721.pause()
        expect(await membershipERC721.paused()).to.be.true
      })

      it("support can unpause", async () => {
        await membershipERC721.pause()
        await membershipERC721.unpause()
        expect(await membershipERC721.paused()).to.be.false
      })

      it("user cannot pause", async () => {
        await expect(membershipERC721.connect(user).pause()).to.be.reverted
      })

      it("user cannot unpause", async () => {
        await membershipERC721.pause()
        await expect(membershipERC721.connect(user).unpause()).to.be.reverted
      })
    })

    describe("managing access control", () => {
      it("support can add sender", async () => {
        await membershipERC721.addSender(membershipERC721.address)
        expect(await membershipERC721.hasRole(senderRole, membershipERC721.address)).to.be.true
      })

      it("support renounces support", async () => {
        await membershipERC721.renounceSupport()
        expect(await membershipERC721.hasRole(supportRole, signer.address)).to.be.false
      })
    })

    describe("pausing prevents transfers", () => {
      // TODO: Fix after crowdsale is implemented (and redeemFor)
      // it("blocks non-senders from sending when paused", async () => {
      //   await membershipERC721.pause()
      //   await mockERC20.approve(membershipERC721.address, ethers.utils.parseEther("400"))
      //   await membershipERC721.redeemFriend()
      //   await expect(membershipERC721.transferFrom(signer.address, user.address, 0)).to.be.reverted
      // })

      it("allows senders to send", async () => {
        await membershipERC721.pause()
        await membershipERC721.addSender(signer.address)
        await mockERC20.approve(membershipERC721.address, ethers.utils.parseEther("400"))
        await membershipERC721.redeemFriend()
        const id = (await membershipERC721.friendTier()).start
        await expect(membershipERC721.transferFrom(
          signer.address, user.address, id)
        ).to.not.be.reverted
        expect(await membershipERC721.ownerOf(id)).to.be.equal(user.address)
      })
    })
  });
});
