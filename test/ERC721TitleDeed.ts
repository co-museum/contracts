import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ERC721ArtNFT } from '../typechain'

describe('ERC721TitleDeed', () => {
  let erc721ArtNFT: ERC721ArtNFT
  let signer: SignerWithAddress

  beforeEach(async () => {
    ;[signer] = await ethers.getSigners()

    const ERC721ArtNFT = await ethers.getContractFactory('ERC721ArtNFT')
    erc721ArtNFT = await ERC721ArtNFT.deploy(signer.address)
    await erc721ArtNFT.deployed()
  })

  describe('airdrop', () => {
    it('can mint one NFT at a time', async () => {
      await erc721ArtNFT.mint(signer.address)
      expect(await erc721ArtNFT.ownerOf(0)).to.be.equal(signer.address)
    })

    it('can add multiple NFTs to the collection', async () => {
      for (let i = 0; i < 5; i++) {
        await erc721ArtNFT.mint(signer.address)
        expect(await erc721ArtNFT.ownerOf(i)).to.be.equal(signer.address)
      }
    })
  })

  describe('royalty', () => {
    it('can set default royalty', async () => {
      // 500 is 5 percent since _feeDenominator defaults to basis points
      await expect(erc721ArtNFT.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
    })

    it('can delete default royalty', async () => {
      await expect(erc721ArtNFT.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await expect(erc721ArtNFT.deleteDefaultRoyalty()).to.not.be.reverted
    })

    it('can set royalty for a specific token', async () => {
      await expect(erc721ArtNFT.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await erc721ArtNFT.mint(signer.address)
      await expect(erc721ArtNFT.setTokenRoyalty(3, signer.address, 700)).to.not.be.reverted
    })
    it('can reset default royalty for a specific token to the global default', async () => {
      await expect(erc721ArtNFT.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await erc721ArtNFT.mint(signer.address)
      await expect(erc721ArtNFT.setTokenRoyalty(3, signer.address, 700)).to.not.be.reverted
      await expect(erc721ArtNFT.resetTokenRoyalty(3)).to.not.be.reverted
    })
  })
})
