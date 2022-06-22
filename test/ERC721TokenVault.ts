// Only testing pausability tweaks here

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenVault } from "../typechain";

enum State {
    INACTIVE, LIVE, ENDED, REDEEMED, DISABLED
}

describe("ERC721TokenVault", () => {
    let signer: SignerWithAddress;
    let user: SignerWithAddress;
    let crowdsaleContract: SignerWithAddress;
    let tokenVault: TokenVault
    let supportRole: string
    let senderRole: string

    beforeEach(async () => {
        [signer, user, crowdsaleContract] = await ethers.getSigners()

        const Settings = await ethers.getContractFactory("Settings");
        const settings = await Settings.deploy();
        await settings.deployed();

        const VaultFactory = await ethers.getContractFactory("ERC721VaultFactory");
        const vaultFactory = await VaultFactory.deploy(settings.address);
        await vaultFactory.deployed();

        const DummyNFT = await ethers.getContractFactory("ERC721Mock");
        const dummyNFT = await DummyNFT.deploy("Dummy", "DMY");
        await dummyNFT.deployed();

        await dummyNFT.mint(signer.address, 0)
        await dummyNFT.approve(vaultFactory.address, 0)
        const tx = await vaultFactory.mint(
            "Dummy Frac", // name
            "DMYF", // symbol
            dummyNFT.address, // token
            0, // tokenID
            ethers.utils.parseEther("10000"), // supply
            10, // listPrice
            0, // fee
        )

        const receipt = await tx.wait()
        const [mintEvent] = receipt.events!.filter((event, i, arr) => event.event == "Mint")
        const vaultAddress = mintEvent.args!['vault']
        tokenVault = await ethers.getContractAt("TokenVault", vaultAddress)
        supportRole = await tokenVault.SUPPORT_ROLE()
        senderRole = await tokenVault.SENDER_ROLE()
    })

    describe("pausing access control", () => {
        it("signer is support", async () => {
            expect(await tokenVault.hasRole(supportRole, signer.address)).to.be.true
        })

        it("user is not support", async () => {
            expect(await tokenVault.hasRole(supportRole, user.address)).to.be.false
        })

        it("support can pause", async () => {
            await tokenVault.pause()
            expect(await tokenVault.paused()).to.be.true
        })

        it("support can unpause", async () => {
            await tokenVault.pause()
            await tokenVault.unpause()
            expect(await tokenVault.paused()).to.be.false
        })

        it("user cannot pause", async () => {
            await expect(tokenVault.connect(user).pause()).to.be.reverted
        })

        it("user cannot unpause", async () => {
            await tokenVault.pause()
            await expect(tokenVault.connect(user).unpause()).to.be.reverted
        })
    })

    describe("managing access control", () => {
        it("support can add sender", async () => {
            await tokenVault.addSender(crowdsaleContract.address)
            expect(await tokenVault.hasRole(senderRole, crowdsaleContract.address)).to.be.true
        })

        it("support renounces support", async () => {
            await tokenVault.renounceSupport()
            expect(await tokenVault.hasRole(supportRole, signer.address)).to.be.false
        })
    })

    describe("pausing prevents transfers", () => {
        it("blocks non-senders from sending when paused", async () => {
            await tokenVault.pause()
            await expect(tokenVault.connect(crowdsaleContract).transfer(user.address, 1)).to.be.reverted
            await expect(tokenVault.connect(user).transfer(user.address, 1)).to.be.reverted
        })

        it("allows senders to send", async () => {
            const amount = 1
            await tokenVault.pause()
            await tokenVault.approve(crowdsaleContract.address, amount)
            await tokenVault.addSender(crowdsaleContract.address)
            await expect(tokenVault.connect(crowdsaleContract).transferFrom(
                signer.address, user.address, amount)
            ).to.not.be.reverted
            expect(await tokenVault.balanceOf(user.address)).to.be.equal(amount)
        })
    })

    describe("toggle auction", () => {
        it("allows governance to enable auctions", async () => {
            expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
            tokenVault.toggleAuction()
            expect(await tokenVault.auctionState()).to.be.equal(State.INACTIVE)
        })

        it("allows governance to disable auctions", async () => {
            expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
            tokenVault.toggleAuction()
            expect(await tokenVault.auctionState()).to.be.equal(State.INACTIVE)
            tokenVault.toggleAuction()
            expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
        })

        it("doesn't allow user to enable auctions", async() => {
            expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
            await expect(tokenVault.connect(user).toggleAuction()).to.be.revertedWith("toggle:not gov")
            expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
        })
    })
});