import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC721MembershipUpgradeable, ERC20Mock } from "../typechain";

describe("ERC721MembershipUpgradeable", () => {
  let mockERC20: ERC20Mock;
  let membershipERC721: ERC721MembershipUpgradeable;
  let signer: SignerWithAddress;
  let user: SignerWithAddress;

  const decimals = 6;
  const genesisCode = 0;
  const foundationCode = 1;
  const friendsCode = 2;

  beforeEach(async () => {
    [signer, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockERC20 = await MockERC20.deploy(
      "Mock",
      "MCK",
      signer.address,
      ethers.utils.parseUnits("4000000", decimals),
      decimals
    );
    await mockERC20.deployed();

    const MembershipERC721 = await ethers.getContractFactory(
      "ERC721MembershipUpgradeable"
    );
    membershipERC721 = await MembershipERC721.deploy();
    await membershipERC721.deployed();
    await membershipERC721.initialize(
      "Membership",
      "MBR",
      mockERC20.address,
      2,
      4,
      6
    );

    mockERC20.approve(membershipERC721.address, ethers.constants.MaxUint256);
    mockERC20.connect(user).approve(membershipERC721.address, ethers.constants.MaxUint256);
  });

  describe("redeem", () => {
    afterEach(async () => {
      // expect(await mockERC20.balanceOf(user.address)).to.be.equal(0, "not locking correct amount of ERC20")
      expect(await membershipERC721.balanceOf(user.address)).to.be.equal(
        1,
        "not transferring membership NFT"
      );
    });

    it("redeems genesis", async () => {
      await membershipERC721.redeem(genesisCode, signer.address, user.address);
    });

    it("redeems foundation", async () => {
      await membershipERC721.redeem(
        foundationCode,
        signer.address,
        user.address
      );
    });

    it("redeems friend", async () => {
      await membershipERC721.redeem(friendsCode, signer.address, user.address);
    });
  });

  describe("redeem insufficient ballance", () => {
    it("rejects insufficient genesis balance", async () => {
      await expect(
        membershipERC721.redeem(genesisCode, user.address, user.address)
      ).to.be.reverted;
    });
    it("rejects insufficient foundation balance", async () => {
      await expect(
        membershipERC721.redeem(genesisCode, user.address, user.address)
      ).to.be.reverted;
    });
    it("rejects insufficient foundation balance", async () => {
      await expect(
        membershipERC721.redeem(friendsCode, user.address, user.address)
      ).to.be.reverted;
    });
  });

  describe("release", () => {
    let genesisId: number;
    let foundationId: number;
    let friendId: number;

    before(async () => {
      genesisId = (await membershipERC721.genesisTier()).start;
      foundationId = (await membershipERC721.foundationTier()).start;
      friendId = (await membershipERC721.friendTier()).start;
    });

    beforeEach(async () => {

      // await membershipERC721
      //   .connect(user)
      //   .redeem(foundationCode, user.address, user.address);
      // await membershipERC721
      //   .connect(user)
      //   .redeem(friendsCode, user.address, user.address);

      // membershipERC721
      //   .connect(user)
      //   .approve(membershipERC721.address, foundationId);
      // membershipERC721
      //   .connect(user)
      //   .approve(membershipERC721.address, friendId);
    });

    it("releases genesis", async () => {
      const price = await membershipERC721.getTierPrice(genesisCode)
      mockERC20.transfer(user.address, price);
      await membershipERC721.connect(user).redeem(genesisCode, user.address, user.address);
      membershipERC721.connect(user).approve(membershipERC721.address, genesisId);
      await membershipERC721.connect(user).release(genesisId);
      expect(await mockERC20.balanceOf(user.address)).to.be.equal(
        price, "not releasing correct amount of ERC20"
      );
    });

    it("releases foundation", async () => {
      const price = await membershipERC721.getTierPrice(foundationCode)
      mockERC20.transfer(user.address, price);
      await membershipERC721.connect(user).redeem(foundationCode, user.address, user.address);
      await membershipERC721.connect(user).release(foundationId);
      expect(await mockERC20.balanceOf(user.address)).to.be.equal(
        price, "not releasing correct amount of ERC20"
      );
    });

    it("releases friends", async () => {
      const price = await membershipERC721.getTierPrice(friendsCode)
      mockERC20.transfer(user.address, price);
      await membershipERC721.connect(user).redeem(friendsCode, user.address, user.address);
      await membershipERC721.connect(user).release(friendId);
      expect(await mockERC20.balanceOf(user.address)).to.be.equal(
        price, "not releasing correct amount of ERC20"
      );
    });


  });

  describe("running out of tokens", () => {
    it("runs out of genesis", async () => {
      const start = (await membershipERC721.genesisTier()).start;
      const end = (await membershipERC721.genesisTier()).end;
      for (let i = start; i < end; i++) {
        await membershipERC721.redeem(
          genesisCode,
          signer.address,
          signer.address
        );
      }
      expect(
        membershipERC721.redeem(genesisCode, signer.address, signer.address)
      ).to.be.reverted;
    });

    it("runs out of foundation", async () => {
      const start = (await membershipERC721.foundationTier()).start;
      const end = (await membershipERC721.foundationTier()).end;
      for (let i = start; i < end; i++) {
        await membershipERC721.redeem(
          genesisCode,
          signer.address,
          signer.address
        );
      }
      expect(
        membershipERC721.redeem(foundationCode, signer.address, signer.address)
      ).to.be.reverted;
    });

    it("runs out of friend", async () => {
      const start = (await membershipERC721.friendTier()).start;
      const end = (await membershipERC721.friendTier()).end;
      for (let i = start; i < end; i++) {
        await membershipERC721.redeem(
          friendsCode,
          signer.address,
          signer.address
        );
      }
      expect(
        membershipERC721.redeem(friendsCode, signer.address, signer.address)
      ).to.be.reverted;
    });
  });

  describe("redeem released", () => {
    it("redeems released genesis", async () => {
      const start = (await membershipERC721.genesisTier()).start;
      await expect(
        membershipERC721.redeem(genesisCode, signer.address, signer.address)
      )
        .to.emit(membershipERC721, "Redeem")
        .withArgs(signer.address, start);
      console.log(start);
      await expect(membershipERC721.release(start))
        .to.emit(membershipERC721, "Release")
        .withArgs(signer.address, start);
      await expect(
        membershipERC721.redeem(genesisCode, signer.address, signer.address)
      )
        .to.emit(membershipERC721, "Redeem")
        .withArgs(signer.address, start);
    });

    it("redeems released foundation", async () => {
      const start = (await membershipERC721.foundationTier()).start;
      await expect(
        membershipERC721.redeem(foundationCode, signer.address, signer.address)
      )
        .to.emit(membershipERC721, "Redeem")
        .withArgs(signer.address, start);
      await expect(membershipERC721.release(start))
        .to.emit(membershipERC721, "Release")
        .withArgs(signer.address, start);
      await expect(
        membershipERC721.redeem(foundationCode, signer.address, signer.address)
      )
        .to.emit(membershipERC721, "Redeem")
        .withArgs(signer.address, start);
    });

    it("redeems released friend", async () => {
      const start = (await membershipERC721.friendTier()).start;
      await expect(
        membershipERC721.redeem(friendsCode, signer.address, signer.address)
      )
        .to.emit(membershipERC721, "Redeem")
        .withArgs(signer.address, start);
      await expect(membershipERC721.release(start))
        .to.emit(membershipERC721, "Release")
        .withArgs(signer.address, start);
      await expect(
        membershipERC721.redeem(friendsCode, signer.address, signer.address)
      )
        .to.emit(membershipERC721, "Redeem")
        .withArgs(signer.address, start);
    });
  });

  describe("pausability", () => {
    let signer: SignerWithAddress;
    let user: SignerWithAddress;
    let membershipERC721: ERC721MembershipUpgradeable;
    let mockERC20: ERC20Mock;
    let supportRole: string;
    let senderRole: string;

    beforeEach(async () => {
      [signer, user] = await ethers.getSigners();

      const MockERC20 = await ethers.getContractFactory("ERC20Mock");
      mockERC20 = await MockERC20.deploy(
        "Dummy",
        "DMY",
        signer.address,
        ethers.utils.parseUnits("4000000", decimals),
        6
      );
      await mockERC20.deployed();

      const MembershipERC721 = await ethers.getContractFactory(
        "ERC721MembershipUpgradeable"
      );
      membershipERC721 = await MembershipERC721.deploy();
      await membershipERC721.deployed();
      await membershipERC721.initialize(
        "Member",
        "MBR",
        mockERC20.address,
        2,
        4,
        6
      );

      supportRole = await membershipERC721.SUPPORT_ROLE();
      senderRole = await membershipERC721.SENDER_ROLE();
    });

    describe("pausing access control", () => {
      it("signer is support", async () => {
        expect(await membershipERC721.hasRole(supportRole, signer.address)).to
          .be.true;
      });

      it("user is not support", async () => {
        expect(await membershipERC721.hasRole(supportRole, user.address)).to.be
          .false;
      });

      it("support can pause", async () => {
        await membershipERC721.pause();
        expect(await membershipERC721.paused()).to.be.true;
      });

      it("support can unpause", async () => {
        await membershipERC721.pause();
        await membershipERC721.unpause();
        expect(await membershipERC721.paused()).to.be.false;
      });

      it("user cannot pause", async () => {
        await expect(membershipERC721.connect(user).pause()).to.be.reverted;
      });

      it("user cannot unpause", async () => {
        await membershipERC721.pause();
        await expect(membershipERC721.connect(user).unpause()).to.be.reverted;
      });
    });

    describe("managing access control", () => {
      it("support can add sender", async () => {
        await membershipERC721.addSender(membershipERC721.address);
        expect(
          await membershipERC721.hasRole(senderRole, membershipERC721.address)
        ).to.be.true;
      });

      it("support renounces support", async () => {
        await membershipERC721.renounceSupport();
        expect(await membershipERC721.hasRole(supportRole, signer.address)).to
          .be.false;
      });
    });

    describe("pausing prevents transfers", () => {
      // it("blocks non-senders from sending when paused", async () => {
      //   await membershipERC721.pause()
      //   await mockERC20.approve(membershipERC721.address, ethers.utils.parseUnits("400", decimals))
      //   await membershipERC721.redeemFriend()
      //   await expect(membershipERC721.transferFrom(signer.address, user.address, 0)).to.be.reverted
      // })

      it("allows senders to send", async () => {
        await membershipERC721.pause();
        await membershipERC721.addSender(signer.address);
        await mockERC20.approve(
          membershipERC721.address,
          ethers.utils.parseUnits("400", decimals)
        );
        await membershipERC721.redeem(
          friendsCode,
          signer.address,
          signer.address
        );
        const id = (await membershipERC721.friendTier()).start;
        await expect(
          membershipERC721.transferFrom(signer.address, user.address, id)
        ).to.not.be.reverted;
        expect(await membershipERC721.ownerOf(id)).to.be.equal(user.address);
      });
    });
  });
});
