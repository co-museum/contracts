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
  let whitelistIdxExceedingSupply: number
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
    for (let user of [userOneFriend, userTwoFriends, userExceedingSupply]) {
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
    for (let user of [userOneFriend, userTwoFriends, userExceedingSupply]) {
      mockUSDC.connect(user).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
      mockUSDT.connect(user).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
    }

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
    whitelistIdxExceedingSupply = helpers.findWhiteListArrIdx(whitelistArr, userExceedingSupply.address)
    whitelistIdxFoundation = helpers.findWhiteListArrIdx(whitelistArr, userOneFoundation.address)
    whitelistIdxNonWhitelisted = helpers.findWhiteListArrIdx(whitelistArr, userNotWhitelisted.address)
  })

  describe('whitelisted', () => {
    describe('before sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {
        await helpers.testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.friendTokenAmount,
          whitelistIdxOneFriend,
          treeOneFriend,
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
          whitelistIdxOneFriend,
          userOneFriend,
          treeTwoFriends,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })

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
      it('cannot buy $ART tokens with ETH', async () => {
        await helpers.testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.friendTokenAmount,
          whitelistIdxOneFriend,
          treeOneFriend,
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
          whitelistIdxOneFriend,
          userOneFriend,
          treeOneFriend,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
      })

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
        it('cannot buy $ART tokens with ETH', async () => {
          await helpers.testUnsuccessfulTokenSaleWithEth(
            allowanceCrowdsale,
            userOneFriend,
            utilConstants.friendTokenAmount,
            whitelistIdxOneFriend,
            treeOneFriend,
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
            whitelistIdxOneFriend,
            userOneFriend,
            treeOneFriend,
            mockUSDC,
            tokenVault,
            treasuryWallet,
            utilConstants.revertMessageStablecoinRate,
          )
        })

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
          it('cannot buy lower tier $ART tokens', async () => {
            // user4 is allocated Foundation tier but tries to buy Friends tier
            mockUSDC.connect(userOneFriend).transfer(userOneFoundation.address, utilConstants.friendTokenAmount)
            await helpers.testUnsuccessfulTokenSaleWithStableCoin(
              allowanceCrowdsale,
              utilConstants.friendTokenAmount,
              whitelistIdxFoundation,
              userOneFoundation,
              treeOneFoundation,
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
              whitelistIdxTwoFriends,
              userOneFoundation,
              treeOneFoundation,
              mockUSDC,
              tokenVault,
              treasuryWallet,
              utilConstants.revertMessageDiscrete,
            )
          })

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
              it('can buy full allocation of $ART tokens with ETH', async () => {
                await helpers.testSuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userOneFriend,
                  utilConstants.friendTokenAmount,
                  whitelistIdxOneFriend,
                  treeOneFriend,
                  utilConstants.ethValueForFriendAmount,
                  tokenVault,
                  treasuryWallet,
                )
              })

              it('can buy full allocation of $ART tokens with accepted stablecoin', async () => {
                await helpers.testSuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  utilConstants.friendTokenAmount.mul(2),
                  whitelistIdxTwoFriends,
                  userTwoFriends,
                  treeTwoFriends,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  utilConstants.stablecoinTokenRate,
                )
              })

              it('same user cannot buy tokens twice', async () => {
                await allowanceCrowdsale
                  .connect(userOneFriend)
                  .buyTokens(
                    utilConstants.friendTokenAmount,
                    whitelistIdxOneFriend,
                    treeOneFriend.getHexProof(userOneFriend.address),
                    false,
                    mockUSDC.address,
                  )
                expect(await tokenVault.balanceOf(userOneFriend.address)).to.be.equal(utilConstants.friendTokenAmount)
                expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(
                  utilConstants.friendTokenAmount.mul(utilConstants.stablecoinTokenRate),
                )

                await expect(
                  allowanceCrowdsale
                    .connect(userOneFriend)
                    .buyTokens(
                      utilConstants.friendTokenAmount,
                      whitelistIdxOneFriend,
                      treeOneFriend.getHexProof(userOneFriend.address),
                      false,
                      mockUSDT.address,
                    ),
                ).to.be.revertedWith(utilConstants.revertMessageUserClaimedAllocation)
                expect(await tokenVault.balanceOf(userOneFriend.address)).to.be.equal(utilConstants.friendTokenAmount)
                expect(await mockUSDT.balanceOf(treasuryWallet.address)).to.be.equal(0)
              })

              it('cannot buy more than full allocation of $ART tokens with accepted stablecoin', async () => {
                await helpers.testUnsuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  utilConstants.friendTokenAmount.mul(2),
                  whitelistIdxOneFriend,
                  userOneFriend,
                  treeOneFriend,
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
                const hexProof = treeExceedingSupply.getHexProof(userExceedingSupply.address)
                const buyWithEth = true
                const ethValue = calculateEthRate(utilConstants.ethUSDPrice).mul(tokenAmountExceedingSupply)

                await helpers.testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userExceedingSupply,
                  tokenAmountExceedingSupply,
                  whitelistIdxExceedingSupply,
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
              it('cannot buy full allocation of $ART tokens with ETH', async () => {
                await helpers.testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userOneFriend,
                  utilConstants.friendTokenAmount,
                  whitelistIdxOneFriend,
                  treeOneFriend,
                  utilConstants.ethValueForFriendAmount.sub(1),
                  tokenVault,
                  treasuryWallet,
                  utilConstants.revertMessageNotEnoughEth,
                )
              })

              it('cannot buy full allocation of $ART tokens with accepted stablecoin', async () => {
                await mockUSDC
                  .connect(userOneFriend)
                  .transfer(userOneFoundation.address, await mockUSDC.balanceOf(userOneFriend.address))
                await expect(
                  allowanceCrowdsale
                    .connect(userOneFriend)
                    .buyTokens(
                      utilConstants.friendTokenAmount,
                      0,
                      treeOneFriend.getHexProof(userOneFriend.address),
                      false,
                      mockUSDC.address,
                    ),
                ).to.be.revertedWith('ERC20: transfer amount exceeds balance')
                expect(await tokenVault.balanceOf(userOneFriend.address)).to.be.equal(0)
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
              it('can buy valid partial allocation of $ART tokens with ETH', async () => {
                await helpers.testSuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.friendTokenAmount,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  utilConstants.ethValueForFriendAmount,
                  tokenVault,
                  treasuryWallet,
                )
              })
              it('can buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {
                await helpers.testSuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  utilConstants.friendTokenAmount,
                  whitelistIdxOneFriend,
                  userOneFriend,
                  treeTwoFriends,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  utilConstants.stablecoinTokenRate,
                )
              })
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
              it('cannot buy valid partial allocation of $ART tokens with ETH', async () => {
                await helpers.testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  userTwoFriends,
                  utilConstants.friendTokenAmount,
                  whitelistIdxTwoFriends,
                  treeTwoFriends,
                  utilConstants.ethValueForFriendAmount.sub(1),
                  tokenVault,
                  treasuryWallet,
                  utilConstants.revertMessageNotEnoughEth,
                )
              })
              it('cannot buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {
                await mockUSDC
                  .connect(userTwoFriends)
                  .transfer(userOneFoundation.address, await mockUSDC.balanceOf(userTwoFriends.address))
                await helpers.testUnsuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  utilConstants.friendTokenAmount,
                  whitelistIdxTwoFriends,
                  userTwoFriends,
                  treeTwoFriends,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  utilConstants.revertMessageERC20Balance,
                )
              })

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
    var whitelistIdx: number
    beforeEach(async () => {
      whitelistIdx = whitelistIdxNonWhitelisted
      expect(whitelistIdx).to.be.equal(-1)
      // forcing an incorrect whiteListIdx to interact with the contract
      whitelistIdx = 1
    })
    describe('before sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {
        await helpers.testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userNotWhitelisted,
          utilConstants.friendTokenAmount,
          whitelistIdx,
          treeOneFriend,
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
          userNotWhitelisted,
          treeTwoFriends,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
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
          userNotWhitelisted,
          utilConstants.friendTokenAmount,
          whitelistIdx,
          treeOneFriend,
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
          userNotWhitelisted,
          treeTwoFriends,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          utilConstants.revertMessageCrowdsaleNotOpen,
        )
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
      it('cannot buy $ART tokens with ETH', async () => {
        await helpers.testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userNotWhitelisted,
          utilConstants.friendTokenAmount,
          whitelistIdx,
          treeOneFriend,
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
          userNotWhitelisted,
          treeTwoFriends,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessageInvalidProof,
        )
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
      whitelistIdx = helpers.findWhiteListArrIdx(whitelistArr, userOneFriend.address)
    })
    describe('tokens for whitelisted address', () => {
      it('can buy $ART with ETH', async () => {
        await helpers.testSuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.friendTokenAmount,
          whitelistIdxOneFriend,
          treeOneFriend,
          utilConstants.ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
        )
      })
      it('can buy $ART with stablecoin', async () => {
        await helpers.testSuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          utilConstants.friendTokenAmount,
          whitelistIdxOneFriend,
          userOneFriend,
          treeOneFriend,
          mockUSDT,
          tokenVault,
          treasuryWallet,
          utilConstants.stablecoinTokenRate,
        )
      })
      it('can redeem membership NFT with $ART', async () => {
        await helpers.testSuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          userOneFriend,
          utilConstants.friendTokenAmount,
          whitelistIdxOneFriend,
          treeOneFriend,
          utilConstants.ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
        )
        await tokenVault.connect(userOneFriend).approve(membershipContract.address, ethers.constants.MaxUint256)
        await expect(membershipContract.connect(userOneFriend).redeem(2, userOneFriend.address, userOneFriend.address))
          .to.not.be.reverted
        var [, start, ,] = await membershipContract.friendTier()
        expect(await membershipContract.ownerOf(start)).to.be.equal(userOneFriend.address)
      })
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
        var [, start, ,] = await membershipContract.friendTier()
        await membershipContract.connect(userOneFriend).approve(membershipContract.address, start)
        await expect(membershipContract.connect(userOneFriend).release(start)).to.be.revertedWith(
          utilConstants.revertMessageReleaseNotEnabled,
        )
      })
    })
  })

  describe('post-sale', () => {
    let whitelistIdx: number
    let start: BigNumber
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
      whitelistIdx = helpers.findWhiteListArrIdx(whitelistArr, userOneFriend.address)
    })

    describe('transfer membership NFTs', () => {
      let start: number

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
