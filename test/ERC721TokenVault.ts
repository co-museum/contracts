// Only testing pausability tweaks here

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { settings } from 'cluster'
import { ethers } from 'hardhat'
import { ERC20Mock, IERC20, Settings, TokenVault } from '../typechain'
import { deployERC20Mock, deployERC721Mock, deployTokenVault, deployVaultFactory } from '../utils/deployment'

describe('ERC721TokenVault', () => {
  let signer: SignerWithAddress
  let user: SignerWithAddress
  let crowdsaleContract: SignerWithAddress
  let tokenVault: TokenVault
  let supportRole: string
  let senderRole: string
  let mockUSDC: IERC20
  const decimals = 6
  const nftPrice = ethers.utils.parseUnits('4000000', decimals)

  beforeEach(async () => {
    ;[signer, user, crowdsaleContract] = await ethers.getSigners()

    mockUSDC = await deployERC20Mock(signer, 'Usdc', 'USDC')
    const vaultFactory = await deployVaultFactory()

    const dummyNFT = await deployERC721Mock()
    await dummyNFT.mint(signer.address, 0)
    await dummyNFT.approve(vaultFactory.address, 0)

    tokenVault = await deployTokenVault(mockUSDC, dummyNFT, 0, vaultFactory)
    supportRole = await tokenVault.SUPPORT_ROLE()
    senderRole = await tokenVault.SENDER_ROLE()
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

  describe('usdc auction', () => {
    it('allows users to start auction in usdc', async () => {
      const newPrice = nftPrice.mul(2)
      await tokenVault.updateUserPrice(newPrice)
      await tokenVault.toggleAuctions()
      await mockUSDC.approve(tokenVault.address, ethers.constants.MaxUint256)
      await tokenVault.start(newPrice)
      expect(await tokenVault.winning()).to.be.equal(signer.address)
      expect(await tokenVault.livePrice()).to.be.equal(newPrice)
      const balance = await mockUSDC.balanceOf(tokenVault.address)
      expect(balance.eq(newPrice)).to.be.true
    })

    // TODO: manipulate time and test auction payout
  })
})
