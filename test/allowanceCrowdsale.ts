import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { utils, constants, BigNumber } from 'ethers'
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
  let userAllocatedOneFriend: SignerWithAddress
  let userAllocatedTwoFriends: SignerWithAddress
  let userAllocatedExceedingSupply: SignerWithAddress
  let userAllocatedOneFoundation: SignerWithAddress
  let user5: SignerWithAddress
  let tokenHoldingWallet: SignerWithAddress
  let treasuryWallet: SignerWithAddress
  let allowanceCrowdsale: AllowanceCrowdsale
  let membershipContract: ERC721MembershipUpgradeable
  let rootSingle: string
  let rootDouble: string
  let rootExceedingSupply: string
  let rootFoundation: string
  let whitelistAllocatedOneFriend: string[]
  let whitelistAllocatedTwoFriends: string[]
  let whitelistAllocatedExceedingSupply: string[]
  let whitelistAllocatedOneFoundation: string[]
  let whitelistArr: string[][]
  let treeSingle: MerkleTree
  let treeDouble: MerkleTree
  let treeExceedingSupply: MerkleTree
  let treeFoundation: MerkleTree
  let whitelistIdxUserOne: number
  let whitelistIdxUserTwo: number
  let whitelistIdxUserThree: number
  let whitelistIdxUserFour: number
  let whitelistIdxUserFive: number

  beforeEach(async () => {
    ;[
      signer,
      userAllocatedOneFriend,
      userAllocatedTwoFriends,
      userAllocatedExceedingSupply,
      userAllocatedOneFoundation,
      user5,
      tokenHoldingWallet,
      treasuryWallet,
    ] = await ethers.getSigners()
    whitelistAllocatedOneFriend = [userAllocatedOneFriend.address]
    whitelistAllocatedTwoFriends = [userAllocatedTwoFriends.address]
    whitelistAllocatedExceedingSupply = [userAllocatedExceedingSupply.address]
    whitelistAllocatedOneFoundation = [userAllocatedOneFoundation.address]
    whitelistArr = [
      whitelistAllocatedOneFriend,
      whitelistAllocatedTwoFriends,
      whitelistAllocatedExceedingSupply,
      whitelistAllocatedOneFoundation,
    ]

    mockUSDC = await deployERC20Mock(signer, 'Usdc', 'USDC', utilConstants.totalSupplyOfMockUSDC)
    mockUSDT = await deployERC20Mock(signer, 'Usdt', 'USDT', utilConstants.totalSupplyOfMockUSDT)
    for (let user of [userAllocatedOneFriend, userAllocatedTwoFriends, userAllocatedExceedingSupply]) {
      mockUSDC.transfer(user.address, utilConstants.totalSupplyOfMockUSDC.div(3))
      mockUSDT.transfer(user.address, utilConstants.totalSupplyOfMockUSDT.div(3))
    }

    const vaultFactory = await deployVaultFactory()

    const dummyNFT = await deployERC721Mock()
    await dummyNFT.mint(signer.address, 0)
    await dummyNFT.approve(vaultFactory.address, 0)

    tokenVault = await deployTokenVault(mockUSDC, dummyNFT, 0, vaultFactory)
    await tokenVault.transfer(tokenHoldingWallet.address, await tokenVault.balanceOf(signer.address))

    membershipContract = await deployMembership(tokenVault)
    await tokenVault.connect(tokenHoldingWallet).approve(membershipContract.address, ethers.constants.MaxInt256)

    allowanceCrowdsale = await deployAllowanceCrowdsale(
      tokenVault,
      treasuryWallet,
      tokenHoldingWallet,
      membershipContract,
      [mockUSDC, mockUSDT],
    )
    tokenVault.connect(tokenHoldingWallet).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
    for (let user of [userAllocatedOneFriend, userAllocatedTwoFriends, userAllocatedExceedingSupply]) {
      mockUSDC.connect(user).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
      mockUSDT.connect(user).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
    }

    // one NFT allocated for user 1
    const leavesSingle = whitelistAllocatedOneFriend.map((address) => utils.keccak256(address))
    treeSingle = new MerkleTree(leavesSingle, utils.keccak256, {
      sort: true,
    })
    rootSingle = treeSingle.getHexRoot()

    // two NFTs allocated for user 2
    const leavesDouble = whitelistAllocatedTwoFriends.map((address) => utils.keccak256(address))
    treeDouble = new MerkleTree(leavesDouble, utils.keccak256, {
      sort: true,
    })
    rootDouble = treeDouble.getHexRoot()

    const leavesExceedingSupply = whitelistAllocatedExceedingSupply.map((address) => utils.keccak256(address))
    treeExceedingSupply = new MerkleTree(leavesExceedingSupply, utils.keccak256, {
      sort: true,
    })
    rootExceedingSupply = treeExceedingSupply.getHexRoot()

    const leavesFoundation = whitelistAllocatedOneFoundation.map((address) => utils.keccak256(address))
    treeFoundation = new MerkleTree(leavesFoundation, utils.keccak256, {
      sort: true,
    })
    rootFoundation = treeFoundation.getHexRoot()

    whitelistIdxUserOne = helpers.findWhiteListArrIdx(whitelistArr, userAllocatedOneFriend.address)
    whitelistIdxUserTwo = helpers.findWhiteListArrIdx(whitelistArr, userAllocatedTwoFriends.address)
    whitelistIdxUserThree = helpers.findWhiteListArrIdx(whitelistArr, userAllocatedExceedingSupply.address)
    whitelistIdxUserFour = helpers.findWhiteListArrIdx(whitelistArr, userAllocatedOneFoundation.address)
    whitelistIdxUserFive = helpers.findWhiteListArrIdx(whitelistArr, user5.address)
  })

  describe('whitelisted', () => {
    describe('before sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {
        await helpers.testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          utilConstants.friendTokenAmount,
          whitelistIdxUserOne,
          treeSingle,
          utilConstants.ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          utilConstants.friendTokenAmount,
          whitelistIdxUserOne,
          userAllocatedOneFriend,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxUserOne,
          treeDouble,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxUserOne,
          treeDouble,
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
      it('cannot buy $ART tokens with ETH', async () => {
        await helpers.testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          utilConstants.friendTokenAmount,
          whitelistIdxUserOne,
          treeSingle,
          utilConstants.ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          utilConstants.friendTokenAmount,
          whitelistIdxUserOne,
          userAllocatedOneFriend,
          treeSingle,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          doubleNFTnum,
          whitelistIdxUserOne,
          treeSingle,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          doubleNFTnum,
          whitelistIdxUserOne,
          treeSingle,
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
        it('cannot buy $ART tokens with ETH', async () => {
          await helpers.testUnsuccessfulTokenSaleWithEth(
            allowanceCrowdsale,
            userAllocatedOneFriend,
            utilConstants.friendTokenAmount,
            whitelistIdxUserOne,
            treeSingle,
            utilConstants.ethValueForFriendAmount,
            tokenVault,
            treasuryWallet,
            utilConstants.revertMessageEthRate,
          )
        })
        it('cannot buy $ART tokens with accepted stablecoin', async () => {
          await helpers.testUnsuccessfulTokenSaleWithStableCoin(
            allowanceCrowdsale,
            utilConstants.friendTokenAmount,
            whitelistIdxUserOne,
            userAllocatedOneFriend,
            treeSingle,
            mockUSDC,
            tokenVault,
            treasuryWallet,
            utilConstants.revertMessageStablecoinRate,
          )
        })

        it('cannot buy membership NFTs with ETH', async () => {
          await helpers.testUnsuccessfulNFTSaleWithEth(
            allowanceCrowdsale,
            userAllocatedOneFriend,
            utilConstants.numNFTsOne,
            whitelistIdxUserOne,
            treeSingle,
            utilConstants.ethValueForFriendAmount,
            membershipContract,
            treasuryWallet,
            utilConstants.revertMessageEthRate,
          )
        })
        it('cannot buy membership NFTs with accepted stablecoin', async () => {
          await helpers.testUnsuccessfulNFTSaleWithStableCoin(
            allowanceCrowdsale,
            userAllocatedOneFriend,
            utilConstants.numNFTsOne,
            whitelistIdxUserOne,
            treeSingle,
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
          it('cannot buy lower tier $ART tokens', async () => {
            // user4 is allocated Foundation tier but tries to buy Friends tier
            mockUSDC
              .connect(userAllocatedOneFriend)
              .transfer(userAllocatedOneFoundation.address, utilConstants.friendTokenAmount)
            await helpers.testUnsuccessfulTokenSaleWithStableCoin(
              allowanceCrowdsale,
              utilConstants.friendTokenAmount,
              whitelistIdxUserFour,
              userAllocatedOneFoundation,
              treeFoundation,
              mockUSDC,
              tokenVault,
              treasuryWallet,
              utilConstants.revertMessageDiscrete,
            )
          })
          it('cannot buy invalid fractional allocation of $ART tokens', async () => {
            const invalidAmount = utilConstants.friendTokenAmount.add(utilConstants.friendTokenAmount.div(2))
            await helpers.testUnsuccessfulTokenSaleWithStableCoin(
              allowanceCrowdsale,
              invalidAmount,
              whitelistIdxUserTwo,
              userAllocatedOneFoundation,
              treeFoundation,
              mockUSDC,
              tokenVault,
              treasuryWallet,
              utilConstants.revertMessageDiscrete,
            )
          })

          it('cannot buy lower tier membership NFTs', async () => {
            // user4 is allocated Foundation tier but tries to buy Friends tier
            mockUSDC
              .connect(userAllocatedOneFriend)
              .transfer(userAllocatedOneFoundation.address, utilConstants.friendTokenAmount)
            await helpers.testUnsuccessfulNFTSaleWithStableCoin(
              allowanceCrowdsale,
              userAllocatedOneFoundation,
              utilConstants.numNFTsTwo,
              whitelistIdxUserFour,
              treeFoundation,
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
              userAllocatedOneFoundation,
              invalidNFTNum,
              whitelistIdxUserFour,
              treeFoundation,
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
              it('can buy full allocation of $ART tokens with ETH', async () => {
                await helpers.testSuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userAllocatedOneFriend,
                  utilConstants.friendTokenAmount,
                  whitelistIdxUserOne,
                  treeSingle,
                  utilConstants.ethValueForFriendAmount,
                  tokenVault,
                  treasuryWallet,
                )
              })

              it('can buy full allocation of $ART tokens with accepted stablecoin', async () => {
                await helpers.testSuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  utilConstants.friendTokenAmount.mul(2),
                  whitelistIdxUserTwo,
                  userAllocatedTwoFriends,
                  treeDouble,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  utilConstants.stablecoinTokenRate,
                )
              })

              it('same user cannot buy tokens twice', async () => {
                await allowanceCrowdsale
                  .connect(userAllocatedOneFriend)
                  .buyTokens(
                    utilConstants.friendTokenAmount,
                    whitelistIdxUserOne,
                    treeSingle.getHexProof(userAllocatedOneFriend.address),
                    false,
                    mockUSDC.address,
                  )
                expect(await tokenVault.balanceOf(userAllocatedOneFriend.address)).to.be.equal(
                  utilConstants.friendTokenAmount,
                )
                expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
                )

                await expect(
                  allowanceCrowdsale
                    .connect(userAllocatedOneFriend)
                    .buyTokens(
                      utilConstants.friendTokenAmount,
                      whitelistIdxUserOne,
                      treeSingle.getHexProof(userAllocatedOneFriend.address),
                      false,
                      mockUSDT.address,
                    ),
                ).to.be.revertedWith(utilConstants.revertMessageUserClaimedAllocation)
                expect(await tokenVault.balanceOf(userAllocatedOneFriend.address)).to.be.equal(
                  utilConstants.friendTokenAmount,
                )
                expect(await mockUSDT.balanceOf(treasuryWallet.address)).to.be.equal(0)
              })

              it('cannot buy more than full allocation of $ART tokens with accepted stablecoin', async () => {
                await helpers.testUnsuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  utilConstants.friendTokenAmount.mul(2),
                  whitelistIdxUserOne,
                  userAllocatedOneFriend,
                  treeSingle,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  utilConstants.revertMessageDiscrete,
                )
              })

              it('cannot buy when there is insufficient supply of $ART tokens', async () => {
                const tokenAmountExceedingSupply = utilConstants.tokenSupply.add(
                  utils.parseUnits('400', utilConstants.decimals),
                )
                const hexProof = treeExceedingSupply.getHexProof(userAllocatedExceedingSupply.address)
                const buyWithEth = true
                const ethValue = calculateEthRate(utilConstants.ethUSDPrice).mul(tokenAmountExceedingSupply)

                await helpers.testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userAllocatedExceedingSupply,
                  tokenAmountExceedingSupply,
                  whitelistIdxUserThree,
                  treeExceedingSupply,
                  ethValue,
                  tokenVault,
                  treasuryWallet,
                  utilConstants.revertMessageTransferExceedsBalance,
                )
              })

              it('can buy full allocation of membership NFTs with ETH', async () => {
                await helpers.testSuccessfulNFTSaleWithEth(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.numNFTsTwo,
                  whitelistIdxUserTwo,
                  treeDouble,
                  utilConstants.ethValueForFriendAmount.mul(2),
                  treasuryWallet,
                  membershipContract,
                )
              })
              it('can buy full allocation of membership NFTs with accepted stablecoin', async () => {
                await helpers.testSuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.numNFTsTwo,
                  whitelistIdxUserTwo,
                  treeDouble,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate).mul(2),
                )
              })
              it('same user cannot buy membership NFTs twice', async () => {
                await helpers.testSuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxUserTwo,
                  treeDouble,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
                )

                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxUserTwo,
                  treeDouble,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.revertMessageUserClaimedAllocation,
                )
              })
              it('cannot buy more than full allocation of membership NFTs with accepted stablecoin', async () => {
                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userAllocatedOneFriend,
                  utilConstants.numNFTsTwo,
                  whitelistIdxUserOne,
                  treeSingle,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.revertMessageDiscrete,
                )
              })

              it('cannot buy when there is insufficient supply of membership NFTs', async () => {
                await helpers.testSuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.numNFTsTwo,
                  whitelistIdxUserTwo,
                  treeDouble,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate).mul(2),
                )

                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userAllocatedOneFriend,
                  utilConstants.numNFTsOne,
                  whitelistIdxUserOne,
                  treeSingle,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.revertMessageRunsOutOfNFTs,
                )
              })
            })

            describe('with insufficient funds', () => {
              it('cannot buy full allocation of $ART tokens with ETH', async () => {
                await helpers.testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userAllocatedOneFriend,
                  utilConstants.friendTokenAmount,
                  whitelistIdxUserOne,
                  treeSingle,
                  utilConstants.ethValueForFriendAmount.sub(1),
                  tokenVault,
                  treasuryWallet,
                  utilConstants.revertMessageNotEnoughEth,
                )
              })

              it('cannot buy full allocation of $ART tokens with accepted stablecoin', async () => {
                await mockUSDC
                  .connect(userAllocatedOneFriend)
                  .transfer(
                    userAllocatedOneFoundation.address,
                    await mockUSDC.balanceOf(userAllocatedOneFriend.address),
                  )
                await expect(
                  allowanceCrowdsale
                    .connect(userAllocatedOneFriend)
                    .buyTokens(
                      utilConstants.friendTokenAmount,
                      0,
                      treeSingle.getHexProof(userAllocatedOneFriend.address),
                      false,
                      mockUSDC.address,
                    ),
                ).to.be.revertedWith('ERC20: transfer amount exceeds balance')
                expect(await tokenVault.balanceOf(userAllocatedOneFriend.address)).to.be.equal(0)
                expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(0)
              })

              it('cannot buy full allocation of membership NFTs with ETH', async () => {
                await helpers.testUnsuccessfulNFTSaleWithEth(
                  allowanceCrowdsale,
                  userAllocatedOneFriend,
                  utilConstants.numNFTsOne,
                  whitelistIdxUserOne,
                  treeSingle,
                  utilConstants.ethValueForFriendAmount.sub(1),
                  membershipContract,
                  treasuryWallet,
                  utilConstants.revertMessageNotEnoughEth,
                )
              })
              it('cannot buy full allocation of membership NFTs with accepted stablecoin', async () => {
                await mockUSDC
                  .connect(userAllocatedOneFriend)
                  .transfer(
                    userAllocatedOneFoundation.address,
                    await mockUSDC.balanceOf(userAllocatedTwoFriends.address),
                  )
                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userAllocatedOneFriend,
                  utilConstants.numNFTsOne,
                  whitelistIdxUserOne,
                  treeDouble,
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
              it('can buy valid partial allocation of $ART tokens with ETH', async () => {
                await helpers.testSuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.friendTokenAmount,
                  whitelistIdxUserTwo,
                  treeDouble,
                  utilConstants.ethValueForFriendAmount,
                  tokenVault,
                  treasuryWallet,
                )
              })
              it('can buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {
                await helpers.testSuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  utilConstants.friendTokenAmount,
                  whitelistIdxUserOne,
                  userAllocatedOneFriend,
                  treeDouble,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  utilConstants.stablecoinTokenRate,
                )
              })
              it('can buy valid partial allocation of membership NFTs with ETH', async () => {
                await helpers.testSuccessfulNFTSaleWithEth(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxUserTwo,
                  treeDouble,
                  utilConstants.ethValueForFriendAmount,
                  treasuryWallet,
                  membershipContract,
                )
              })
              it('can buy valid partial allocation of membership NFTs with stablecoin', async () => {
                await helpers.testSuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxUserTwo,
                  treeDouble,
                  mockUSDC,
                  treasuryWallet,
                  membershipContract,
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate).mul(utilConstants.numNFTsOne),
                )
              })
            })

            describe('with insufficient funds', () => {
              it('cannot buy valid partial allocation of $ART tokens with ETH', async () => {
                await helpers.testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.friendTokenAmount,
                  whitelistIdxUserTwo,
                  treeDouble,
                  utilConstants.ethValueForFriendAmount.sub(1),
                  tokenVault,
                  treasuryWallet,
                  utilConstants.revertMessageNotEnoughEth,
                )
              })
              it('cannot buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {
                await mockUSDC
                  .connect(userAllocatedTwoFriends)
                  .transfer(
                    userAllocatedOneFoundation.address,
                    await mockUSDC.balanceOf(userAllocatedTwoFriends.address),
                  )
                await helpers.testUnsuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  utilConstants.friendTokenAmount,
                  whitelistIdxUserTwo,
                  userAllocatedTwoFriends,
                  treeDouble,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  utilConstants.revertMessageERC20Balance,
                )
              })

              it('cannot buy valid partial allocation of membership NFTs with ETH', async () => {
                await helpers.testUnsuccessfulNFTSaleWithEth(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxUserTwo,
                  treeDouble,
                  utilConstants.ethValueForFriendAmount.div(2),
                  membershipContract,
                  treasuryWallet,
                  utilConstants.revertMessageNotEnoughEth,
                )
              })
              it('cannot buy valid partial allocation of membership NFTs with stablecoin', async () => {
                mockUSDC
                  .connect(userAllocatedTwoFriends)
                  .transfer(user5.address, await mockUSDC.balanceOf(userAllocatedTwoFriends.address))

                await helpers.testUnsuccessfulNFTSaleWithStableCoin(
                  allowanceCrowdsale,
                  userAllocatedTwoFriends,
                  utilConstants.numNFTsOne,
                  whitelistIdxUserTwo,
                  treeDouble,
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
    var whitelistIdx: number
    beforeEach(async () => {
      whitelistIdx = whitelistIdxUserFive
      expect(whitelistIdx).to.be.equal(-1)
      // forcing an incorrect whiteListIdx to interact with the contract
      whitelistIdx = 1
    })
    describe('before sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {
        await helpers.testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user5,
          utilConstants.friendTokenAmount,
          whitelistIdx,
          treeSingle,
          utilConstants.ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          utilConstants.friendTokenAmount,
          whitelistIdx,
          user5,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user5,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeDouble,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user5,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeDouble,
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

      it('cannot buy $ART tokens with ETH', async () => {
        await helpers.testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user5,
          utilConstants.friendTokenAmount,
          whitelistIdx,
          treeSingle,
          utilConstants.ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          utilConstants.friendTokenAmount,
          whitelistIdx,
          user5,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user5,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeDouble,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user5,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeDouble,
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
      it('cannot buy $ART tokens with ETH', async () => {
        await helpers.testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user5,
          utilConstants.friendTokenAmount,
          whitelistIdx,
          treeSingle,
          utilConstants.ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          revertMessageInvalidProof,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          utilConstants.friendTokenAmount,
          whitelistIdx,
          user5,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessageInvalidProof,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await helpers.testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user5,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeDouble,
          utilConstants.ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          revertMessageInvalidProof,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await helpers.testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user5,
          utilConstants.numNFTsOne,
          whitelistIdx,
          treeDouble,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          revertMessageInvalidProof,
        )
      })
    })
  })

  describe('pausability', () => {
    let whitelistIdx: number
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
      whitelistIdx = helpers.findWhiteListArrIdx(whitelistArr, userAllocatedOneFriend.address)
    })
    describe('tokens for whitelisted address', () => {
      it('can buy $ART with ETH', async () => {
        await helpers.testSuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          utilConstants.friendTokenAmount,
          whitelistIdxUserOne,
          treeSingle,
          utilConstants.ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
        )
      })
      it('can buy $ART with stablecoin', async () => {
        await helpers.testSuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          utilConstants.friendTokenAmount,
          whitelistIdxUserOne,
          userAllocatedOneFriend,
          treeSingle,
          mockUSDT,
          tokenVault,
          treasuryWallet,
          utilConstants.stablecoinTokenRate,
        )
      })
      it('can redeem membership NFT with $ART', async () => {
        await helpers.testSuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          utilConstants.friendTokenAmount,
          whitelistIdxUserOne,
          treeSingle,
          utilConstants.ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
        )
        await tokenVault
          .connect(userAllocatedOneFriend)
          .approve(membershipContract.address, ethers.constants.MaxUint256)
        await expect(
          membershipContract
            .connect(userAllocatedOneFriend)
            .redeem(2, userAllocatedOneFriend.address, userAllocatedOneFriend.address),
        ).to.not.be.reverted
        var [, start, ,] = await membershipContract.friendTier()
        expect(await membershipContract.ownerOf(start)).to.be.equal(userAllocatedOneFriend.address)
      })
    })
    describe('NFTs for whitelisted address', () => {
      it('can buy NFTs with ETH', async () => {
        await helpers.testSuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxUserOne,
          treeSingle,
          utilConstants.ethValueForFriendAmount,
          treasuryWallet,
          membershipContract,
        )
      })
      it('can buy NFTs with stablecoin', async () => {
        await helpers.testSuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxUserOne,
          treeSingle,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
        )
      })
      it('cannot release NFT for $ART', async () => {
        await helpers.testSuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          userAllocatedOneFriend,
          utilConstants.numNFTsOne,
          whitelistIdxUserOne,
          treeSingle,
          mockUSDC,
          treasuryWallet,
          membershipContract,
          utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
        )
        var [, start, ,] = await membershipContract.friendTier()
        await membershipContract.connect(userAllocatedOneFriend).approve(membershipContract.address, start)
        await expect(membershipContract.connect(userAllocatedOneFriend).release(start)).to.be.revertedWith(
          utilConstants.revertMessageNoPermissionToSend,
        )
      })
    })
  })
})
