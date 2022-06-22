import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ERC721MembershipUpgradeable, ERC20Mock, TokenVault, VoteDelegator } from '../typechain'

enum State {
  DISABLED,
  INACTIVE,
  LIVE,
  ENDED,
  REDEEMED,
}

describe('ERC721MembershipUpgradeable', () => {
  let membershipERC721: ERC721MembershipUpgradeable
  let signer: SignerWithAddress
  let user: SignerWithAddress
  let tokenVault: TokenVault
  let voteDelegator: VoteDelegator

  const decimals = 6
  const genesisCode = 0
  const foundationCode = 1
  const friendsCode = 2
  const initialPrice = ethers.utils.parseEther('4000')

  beforeEach(async () => {
    ;[signer, user] = await ethers.getSigners()

    const Settings = await ethers.getContractFactory('Settings')
    const settings = await Settings.deploy()
    await settings.deployed()

    const VaultFactory = await ethers.getContractFactory('ERC721VaultFactory')
    const vaultFactory = await VaultFactory.deploy(settings.address)
    await vaultFactory.deployed()

    const DummyNFT = await ethers.getContractFactory('ERC721Mock')
    const dummyNFT = await DummyNFT.deploy('Dummy', 'DMY')
    await dummyNFT.deployed()

    await dummyNFT.mint(signer.address, 0)
    await dummyNFT.approve(vaultFactory.address, 0)
    const tx = await vaultFactory.mint(
      'Dummy Frac', // name
      'DMYF', // symbol
      dummyNFT.address, // token
      0, // tokenID
      ethers.utils.parseUnits('4000000', decimals), // supply
      // TODO: tweak once USDC price is implemented
      initialPrice, // list price
      0, // fee
    )

    const receipt = await tx.wait()
    const [mintEvent] = receipt.events!.filter((event, i, arr) => event.event == 'Mint')
    const vaultAddress = mintEvent.args!['vault']
    tokenVault = await ethers.getContractAt('TokenVault', vaultAddress)

    const VoteDelegator = await ethers.getContractFactory('VoteDelegator')
    voteDelegator = await VoteDelegator.deploy()
    await voteDelegator.deployed()
    await voteDelegator.initialize(tokenVault.address)

    const MembershipERC721 = await ethers.getContractFactory('ERC721MembershipUpgradeable')
    membershipERC721 = await MembershipERC721.deploy()
    await membershipERC721.deployed()
    await membershipERC721.initialize('Membership', 'MBR', tokenVault.address, voteDelegator.address, 2, 4, 6)

    tokenVault.approve(membershipERC721.address, ethers.constants.MaxUint256)
    tokenVault.connect(user).approve(membershipERC721.address, ethers.constants.MaxUint256)
  })

  describe('redeem with sufficient balance', () => {
    afterEach(async () => {
      // expect(await mockERC20.balanceOf(user.address)).to.be.equal(0, "not locking correct amount of ERC20")
      expect(await membershipERC721.balanceOf(user.address)).to.be.equal(1, 'not transferring membership NFT')
    })

    it('redeems genesis', async () => {
      await membershipERC721.redeem(genesisCode, signer.address, user.address)
    })

    it('redeems foundation', async () => {
      await membershipERC721.redeem(foundationCode, signer.address, user.address)
    })

    it('redeems friend', async () => {
      await membershipERC721.redeem(friendsCode, signer.address, user.address)
    })
  })

  describe('redeem insufficient ballance', () => {
    it('rejects insufficient genesis balance', async () => {
      await expect(membershipERC721.redeem(genesisCode, user.address, user.address)).to.be.reverted
    })
    it('rejects insufficient foundation balance', async () => {
      await expect(membershipERC721.redeem(genesisCode, user.address, user.address)).to.be.reverted
    })
    it('rejects insufficient foundation balance', async () => {
      await expect(membershipERC721.redeem(friendsCode, user.address, user.address)).to.be.reverted
    })
  })

  describe('release', () => {
    let genesisId: number
    let foundationId: number
    let friendId: number

    before(async () => {
      genesisId = (await membershipERC721.genesisTier()).start.toNumber()
      foundationId = (await membershipERC721.foundationTier()).start.toNumber()
      friendId = (await membershipERC721.friendTier()).start.toNumber()
    })

    it('releases genesis', async () => {
      const price = await membershipERC721.getTierPrice(genesisCode)
      tokenVault.transfer(user.address, price)
      await membershipERC721.connect(user).redeem(genesisCode, user.address, user.address)
      membershipERC721.connect(user).approve(membershipERC721.address, genesisId)
      await membershipERC721.connect(user).release(genesisId)
      expect(await tokenVault.balanceOf(user.address)).to.be.equal(price, 'not releasing correct amount of ERC20')
    })

    it('releases foundation', async () => {
      const price = await membershipERC721.getTierPrice(foundationCode)
      tokenVault.transfer(user.address, price)
      await membershipERC721.connect(user).redeem(foundationCode, user.address, user.address)
      await membershipERC721.connect(user).release(foundationId)
      expect(await tokenVault.balanceOf(user.address)).to.be.equal(price, 'not releasing correct amount of ERC20')
    })

    it('releases friends', async () => {
      const price = await membershipERC721.getTierPrice(friendsCode)
      tokenVault.transfer(user.address, price)
      await membershipERC721.connect(user).redeem(friendsCode, user.address, user.address)
      await membershipERC721.connect(user).release(friendId)
      expect(await tokenVault.balanceOf(user.address)).to.be.equal(price, 'not releasing correct amount of ERC20')
    })
  })

  describe('running out of tokens', () => {
    it('runs out of genesis', async () => {
      const start = (await membershipERC721.genesisTier()).start.toNumber()
      const end = (await membershipERC721.genesisTier()).end.toNumber()
      for (let i = start; i < end; i++) {
        await membershipERC721.redeem(genesisCode, signer.address, signer.address)
      }
      expect(membershipERC721.redeem(genesisCode, signer.address, signer.address)).to.be.reverted
    })

    it('runs out of foundation', async () => {
      const start = (await membershipERC721.foundationTier()).start.toNumber()
      const end = (await membershipERC721.foundationTier()).end.toNumber()
      for (let i = start; i < end; i++) {
        await membershipERC721.redeem(genesisCode, signer.address, signer.address)
      }
      expect(membershipERC721.redeem(foundationCode, signer.address, signer.address)).to.be.reverted
    })

    it('runs out of friend', async () => {
      const start = (await membershipERC721.friendTier()).start.toNumber()
      const end = (await membershipERC721.friendTier()).end.toNumber()
      for (let i = start; i < end; i++) {
        await membershipERC721.redeem(friendsCode, signer.address, signer.address)
      }
      expect(membershipERC721.redeem(friendsCode, signer.address, signer.address)).to.be.reverted
    })
  })

  describe('redeem released', () => {
    it('redeems released genesis', async () => {
      const start = (await membershipERC721.genesisTier()).start
      await expect(membershipERC721.redeem(genesisCode, signer.address, signer.address))
        .to.emit(membershipERC721, 'Redeem')
        .withArgs(signer.address, start)
      await expect(membershipERC721.release(start)).to.emit(membershipERC721, 'Release').withArgs(signer.address, start)
      await expect(membershipERC721.redeem(genesisCode, signer.address, signer.address))
        .to.emit(membershipERC721, 'Redeem')
        .withArgs(signer.address, start)
    })

    it('redeems released foundation', async () => {
      const start = (await membershipERC721.foundationTier()).start
      await expect(membershipERC721.redeem(foundationCode, signer.address, signer.address))
        .to.emit(membershipERC721, 'Redeem')
        .withArgs(signer.address, start)
      await expect(membershipERC721.release(start)).to.emit(membershipERC721, 'Release').withArgs(signer.address, start)
      await expect(membershipERC721.redeem(foundationCode, signer.address, signer.address))
        .to.emit(membershipERC721, 'Redeem')
        .withArgs(signer.address, start)
    })

    it('redeems released friend', async () => {
      const start = (await membershipERC721.friendTier()).start
      await expect(membershipERC721.redeem(friendsCode, signer.address, signer.address))
        .to.emit(membershipERC721, 'Redeem')
        .withArgs(signer.address, start)
      await expect(membershipERC721.release(start)).to.emit(membershipERC721, 'Release').withArgs(signer.address, start)
      await expect(membershipERC721.redeem(friendsCode, signer.address, signer.address))
        .to.emit(membershipERC721, 'Redeem')
        .withArgs(signer.address, start)
    })
  })

  describe('voting', () => {
    it("votes on genesis member's behalf", async () => {
      membershipERC721.redeem(genesisCode, signer.address, signer.address)
      const id = (await membershipERC721.genesisTier()).start
      const price = ethers.utils.parseEther('3500')
      await membershipERC721.updateUserPrice(id, price)
      expect(await tokenVault.userPrices(await membershipERC721.voteDelegators(id))).to.be.equal(price)
    })

    it("votes on foundation member's behalf", async () => {
      membershipERC721.redeem(foundationCode, signer.address, signer.address)
      const id = (await membershipERC721.foundationTier()).start
      const price = ethers.utils.parseEther('4500')
      await membershipERC721.updateUserPrice(id, price)
      expect(await tokenVault.userPrices(await membershipERC721.voteDelegators(id))).to.be.equal(price)
    })

    it("votes on friend member's behalf", async () => {
      membershipERC721.redeem(friendsCode, signer.address, signer.address)
      const id = (await membershipERC721.friendTier()).start
      const price = ethers.utils.parseEther('4000')
      await membershipERC721.updateUserPrice(id, price)
      expect(await tokenVault.userPrices(await membershipERC721.voteDelegators(id))).to.be.equal(price)
    })

    it('reset vote to 0 after transfer', async () => {
      membershipERC721.redeem(friendsCode, signer.address, signer.address)
      const tierPrice = await membershipERC721.getTierPrice(friendsCode)

      expect(await tokenVault.balanceOf(membershipERC721.address)).to.be.equal(tierPrice)
      expect(await tokenVault.reservePrice()).to.be.equal(initialPrice)

      const id = (await membershipERC721.friendTier()).start
      const price = ethers.utils.parseEther('3500')
      await membershipERC721.updateUserPrice(id, price)

      const reservePrice = await tokenVault.reservePrice()
      expect(reservePrice.lt(initialPrice)).to.be.true

      const delegatorProxy = await membershipERC721.voteDelegators(id)
      expect(await tokenVault.balanceOf(membershipERC721.address)).to.be.equal(0)
      expect(await tokenVault.balanceOf(delegatorProxy)).to.be.equal(tierPrice)
      await membershipERC721.transferFrom(signer.address, user.address, id)
      expect(await tokenVault.reservePrice()).to.be.equal(initialPrice)
      expect(await tokenVault.balanceOf(membershipERC721.address)).to.be.equal(tierPrice)
    })

    it('reset vote to 0 after release', async () => {
      membershipERC721.redeem(friendsCode, signer.address, signer.address)
      const tierPrice = await membershipERC721.getTierPrice(friendsCode)

      expect(await tokenVault.balanceOf(membershipERC721.address)).to.be.equal(tierPrice)
      expect(await tokenVault.reservePrice()).to.be.equal(initialPrice)

      const id = (await membershipERC721.friendTier()).start
      const price = ethers.utils.parseEther('4500')
      await membershipERC721.updateUserPrice(id, price)

      const reservePrice = await tokenVault.reservePrice()
      expect(reservePrice.gt(initialPrice)).to.be.true

      const delegatorProxy = await membershipERC721.voteDelegators(id)
      expect(await tokenVault.balanceOf(membershipERC721.address)).to.be.equal(0)
      expect(await tokenVault.balanceOf(delegatorProxy)).to.be.equal(tierPrice)
      await membershipERC721.release(id)
      expect(await tokenVault.reservePrice()).to.be.equal(initialPrice)
      expect(await tokenVault.balanceOf(membershipERC721.address)).to.be.equal(0)
    })
  })

  // TODO: reuse token vault from top-level describe
  describe('pausability', () => {
    let signer: SignerWithAddress
    let user: SignerWithAddress
    let membershipERC721: ERC721MembershipUpgradeable
    let mockERC20: ERC20Mock
    let supportRole: string
    let senderRole: string

    beforeEach(async () => {
      ;[signer, user] = await ethers.getSigners()

      const MockERC20 = await ethers.getContractFactory('ERC20Mock')
      mockERC20 = await MockERC20.deploy(
        'Dummy',
        'DMY',
        signer.address,
        ethers.utils.parseUnits('4000000', decimals),
        6,
      )
      await mockERC20.deployed()

      const MembershipERC721 = await ethers.getContractFactory('ERC721MembershipUpgradeable')
      membershipERC721 = await MembershipERC721.deploy()
      await membershipERC721.deployed()
      await membershipERC721.initialize('Member', 'MBR', mockERC20.address, voteDelegator.address, 2, 4, 6)

      supportRole = await membershipERC721.SUPPORT_ROLE()
      senderRole = await membershipERC721.SENDER_ROLE()
    })

    describe('pausing access control', () => {
      it('signer is support', async () => {
        expect(await membershipERC721.hasRole(supportRole, signer.address)).to.be.true
      })

      it('user is not support', async () => {
        expect(await membershipERC721.hasRole(supportRole, user.address)).to.be.false
      })

      it('support can pause', async () => {
        await membershipERC721.pause()
        expect(await membershipERC721.paused()).to.be.true
      })

      it('support can unpause', async () => {
        await membershipERC721.pause()
        await membershipERC721.unpause()
        expect(await membershipERC721.paused()).to.be.false
      })

      it('user cannot pause', async () => {
        await expect(membershipERC721.connect(user).pause()).to.be.reverted
      })

      it('user cannot unpause', async () => {
        await membershipERC721.pause()
        await expect(membershipERC721.connect(user).unpause()).to.be.reverted
      })
    })

    describe('managing access control', () => {
      it('support can add sender', async () => {
        await membershipERC721.addSender(membershipERC721.address)
        expect(await membershipERC721.hasRole(senderRole, membershipERC721.address)).to.be.true
      })

      it('support renounces support', async () => {
        await membershipERC721.renounceSupport()
        expect(await membershipERC721.hasRole(supportRole, signer.address)).to.be.false
      })
    })

    describe('pausing prevents transfers', () => {
      // it("blocks non-senders from sending when paused", async () => {
      //   await membershipERC721.pause()
      //   await mockERC20.approve(membershipERC721.address, ethers.utils.parseUnits("400", decimals))
      //   await membershipERC721.redeemFriend()
      //   await expect(membershipERC721.transferFrom(signer.address, user.address, 0)).to.be.reverted
      // })

      it('allows senders to send', async () => {
        await membershipERC721.pause()
        await membershipERC721.addSender(signer.address)
        await mockERC20.approve(membershipERC721.address, ethers.utils.parseUnits('400', decimals))
        await membershipERC721.redeem(friendsCode, signer.address, signer.address)
        const id = (await membershipERC721.friendTier()).start
        await expect(membershipERC721.transferFrom(signer.address, user.address, id)).to.not.be.reverted
        expect(await membershipERC721.ownerOf(id)).to.be.equal(user.address)
      })
    })

    describe('toggle auctions', () => {
      it('allows governance to enable auctions', async () => {
        expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
        tokenVault.toggleAuctions()
        expect(await tokenVault.auctionState()).to.be.equal(State.INACTIVE)
      })

      it('allows governance to disable auctions', async () => {
        expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
        tokenVault.toggleAuctions()
        expect(await tokenVault.auctionState()).to.be.equal(State.INACTIVE)
        tokenVault.toggleAuctions()
        expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
      })

      it("doesn't allow user to enable auctions", async () => {
        expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
        await expect(tokenVault.connect(user).toggleAuctions()).to.be.revertedWith('toggle:not gov')
        expect(await tokenVault.auctionState()).to.be.equal(State.DISABLED)
      })
    })
  })
})
