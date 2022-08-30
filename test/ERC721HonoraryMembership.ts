import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ERC721HonoraryMembership } from '../typechain'
import { deployHonoraryMembership } from '../utils/deployment'

describe('ERC721HonoraryMembership', () => {
  let erc721HonoraryMembership: ERC721HonoraryMembership
  let signer: SignerWithAddress
  let user1: SignerWithAddress

  beforeEach(async () => {
    ;[signer, user1] = await ethers.getSigners()
    erc721HonoraryMembership = await deployHonoraryMembership(signer.address)
  })

  describe('mint', () => {
    it('can mint one NFT', async () => {
      await erc721HonoraryMembership.mint(user1.address)
      expect(await erc721HonoraryMembership.ownerOf(1)).to.be.equal(user1.address)
    })

    it('can mint multiple NFTs', async () => {
      for (let i = 0; i < 5; i++) {
        await erc721HonoraryMembership.mint(user1.address)
      }
      for (let i = 0; i < 5; i++) {
        expect(await erc721HonoraryMembership.ownerOf(i + 1)).to.be.equal(user1.address)
      }
    })
  })

  describe('royalty', () => {
    it('can set default royalty', async () => {
      // 500 is 5 percent since _feeDenominator defaults to basis points
      await expect(erc721HonoraryMembership.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
    })

    it('can delete default royalty', async () => {
      await expect(erc721HonoraryMembership.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await expect(erc721HonoraryMembership.deleteDefaultRoyalty()).to.not.be.reverted
    })

    it('can set royalty for a specific token', async () => {
      await expect(erc721HonoraryMembership.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await erc721HonoraryMembership.mint(user1.address)
      await expect(erc721HonoraryMembership.setTokenRoyalty(3, signer.address, 700)).to.not.be.reverted
    })
    it('can reset default royalty for a specific token to the global default', async () => {
      await expect(erc721HonoraryMembership.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      for (let i = 0; i < 5; i++) {
        await erc721HonoraryMembership.mint(user1.address)
      }
      await expect(erc721HonoraryMembership.setTokenRoyalty(3, signer.address, 700)).to.not.be.reverted
      await expect(erc721HonoraryMembership.resetTokenRoyalty(3)).to.not.be.reverted
    })
  })
})
