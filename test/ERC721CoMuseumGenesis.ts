import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ERC721CoMuseumGenesis, ERC20Mock } from '../typechain'

describe('ERC721CoMuseumGenesis', () => {
  let erc721CoMuseumGenesis: ERC721CoMuseumGenesis
  let signer: SignerWithAddress
  let user1: SignerWithAddress

  beforeEach(async () => {
    ;[signer, user1] = await ethers.getSigners()

    const ERC721CoMuseumGenesis = await ethers.getContractFactory('ERC721CoMuseumGenesis')
    erc721CoMuseumGenesis = await ERC721CoMuseumGenesis.deploy(signer.address)
    await erc721CoMuseumGenesis.deployed()
  })

  describe('airdrop', () => {
    it('can airdrop one NFT', async () => {
      await erc721CoMuseumGenesis.airdrop(user1.address, 1)
      expect(await erc721CoMuseumGenesis.ownerOf(0)).to.be.equal(user1.address)
    })

    it('can airdrop multiple NFTs', async () => {
      await erc721CoMuseumGenesis.airdrop(user1.address, 5)
      for (let i = 0; i < 5; i++) {
        expect(await erc721CoMuseumGenesis.ownerOf(i)).to.be.equal(user1.address)
      }
    })
  })

  describe('royalty', () => {
    it('can set default royalty', async () => {
      // 500 is 5 percent since _feeDenominator defaults to basis points
      await expect(erc721CoMuseumGenesis.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
    })

    it('can delete default royalty', async () => {
      await expect(erc721CoMuseumGenesis.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await expect(erc721CoMuseumGenesis.deleteDefaultRoyalty()).to.not.be.reverted
    })

    it('can set royalty for a specific token', async () => {
      await expect(erc721CoMuseumGenesis.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await erc721CoMuseumGenesis.airdrop(user1.address, 5)
      await expect(erc721CoMuseumGenesis.setTokenRoyalty(3, signer.address, 700)).to.not.be.reverted
    })
    it('can reset default royalty for a specific token to the global default', async () => {
      await expect(erc721CoMuseumGenesis.setDefaultRoyalty(signer.address, 500)).to.not.be.reverted
      await erc721CoMuseumGenesis.airdrop(user1.address, 5)
      await expect(erc721CoMuseumGenesis.setTokenRoyalty(3, signer.address, 700)).to.not.be.reverted
      await expect(erc721CoMuseumGenesis.resetTokenRoyalty(3)).to.not.be.reverted
    })
  })
})
