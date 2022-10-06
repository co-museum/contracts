import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { utils, BigNumberish } from 'ethers'
import { MerkleTree } from 'merkletreejs'
import { AllowanceCrowdsale, ERC721MembershipUpgradeable, TokenVault, IERC20 } from '../typechain'
import { calculateEthRate } from '../utils/crowdsale'

import {
  deployAllowanceCrowdsale,
  deployERC20Mock,
  deployERC721Mock,
  deployMembership,
  deployTokenVault,
  deployVaultFactory,
} from '../utils/deployment'
import * as utilConstants from './utils/constants'
import * as helpers from './utils/allowanceCrowdsaleHelpers'

describe('AllowanceCrowdsale', () => {
  let tokenVault: TokenVault
  let mockUSDC: IERC20
  let mockUSDT: IERC20
  let signer: SignerWithAddress
  let userOneFriend: SignerWithAddress
  let userTwoFriends: SignerWithAddress
  let userExceedingSupply: SignerWithAddress
  let userOneFoundation: SignerWithAddress
  let userNotWhitelisted: SignerWithAddress
  let tokenHoldingWallet: SignerWithAddress
  let treasuryWallet: SignerWithAddress
  let allowanceCrowdsale: AllowanceCrowdsale
  let membershipContract: ERC721MembershipUpgradeable
  let rootSingle: string
  let rootDouble: string
  let rootExceedingSupply: string
  let rootFoundation: string
  let whitelistOneFriend: string[]
  let whitelistTwoFriends: string[]
  let whitelistExceedingSupply: string[]
  let whitelistOneFoundation: string[]
  let whitelistArr: string[][]
  let treeOneFriend: MerkleTree
  let treeTwoFriends: MerkleTree
  let treeExceedingSupply: MerkleTree
  let treeOneFoundation: MerkleTree
  let whitelistIdxOneFriend: number
  let whitelistIdxTwoFriends: number
  let whitelistIdxFoundation: number
  let whitelistIdxNonWhitelisted: number

  beforeEach(async () => {
    ;[
      signer,
      userOneFriend,
      userTwoFriends,
      userExceedingSupply,
      userOneFoundation,
      userNotWhitelisted,
      tokenHoldingWallet,
      treasuryWallet,
    ] = await ethers.getSigners()
    whitelistOneFriend = [userOneFriend.address]
    whitelistTwoFriends = [userTwoFriends.address]
    whitelistExceedingSupply = [userExceedingSupply.address]
    whitelistOneFoundation = [userOneFoundation.address]
    whitelistArr = [whitelistOneFriend, whitelistTwoFriends, whitelistExceedingSupply, whitelistOneFoundation]

    mockUSDC = await deployERC20Mock(signer.address, 'Usdc', 'USDC', utilConstants.totalSupplyOfMockUSDC)
    mockUSDT = await deployERC20Mock(signer.address, 'Usdt', 'USDT', utilConstants.totalSupplyOfMockUSDT)
    for (const user of [userOneFriend, userTwoFriends, userExceedingSupply]) {
      mockUSDC.transfer(user.address, utilConstants.totalSupplyOfMockUSDC.div(3))
      mockUSDT.transfer(user.address, utilConstants.totalSupplyOfMockUSDT.div(3))
    }

    const vaultFactory = await deployVaultFactory()

    const dummyNFT = await deployERC721Mock()
    await dummyNFT.mint(signer.address, 0)
    await dummyNFT.approve(vaultFactory.address, 0)

    tokenVault = await deployTokenVault(mockUSDC.address, dummyNFT.address, 0, vaultFactory.address)
    await tokenVault.transfer(tokenHoldingWallet.address, await tokenVault.balanceOf(signer.address))

    membershipContract = await deployMembership(tokenVault.address)
    await tokenVault.connect(tokenHoldingWallet).approve(membershipContract.address, ethers.constants.MaxInt256)

    allowanceCrowdsale = await deployAllowanceCrowdsale(
      tokenVault.address,
      treasuryWallet.address,
      tokenHoldingWallet.address,
      membershipContract.address,
      [mockUSDC.address, mockUSDT.address],
    )
    tokenVault.connect(tokenHoldingWallet).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
    for (const user of [userOneFriend, userTwoFriends, userExceedingSupply]) {
      mockUSDC.connect(user).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
      mockUSDT.connect(user).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
    }

    await helpers.setRedeemer(membershipContract, allowanceCrowdsale.address)

    // one NFT allocated for user 1
    const leavesSingle = whitelistOneFriend.map((address) => utils.keccak256(address))
    treeOneFriend = new MerkleTree(leavesSingle, utils.keccak256, {
      sort: true,
    })
    rootSingle = treeOneFriend.getHexRoot()

    // two NFTs allocated for user 2
    const leavesDouble = whitelistTwoFriends.map((address) => utils.keccak256(address))
    treeTwoFriends = new MerkleTree(leavesDouble, utils.keccak256, {
      sort: true,
    })
    rootDouble = treeTwoFriends.getHexRoot()

    const leavesExceedingSupply = whitelistExceedingSupply.map((address) => utils.keccak256(address))
    treeExceedingSupply = new MerkleTree(leavesExceedingSupply, utils.keccak256, {
      sort: true,
    })
    rootExceedingSupply = treeExceedingSupply.getHexRoot()

    const leavesFoundation = whitelistOneFoundation.map((address) => utils.keccak256(address))
    treeOneFoundation = new MerkleTree(leavesFoundation, utils.keccak256, {
      sort: true,
    })
    rootFoundation = treeOneFoundation.getHexRoot()

    whitelistIdxOneFriend = helpers.findWhiteListArrIdx(whitelistArr, userOneFriend.address)
    whitelistIdxTwoFriends = helpers.findWhiteListArrIdx(whitelistArr, userTwoFriends.address)
    whitelistIdxFoundation = helpers.findWhiteListArrIdx(whitelistArr, userOneFoundation.address)
    whitelistIdxNonWhitelisted = helpers.findWhiteListArrIdx(whitelistArr, userNotWhitelisted.address)
  })

  describe('whitelisted', () => {
    describe('before sale', () => {
      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeTwoFriends,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeTwoFriends,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
    })

    describe('after sale', () => {
      beforeEach(async () => {
        await helpers.startSaleAndSetRate(
          allowanceCrowdsale,
          utilConstants.ethUSDPrice,
          utilConstants.decimals,
          utilConstants.tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
          rootFoundation,
        )
        await allowanceCrowdsale.stopSale()
      })

      const doubleNFTnum = 2

      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userOneFriend,
          doubleNFTnum,
          whitelistIdxOneFriend,
          treeOneFriend,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userOneFriend,
          doubleNFTnum,
          whitelistIdxOneFriend,
          treeOneFriend,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
    })

    describe('during Sale', () => {
      beforeEach(async () => {
        helpers.startSale(
          allowanceCrowdsale,
          utilConstants.decimals,
          utilConstants.tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
          rootFoundation,
        )
      })
      describe('before rates are set', () => {
        it('cannot buy membership NFTs with ETH', async () => {
          await helpers.testUnsuccessfulNFTSaleWithEth(
            allowanceCrowdsale,
            userOneFriend,
            utilConstants.numNFTsOne,
            whitelistIdxOneFriend,
            treeOneFriend,
            utilConstants.ethValueForFriendAmount,
            membershipContract,
            treasuryWallet,
            utilConstants.revertMessageEthRate,
          )
        })
        it('cannot buy membership NFTs with accepted stablecoin', async () => {
          await helpers.testUnsuccessfulNFTSaleWithStableCoin(
            allowanceCrowdsale,
            userOneFriend,
            utilConstants.numNFTsOne,
            whitelistIdxOneFriend,
            treeOneFriend,
            mockUSDC,
            treasuryWallet,
            membershipContract,
            utilConstants.revertMessageStablecoinRate,
          )
        })
      })

      describe('after rates are set', () => {
        beforeEach(async () => {
          await allowanceCrowdsale.setRates(1, calculateEthRate(utilConstants.ethUSDPrice))
        })
        describe('indiscrete purchases', () => {
          it('cannot buy lower tier membership NFTs', async () => {
            // user4 is allocated Foundation tier but tries to buy Friends tier
            mockUSDC.connect(userOneFriend).transfer(userOneFoundation.address, utilConstants.friendTokenAmount)
            await helpers.testUnsuccessfulNFTSaleWithStableCoin(
              allowanceCrowdsale,
              userOneFoundation,
              utilConstants.numNFTsTwo,
              whitelistIdxFoundation,
              treeOneFoundation,
              mockUSDC,
              treasuryWallet,
              membershipContract,
              utilConstants.revertMessageDiscrete,
            )
          })
          it('cannot buy invalid fractional allocation of membership NFTs', async () => {
            const invalidNFTNum = 3
            await helpers.testUnsuccessfulNFTSaleWithStableCoin(
              allowanceCrowdsale,
              userOneFoundation,
              invalidNFTNum,
              whitelistIdxFoundation,
              treeOneFoundation,
              mockUSDC,
              treasuryWallet,
              membershipContract,
              utilConstants.revertMessageDiscrete,
            )
          })
        })

        describe('discrete purchases', () => {
          describe('full allocation of $ART tokens and membership NFTs', () => {
            describe('with sufficient funds', () => {
              it('same user cannot buy tokens twice', async () => {
                await allowanceCrowdsale
                  .connect(userOneFriend)
                  .buyNFTs(
                    utilConstants.numNFTsOne,
                    whitelistIdxOneFriend,
                    treeOneFriend.getHexProof(userOneFriend.address),
                    false,
                    mockUSDC.address,
                  )
                expect(await membershipContract.balanceOf(userOneFriend.address)).to.be.equal(1)
                expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
                )

                await expect(
                  allowanceCrowdsale
                    .connect(userOneFriend)
                    .buyNFTs(
                      utilConstants.numNFTsOne,
                      whitelistIdxOneFriend,
                      treeOneFriend.getHexProof(userOneFriend.address),
                      false,
                      mockUSDT.address,
                    ),
                ).to.be.revertedWith(utilConstants.revertMessageUserClaimedAllocation)
                expect(await membershipContract.balanceOf(userOneFriend.address)).to.be.equal(utilConstants.numNFTsOne)
                expect(await mockUSDT.balanceOf(treasuryWallet.address)).to.be.equal(0)
              })

              it('can buy full allocation of membership NFTs with ETH', async () => {
                await helpers.testSuccessfulNFTSaleWithEth(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.numNFTsTwo,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  utilConstants.ethValueForFriendAmount.mul(2),
                  treasuryWallet,
                  membershipContract,
                )
              })
              it('can buy full allocation of membership NFTs with accepted stablecoin', async () => {
                await helpers.testSuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.numNFTsTwo,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate).mul(2),
                )
              })
              it('same user cannot buy membership NFTs twice', async () => {
                await helpers.testSuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
                )

                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.revertMessageUserClaimedAllocation,
                )
              })
              it('cannot buy more than full allocation of membership NFTs with accepted stablecoin', async () => {
                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userOneFriend,
                  utilConstants.numNFTsTwo,
                  whitelistIdxOneFriend,
                  treeOneFriend,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.revertMessageDiscrete,
                )
              })

              it('cannot buy when there is insufficient supply of membership NFTs', async () => {
                await helpers.testSuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.numNFTsTwo,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate).mul(2),
                )

                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userOneFriend,
                  utilConstants.numNFTsOne,
                  whitelistIdxOneFriend,
                  treeOneFriend,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.revertMessageRunsOutOfNFTs,
                )
              })
            })

            describe('with insufficient funds', () => {
              it('cannot buy full allocation of $ART tokens with accepted stablecoin', async () => {
                await mockUSDC
                  .connect(userOneFriend)
                  .transfer(userOneFoundation.address, await mockUSDC.balanceOf(userOneFriend.address))
                await expect(
                  allowanceCrowdsale
                    .connect(userOneFriend)
                    .buyNFTs(
                      utilConstants.numNFTsOne,
                      0,
                      treeOneFriend.getHexProof(userOneFriend.address),
                      false,
                      mockUSDC.address,
                    ),
                ).to.be.revertedWith('ERC20: transfer amount exceeds balance')
                expect(await membershipContract.balanceOf(userOneFriend.address)).to.be.equal(0)
                expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(0)
              })

              it('cannot buy full allocation of membership NFTs with ETH', async () => {
                await helpers.testUnsuccessfulNFTSaleWithEth(
                  allowanceCrowdsale,
                  userOneFriend,
                  utilConstants.numNFTsOne,
                  whitelistIdxOneFriend,
                  treeOneFriend,
                  utilConstants.ethValueForFriendAmount.sub(1),
                  membershipContract,
                  treasuryWallet,
                  utilConstants.revertMessageNotEnoughEth,
                )
              })
              it('cannot buy full allocation of membership NFTs with accepted stablecoin', async () => {
                await mockUSDC
                  .connect(userOneFriend)
                  .transfer(userOneFoundation.address, await mockUSDC.balanceOf(userTwoFriends.address))
                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userOneFriend,
                  utilConstants.numNFTsOne,
                  whitelistIdxOneFriend,
                  treeTwoFriends,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.revertMessageERC20Balance,
                )
              })
            })
          })
          describe('partial allocation of $ART tokens', () => {
            describe('with sufficient funds', () => {
              it('can buy valid partial allocation of membership NFTs with ETH', async () => {
                await helpers.testSuccessfulNFTSaleWithEth(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  utilConstants.ethValueForFriendAmount,
                  treasuryWallet,
                  membershipContract,
                )
              })
              it('can buy valid partial allocation of membership NFTs with stablecoin', async () => {
                await helpers.testSuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate).mul(utilConstants.numNFTsOne),
                )
              })
            })

            describe('with insufficient funds', () => {
              it('cannot buy valid partial allocation of membership NFTs with ETH', async () => {
                await helpers.testUnsuccessfulNFTSaleWithEth(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  utilConstants.ethValueForFriendAmount.div(2),
                  membershipContract,
                  treasuryWallet,
                  utilConstants.revertMessageNotEnoughEth,
                )
              })
              it('cannot buy valid partial allocation of membership NFTs with stablecoin', async () => {
                mockUSDC
                  .connect(userTwoFriends)
                  .transfer(userNotWhitelisted.address, await mockUSDC.balanceOf(userTwoFriends.address))

                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.revertMessageERC20Balance,
                )
              })
            })
          })
        })
      })
    })
  })

  describe('not whitelisted', () => {
    let whitelistIdx: number
    beforeEach(async () => {
      whitelistIdx = whitelistIdxNonWhitelisted
      expect(whitelistIdx).to.be.equal(-1)
      // forcing an incorrect whiteListIdx to interact with the contract
      whitelistIdx = 1
    })
    describe('before sale', () => {
      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userNotWhitelisted,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeTwoFriends,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userNotWhitelisted,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeTwoFriends,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
    })

    describe('after sale', () => {
      beforeEach(async () => {
        await helpers.startSaleAndSetRate(
          allowanceCrowdsale,
          utilConstants.ethUSDPrice,
          utilConstants.decimals,
          utilConstants.tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
          rootFoundation,
        )
        await allowanceCrowdsale.stopSale()
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userNotWhitelisted,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeTwoFriends,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userNotWhitelisted,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeTwoFriends,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
    })

    describe('during sale', () => {
      beforeEach(async () => {
        await helpers.startSaleAndSetRate(
          allowanceCrowdsale,
          utilConstants.ethUSDPrice,
          utilConstants.decimals,
          utilConstants.tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
          rootFoundation,
        )
      })
      const revertMessageInvalidProof = 'Invalid proof'
      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userNotWhitelisted,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeTwoFriends,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          revertMessageInvalidProof,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userNotWhitelisted,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeTwoFriends,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          revertMessageInvalidProof,
        )
      })
    })
  })

  describe('pausability', () => {
    beforeEach(async () => {
      await helpers.startSaleAndSetRate(
        allowanceCrowdsale,
        utilConstants.ethUSDPrice,
        utilConstants.decimals,
        utilConstants.tokenSupply,
        rootSingle,
        rootDouble,
        rootExceedingSupply,
        rootFoundation,
      )
      tokenVault.addSender(allowanceCrowdsale.address)
      tokenVault.addSender(membershipContract.address)
      membershipContract.addSender(membershipContract.address)
      tokenVault.connect(tokenHoldingWallet).approve(allowanceCrowdsale.address, ethers.constants.MaxInt256)
      tokenVault.connect(tokenHoldingWallet).approve(membershipContract.address, ethers.constants.MaxInt256)
      tokenVault.pause()
      membershipContract.pause()
    })
    describe('NFTs for whitelisted address', () => {
      it('can buy NFTs with ETH', async () => {
        await helpers.testSuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeOneFriend,
          utilConstants.ethValueForFriendAmount,
          treasuryWallet,
          membershipContract,
        )
      })
      it('can buy NFTs with stablecoin', async () => {
        await helpers.testSuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeOneFriend,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
        )
      })
      it('cannot release NFT for $ART', async () => {
        await helpers.testSuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeOneFriend,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
        )
        const [, start, ,] = await membershipContract.friendTier()
        await membershipContract.connect(userOneFriend).approve(membershipContract.address, start)
        await expect(membershipContract.connect(userOneFriend).release(start)).to.be.revertedWith(
          utilConstants.revertMessageReleaseNotEnabled,
        )
      })
    })
  })

  describe('post-sale', () => {
    let start: BigNumberish
    beforeEach(async () => {
      await helpers.startSaleAndSetRate(
        allowanceCrowdsale,
        utilConstants.ethUSDPrice,
        utilConstants.decimals,
        utilConstants.tokenSupply,
        rootSingle,
        rootDouble,
        rootExceedingSupply,
        rootFoundation,
      )
      tokenVault.addSender(allowanceCrowdsale.address)
      tokenVault.addSender(membershipContract.address)
      membershipContract.addSender(membershipContract.address)
      tokenVault.connect(tokenHoldingWallet).approve(allowanceCrowdsale.address, ethers.constants.MaxInt256)
      tokenVault.connect(tokenHoldingWallet).approve(membershipContract.address, ethers.constants.MaxInt256)
      tokenVault.pause()
      membershipContract.pause()
    })

    describe('transfer membership NFTs', () => {
      beforeEach(async () => {
        start = (await membershipContract.friendTier()).start.toNumber()
      })

      it('can transfer after releaseEnabled=true and membershipContract=unpaused', async () => {
        await helpers.testSuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeOneFriend,
          utilConstants.ethValueForFriendAmount,
          treasuryWallet,
          membershipContract,
        )

        await membershipContract.enableRelease()
        await membershipContract.unpause()
        await membershipContract.connect(userOneFriend).transferFrom(userOneFriend.address, signer.address, start)
        const ownerUpdated = (await membershipContract.ownerOf(start)) === signer.address
        await expect(ownerUpdated).to.be.true
      })

      it('cannot transfer after releaseEnabled=false and membershipContract=paused', async () => {
        await helpers.testSuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeOneFriend,
          utilConstants.ethValueForFriendAmount,
          treasuryWallet,
          membershipContract,
        )

        await expect(
          membershipContract.connect(userOneFriend).transferFrom(userOneFriend.address, signer.address, start),
        ).to.be.revertedWith(utilConstants.revertMessageNoPermissionToSend)
        const ownerNotUpdated = (await membershipContract.ownerOf(start)) === userOneFriend.address
        await expect(ownerNotUpdated).to.be.true
      })

      it('cannot release if releaseEnabled=false and membershipContract=unpaused', async () => {
        await helpers.testSuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeOneFriend,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
        )
        await membershipContract.unpause()
        await membershipContract.connect(userOneFriend).approve(membershipContract.address, start)
        await expect(membershipContract.connect(userOneFriend).release(start)).to.be.revertedWith(
          utilConstants.revertMessageReleaseNotEnabled,
        )
      })

      it('can release if releaseEnabled=true and membershipContract=unpaused', async () => {
        await helpers.testSuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeOneFriend,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
        )
        await membershipContract.unpause()
        await membershipContract.enableRelease()
        await membershipContract.connect(userOneFriend).approve(membershipContract.address, start)
        await expect(membershipContract.connect(userOneFriend).release(start)).to.not.be.reverted
      })

      it('cannot release if releaseEnabled=true and membershipContract=paused', async () => {
        await helpers.testSuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxOneFriend,
          treeOneFriend,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
        )
        await membershipContract.enableRelease()
        await membershipContract.connect(userOneFriend).approve(membershipContract.address, start)
        await expect(membershipContract.connect(userOneFriend).release(start)).to.be.revertedWith(
          utilConstants.revertMessageNoPermissionToSend,
        )
      })
    })
  })
})
