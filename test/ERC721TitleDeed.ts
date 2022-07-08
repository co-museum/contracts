import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ERC721TitleDeed, ERC20Mock } from '../typechain'

describe('ERC721TitleDeed', () => {
  let erc721TitleDeed: ERC721TitleDeed
  let signer: SignerWithAddress
  let user1: SignerWithAddress

  beforeEach(async () => {
    ;[signer, user1] = await ethers.getSigners()

    const ERC721TitleDeed = await ethers.getContractFactory('ERC721TitleDeed')
    erc721TitleDeed = await ERC721TitleDeed.deploy(signer.address)
    await erc721TitleDeed.deployed()
  })

  describe('airdrop', () => {
    it('can mint one NFT at a time', async () => {
      await erc721TitleDeed.mintTitleDeed(signer.address)
      expect(await erc721TitleDeed.ownerOf(0)).to.be.equal(signer.address)
    })

    it('can add multiple NFTs to the collection', async () => {
      for (let i = 0; i < 5; i++) {
        await erc721TitleDeed.mintTitleDeed(signer.address)
        expect(await erc721TitleDeed.ownerOf(i)).to.be.equal(signer.address)
      }
    })
  })

  describe('royalty', () => {
    it('can set default royalty', async () => {
      // 500 is 5 percent since _feeDenominator defaults to basis points
      await expect(erc721TitleDeed.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
    })

    it('can delete default royalty', async () => {
      await expect(erc721TitleDeed.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await expect(erc721TitleDeed.deleteDefaultRoyalty()).to.not.be.reverted
    })

    it('can set royalty for a specific token', async () => {
      await expect(erc721TitleDeed.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await erc721TitleDeed.mintTitleDeed(signer.address)
      await expect(erc721TitleDeed.setTokenRoyalty(3, signer.address, 700)).to.not.be.reverted
    })
    it('can reset default royalty for a specific token to the global default', async () => {
      await expect(erc721TitleDeed.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await erc721TitleDeed.mintTitleDeed(signer.address)
      await expect(erc721TitleDeed.setTokenRoyalty(3, signer.address, 700)).to.not.be.reverted
      await expect(erc721TitleDeed.resetTokenRoyalty(3)).to.not.be.reverted
    })
  })
})
