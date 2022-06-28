// Only testing pausability tweaks here

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ERC721Mock, IERC20, Settings, TokenVault } from '../typechain'
import {
  deployERC20Mock,
  deployERC721Mock,
  deploySettings,
  deployTokenVault,
  deployVaultFactory,
} from '../utils/deployment'

describe('ERC721TokenVault', () => {
  let signer: SignerWithAddress
  let user: SignerWithAddress
  let crowdsaleContract: SignerWithAddress
  let settings: Settings
  let tokenVault: TokenVault
  let supportRole: string
  let senderRole: string
  let mockUSDC: IERC20
  let dummyNFT: ERC721Mock
  const decimals = 6
  const nftPrice = ethers.utils.parseUnits('4000000', decimals)
  const tokenSupply = ethers.utils.parseUnits('4000000', decimals)
  const usdcSupply = ethers.utils.parseUnits('100000000', decimals)

  beforeEach(async () => {
    ;[signer, user, crowdsaleContract] = await ethers.getSigners()

    mockUSDC = await deployERC20Mock(signer, 'Usdc', 'USDC', usdcSupply)
    settings = await deploySettings()
    const vaultFactory = await deployVaultFactory(settings)

    dummyNFT = await deployERC721Mock()
    await dummyNFT.mint(signer.address, 0)
    await dummyNFT.approve(vaultFactory.address, 0)

    tokenVault = await deployTokenVault(mockUSDC, dummyNFT, 0, vaultFactory, 'Banksy Laugh Now', 'BKLN', tokenSupply)
    supportRole = await tokenVault.SUPPORT_ROLE()
    senderRole = await tokenVault.SENDER_ROLE()
    await mockUSDC.approve(tokenVault.address, ethers.constants.MaxUint256)
    await mockUSDC.connect(user).approve(tokenVault.address, ethers.constants.MaxUint256)
  })

  describe('pausing access control', () => {
    it('signer is support', async () => {
      expect(await tokenVault.hasRole(supportRole, signer.address)).to.be.true
    })

    it('user is not support', async () => {
      expect(await tokenVault.hasRole(supportRole, user.address)).to.be.false
    })

    it('support can pause', async () => {
      await tokenVault.pause()
      expect(await tokenVault.paused()).to.be.true
    })

    it('support can unpause', async () => {
      await tokenVault.pause()
      await tokenVault.unpause()
      expect(await tokenVault.paused()).to.be.false
    })

    it('user cannot pause', async () => {
      await expect(tokenVault.connect(user).pause()).to.be.reverted
    })

    it('user cannot unpause', async () => {
      await tokenVault.pause()
      await expect(tokenVault.connect(user).unpause()).to.be.reverted
    })
  })

  describe('managing access control', () => {
    it('support can add sender', async () => {
      await tokenVault.addSender(crowdsaleContract.address)
      expect(await tokenVault.hasRole(senderRole, crowdsaleContract.address)).to.be.true
    })

    it('support renounces support', async () => {
      await tokenVault.renounceSupport()
      expect(await tokenVault.hasRole(supportRole, signer.address)).to.be.false
    })
  })

  describe('pausing prevents transfers', () => {
    it('blocks non-senders from sending when paused', async () => {
      await tokenVault.pause()
      await expect(tokenVault.connect(crowdsaleContract).transfer(user.address, 1)).to.be.reverted
      await expect(tokenVault.connect(user).transfer(user.address, 1)).to.be.reverted
    })

    it('allows senders to send', async () => {
      const amount = 1
      await tokenVault.pause()
      await tokenVault.approve(crowdsaleContract.address, amount)
      await tokenVault.addSender(crowdsaleContract.address)
      await expect(tokenVault.connect(crowdsaleContract).transferFrom(signer.address, user.address, amount)).to.not.be
        .reverted
      expect(await tokenVault.balanceOf(user.address)).to.be.equal(amount)
    })
  })

  describe('usdc', () => {
    describe('reserve price', () => {
      it('allows users set reserve price in usdc', async () => {
        const firstPrice = nftPrice.mul(2)
        await expect(tokenVault.updateUserPrice(firstPrice)).not.to.be.reverted
      })

      it('rejects excessive usdc reserve price', async () => {
        // NOTE: reserve price limits doe not take effect if only one voting
        tokenVault.transfer(user.address, tokenSupply.div(2))
        const maxReserveFactor = await settings.maxReserveFactor()
        const firstPrice = nftPrice.mul(2)
        const newPrice = firstPrice.mul(maxReserveFactor.div(1000).add(1))
        await tokenVault.updateUserPrice(firstPrice)
        await tokenVault.connect(user).updateUserPrice(firstPrice)
        await expect(tokenVault.updateUserPrice(newPrice)).to.be.revertedWith('update:reserve price too high')
      })

      it('rejects insufficient usdc reserve price', async () => {
        // NOTE: reserve price limits doe not take effect if only one voting
        tokenVault.transfer(user.address, tokenSupply.div(2))
        const minReserveFactor = await settings.minReserveFactor()
        const firstPrice = nftPrice.mul(2)
        const newPrice = firstPrice.mul(minReserveFactor).div(2 * 1000)
        await tokenVault.updateUserPrice(firstPrice)
        console.log(minReserveFactor)
        await tokenVault.connect(user).updateUserPrice(firstPrice)
        await expect(tokenVault.updateUserPrice(newPrice)).to.be.revertedWith('update:reserve price too low')
      })
    })

    describe('auction', () => {
      it('allows users to start auction', async () => {
        const firstPrice = nftPrice.mul(2)
        await tokenVault.updateUserPrice(firstPrice)
        await tokenVault.toggleAuctions()
        await tokenVault.start(firstPrice)
        expect(await tokenVault.winning()).to.be.equal(signer.address)
        expect(await tokenVault.livePrice()).to.be.equal(firstPrice)
        const balance = await mockUSDC.balanceOf(tokenVault.address)
        expect(balance.eq(firstPrice)).to.be.true
      })

      it('allows users to bid', async () => {
        const firstPrice = nftPrice.mul(2)
        await tokenVault.updateUserPrice(firstPrice)
        await tokenVault.toggleAuctions()
        mockUSDC.transfer(user.address, usdcSupply.div(2))
        const originalSignerBalance = await mockUSDC.balanceOf(signer.address)
        await tokenVault.start(firstPrice)
        const newPrice = firstPrice.mul(2)
        await tokenVault.connect(user).bid(newPrice)
        expect(await tokenVault.winning()).to.be.equal(user.address)
        expect(await tokenVault.livePrice()).to.be.equal(newPrice)
        const balance = await mockUSDC.balanceOf(tokenVault.address)
        expect(balance.eq(newPrice)).to.be.true
        expect(await mockUSDC.balanceOf(signer.address)).to.be.equal(originalSignerBalance)
      })

      it("doesn't end auction too early", async () => {
        const firstPrice = nftPrice.mul(2)
        await tokenVault.updateUserPrice(firstPrice)
        await tokenVault.toggleAuctions()
        await tokenVault.start(firstPrice)
        await expect(tokenVault.end()).to.be.revertedWith('end:auction live')
      })

      it('transfers nft to winner', async () => {
        const firstPrice = nftPrice.mul(2)
        await tokenVault.updateUserPrice(firstPrice)
        await tokenVault.toggleAuctions()
        await tokenVault.start(firstPrice)
        await ethers.provider.send('evm_increaseTime', [await (await tokenVault.auctionLength()).toNumber()])
        await tokenVault.end()
        expect(await dummyNFT.ownerOf(0)).to.be.equal(signer.address)
      })

      it('pays for burned tokens', async () => {
        const firstPrice = nftPrice.mul(2)
        await tokenVault.updateUserPrice(firstPrice)
        await tokenVault.toggleAuctions()
        await tokenVault.start(firstPrice)
        await ethers.provider.send('evm_increaseTime', [await (await tokenVault.auctionLength()).toNumber()])
        await tokenVault.end()
        await tokenVault.transfer(user.address, tokenSupply)
        await tokenVault.connect(user).cash()
        expect(await mockUSDC.balanceOf(user.address)).to.be.equal(firstPrice)
      })
    })
  })
})
