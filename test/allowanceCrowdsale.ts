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
import {
  decimals,
  ethUSDPrice,
  ethValueForFriendAmount,
  friendTokenAmount,
  numNFTsOne,
  revertMessageCrowdsaleNotOpen,
  revertMessageDiscrete,
  revertMessageERC20Balance,
  revertMessageEthRate,
  revertMessageNoPermissionToSend,
  revertMessageNotEnoughEth,
  revertMessageStablecoinRate,
  revertMessageTransferExceedsBalance,
  revertMessageUserClaimedAllocation,
  stablecoinTokenRate,
  tokenSupply,
  totalSupplyOfMockUSDC,
  totalSupplyOfMockUSDT,
} from './utils/constants'
import {
  findWhiteListArrIdx,
  testUnsuccessfulTokenSaleWithStableCoin,
  testUnsuccessfulNFTSaleWithEth,
  testUnsuccessfulNFTSaleWithStableCoin,
  startSaleAndSetRate,
  startSale,
  testSuccessfulTokenSaleWithEth,
  testSuccessfulTokenSaleWithStableCoin,
  testUnsuccessfulTokenSaleWithEth,
  testSuccessfulNFTSaleWithEth,
  testSuccessfulNFTSaleWithStableCoin,
} from './utils/allowanceCrowdsaleHelpers'

describe('AllowanceCrowdsale', () => {
  let tokenVault: TokenVault
  let mockUSDC: IERC20
  let mockUSDT: IERC20
  let signer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let user3: SignerWithAddress
  let user4: SignerWithAddress
  let user5: SignerWithAddress
  let tokenHoldingWallet: SignerWithAddress
  let treasuryWallet: SignerWithAddress
  let allowanceCrowdsale: AllowanceCrowdsale
  let membershipContract: ERC721MembershipUpgradeable
  let rootSingle: string
  let rootDouble: string
  let rootExceedingSupply: string
  let rootFoundation: string
  let whitelistOne: string[]
  let whitelistTwo: string[]
  let whitelistThree: string[]
  let whitelistFour: string[]
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
    ;[signer, user1, user2, user3, user4, user5, tokenHoldingWallet, treasuryWallet] = await ethers.getSigners()
    whitelistOne = [user1.address]
    whitelistTwo = [user2.address]
    whitelistThree = [user3.address]
    whitelistFour = [user4.address]
    whitelistArr = [whitelistOne, whitelistTwo, whitelistThree, whitelistFour]

    mockUSDC = await deployERC20Mock(signer, 'Usdc', 'USDC', totalSupplyOfMockUSDC)
    mockUSDT = await deployERC20Mock(signer, 'Usdt', 'USDT', totalSupplyOfMockUSDT)
    for (let user of [user1, user2, user3]) {
      mockUSDC.transfer(user.address, totalSupplyOfMockUSDC.div(3))
      mockUSDT.transfer(user.address, totalSupplyOfMockUSDT.div(3))
    }

    const vaultFactory = await deployVaultFactory()

    const dummyNFT = await deployERC721Mock()
    await dummyNFT.mint(signer.address, 0)
    await dummyNFT.approve(vaultFactory.address, 0)

    tokenVault = await deployTokenVault(mockUSDC, dummyNFT, 0, vaultFactory)
    await tokenVault.transfer(tokenHoldingWallet.address, await tokenVault.balanceOf(signer.address))

    membershipContract = await deployMembership(tokenVault)

    allowanceCrowdsale = await deployAllowanceCrowdsale(
      tokenVault,
      treasuryWallet,
      tokenHoldingWallet,
      membershipContract,
      [mockUSDC, mockUSDT],
    )
    tokenVault.connect(tokenHoldingWallet).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
    for (let user of [user1, user2, user3]) {
      mockUSDC.connect(user).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
      mockUSDT.connect(user).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
    }

    // one NFT allocated for user 1
    const leavesSingle = whitelistOne.map((address) => utils.keccak256(address))
    treeSingle = new MerkleTree(leavesSingle, utils.keccak256, {
      sort: true,
    })
    rootSingle = treeSingle.getHexRoot()

    // two NFTs allocated for user 2
    const leavesDouble = whitelistTwo.map((address) => utils.keccak256(address))
    treeDouble = new MerkleTree(leavesDouble, utils.keccak256, {
      sort: true,
    })
    rootDouble = treeDouble.getHexRoot()

    const leavesExceedingSupply = whitelistThree.map((address) => utils.keccak256(address))
    treeExceedingSupply = new MerkleTree(leavesExceedingSupply, utils.keccak256, {
      sort: true,
    })
    rootExceedingSupply = treeExceedingSupply.getHexRoot()

    const leavesFoundation = whitelistFour.map((address) => utils.keccak256(address))
    treeFoundation = new MerkleTree(leavesFoundation, utils.keccak256, {
      sort: true,
    })
    rootFoundation = treeFoundation.getHexRoot()

    whitelistIdxUserOne = findWhiteListArrIdx(whitelistArr, user1.address)
    whitelistIdxUserTwo = findWhiteListArrIdx(whitelistArr, user2.address)
    whitelistIdxUserThree = findWhiteListArrIdx(whitelistArr, user3.address)
    whitelistIdxUserFour = findWhiteListArrIdx(whitelistArr, user4.address)
    whitelistIdxUserFive = findWhiteListArrIdx(whitelistArr, user5.address)
  })

  describe('whitelisted', () => {
    describe('before sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user1,
          friendTokenAmount,
          whitelistIdxUserOne,
          treeSingle,
          ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
          whitelistIdxUserOne,
          user1,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user1,
          numNFTsOne,
          whitelistIdxUserOne,
          treeDouble,
          ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user1,
          numNFTsOne,
          whitelistIdxUserOne,
          treeDouble,
          mockUSDC,
          treasuryWallet,
          tokenVault,
          revertMessageCrowdsaleNotOpen,
        )
      })
    })

    describe('after sale', () => {
      beforeEach(async () => {
        await startSaleAndSetRate(
          allowanceCrowdsale,
          ethUSDPrice,
          decimals,
          tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
          rootFoundation,
        )
        await allowanceCrowdsale.stopSale()
      })

      const doubleNFTnum = 2
      it('cannot buy $ART tokens with ETH', async () => {
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user1,
          friendTokenAmount,
          whitelistIdxUserOne,
          treeSingle,
          ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
          whitelistIdxUserOne,
          user1,
          treeSingle,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user1,
          doubleNFTnum,
          whitelistIdxUserOne,
          treeSingle,
          ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user1,
          doubleNFTnum,
          whitelistIdxUserOne,
          treeSingle,
          mockUSDC,
          treasuryWallet,
          tokenVault,
          revertMessageCrowdsaleNotOpen,
        )
      })
    })

    describe('during Sale', () => {
      beforeEach(async () => {
        startSale(
          allowanceCrowdsale,
          decimals,
          tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
          rootFoundation,
        )
      })
      describe('before rates are set', () => {
        it('cannot buy $ART tokens with ETH', async () => {
          await testUnsuccessfulTokenSaleWithEth(
            allowanceCrowdsale,
            user1,
            friendTokenAmount,
            whitelistIdxUserOne,
            treeSingle,
            ethValueForFriendAmount,
            tokenVault,
            treasuryWallet,
            revertMessageEthRate,
          )
        })
        it('cannot buy $ART tokens with accepted stablecoin', async () => {
          await testUnsuccessfulTokenSaleWithStableCoin(
            allowanceCrowdsale,
            friendTokenAmount,
            whitelistIdxUserOne,
            user1,
            treeSingle,
            mockUSDC,
            tokenVault,
            treasuryWallet,
            revertMessageStablecoinRate,
          )
        })

        it('cannot buy membership NFTs with ETH', async () => {
          await testUnsuccessfulNFTSaleWithEth(
            allowanceCrowdsale,
            user1,
            numNFTsOne,
            whitelistIdxUserOne,
            treeSingle,
            ethValueForFriendAmount,
            membershipContract,
            treasuryWallet,
            revertMessageEthRate,
          )
        })
        it('cannot buy membership NFTs with accepted stablecoin', async () => {
          await testUnsuccessfulNFTSaleWithStableCoin(
            allowanceCrowdsale,
            user1,
            numNFTsOne,
            whitelistIdxUserOne,
            treeSingle,
            mockUSDC,
            treasuryWallet,
            tokenVault,
            revertMessageStablecoinRate,
          )
        })
      })

      describe('after rates are set', () => {
        beforeEach(async () => {
          await allowanceCrowdsale.setRates(1, calculateEthRate(ethUSDPrice))
        })
        describe('indiscrete purchases', () => {
          it('cannot buy lower tier $ART tokens', async () => {
            // user4 is allocated Foundation tier but tries to buy Friends tier

            mockUSDC.connect(user1).transfer(user4.address, friendTokenAmount)
            await testUnsuccessfulTokenSaleWithStableCoin(
              allowanceCrowdsale,
              friendTokenAmount,
              whitelistIdxUserFour,
              user4,
              treeFoundation,
              mockUSDC,
              tokenVault,
              treasuryWallet,
              revertMessageDiscrete,
            )
          })
          it('cannot buy invalid fractional allocation of $ART tokens', async () => {
            const invalidAmount = friendTokenAmount.add(friendTokenAmount.div(2))
            await testUnsuccessfulTokenSaleWithStableCoin(
              allowanceCrowdsale,
              invalidAmount,
              whitelistIdxUserTwo,
              user4,
              treeFoundation,
              mockUSDC,
              tokenVault,
              treasuryWallet,
              revertMessageDiscrete,
            )
          })
        })

        describe('discrete purchases', () => {
          describe('full allocation of $ART tokens', () => {
            describe('with sufficient funds', () => {
              it('can buy full allocation of $ART tokens with ETH', async () => {
                await testSuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  user1,
                  friendTokenAmount,
                  whitelistIdxUserOne,
                  treeSingle,
                  ethValueForFriendAmount,
                  tokenVault,
                  treasuryWallet,
                )
              })

              it('can buy full allocation of $ART tokens with accepted stablecoin', async () => {
                await testSuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  friendTokenAmount.mul(2),
                  whitelistIdxUserTwo,
                  user2,
                  treeDouble,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  stablecoinTokenRate,
                )
              })

              it('cannot buy more than full allocation of $ART tokens with accepted stablecoin', async () => {
                await allowanceCrowdsale
                  .connect(user1)
                  .buyTokens(
                    friendTokenAmount,
                    whitelistIdxUserOne,
                    treeSingle.getHexProof(user1.address),
                    false,
                    mockUSDC.address,
                  )
                expect(await tokenVault.balanceOf(user1.address)).to.be.equal(friendTokenAmount)
                expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(
                  friendTokenAmount.mul(stablecoinTokenRate),
                )

                await expect(
                  allowanceCrowdsale
                    .connect(user1)
                    .buyTokens(
                      friendTokenAmount,
                      whitelistIdxUserOne,
                      treeSingle.getHexProof(user1.address),
                      false,
                      mockUSDT.address,
                    ),
                ).to.be.revertedWith(revertMessageUserClaimedAllocation)
                expect(await tokenVault.balanceOf(user1.address)).to.be.equal(friendTokenAmount)
                expect(await mockUSDT.balanceOf(treasuryWallet.address)).to.be.equal(0)
              })

              it('cannot buy when there is insufficient supply of $ART tokens', async () => {
                const tokenAmountExceedingSupply = tokenSupply.add(utils.parseUnits('400', decimals))
                const hexProof = treeExceedingSupply.getHexProof(user3.address)
                const buyWithEth = true
                const ethValue = calculateEthRate(ethUSDPrice).mul(tokenAmountExceedingSupply)

                await testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  user3,
                  tokenAmountExceedingSupply,
                  whitelistIdxUserThree,
                  treeExceedingSupply,
                  ethValue,
                  tokenVault,
                  treasuryWallet,
                  revertMessageTransferExceedsBalance,
                )
              })
            })

            describe('with insufficient funds', () => {
              it('cannot buy full allocation of $ART tokens with ETH', async () => {
                await testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  user1,
                  friendTokenAmount,
                  whitelistIdxUserOne,
                  treeSingle,
                  ethValueForFriendAmount.sub(1),
                  tokenVault,
                  treasuryWallet,
                  revertMessageNotEnoughEth,
                )
              })

              it('cannot buy full allocation of $ART tokens with accepted stablecoin', async () => {
                await mockUSDC.connect(user1).transfer(user4.address, await mockUSDC.balanceOf(user1.address))
                await expect(
                  allowanceCrowdsale
                    .connect(user1)
                    .buyTokens(friendTokenAmount, 0, treeSingle.getHexProof(user1.address), false, mockUSDC.address),
                ).to.be.revertedWith('ERC20: transfer amount exceeds balance')
                expect(await tokenVault.balanceOf(user1.address)).to.be.equal(0)
                expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(0)
              })
            })
          })
          describe('partial allocation of $ART tokens', () => {
            describe('with sufficient funds', () => {
              it('can buy valid partial allocation of $ART tokens with ETH', async () => {
                await testSuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  user2,
                  friendTokenAmount,
                  whitelistIdxUserTwo,
                  treeDouble,
                  ethValueForFriendAmount,
                  tokenVault,
                  treasuryWallet,
                )
              })
              it('can buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {
                await testSuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  friendTokenAmount,
                  whitelistIdxUserOne,
                  user1,
                  treeDouble,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  stablecoinTokenRate,
                )
              })
            })

            describe('with insufficient funds', () => {
              it('cannot buy valid partial allocation of $ART tokens with ETH', async () => {
                await testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  user2,
                  friendTokenAmount,
                  whitelistIdxUserTwo,
                  treeDouble,
                  ethValueForFriendAmount.sub(1),
                  tokenVault,
                  treasuryWallet,
                  revertMessageNotEnoughEth,
                )
              })
              it('cannot buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {
                await mockUSDC.connect(user2).transfer(user4.address, await mockUSDC.balanceOf(user2.address))
                await testUnsuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  friendTokenAmount,
                  whitelistIdxUserTwo,
                  user2,
                  treeDouble,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  revertMessageERC20Balance,
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
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user5,
          friendTokenAmount,
          whitelistIdx,
          treeSingle,
          ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
          whitelistIdx,
          user5,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user5,
          numNFTsOne,
          whitelistIdx,
          treeDouble,
          ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user5,
          numNFTsOne,
          whitelistIdx,
          treeDouble,
          mockUSDC,
          treasuryWallet,
          tokenVault,
          revertMessageCrowdsaleNotOpen,
        )
      })
    })

    describe('after sale', () => {
      beforeEach(async () => {
        await startSaleAndSetRate(
          allowanceCrowdsale,
          ethUSDPrice,
          decimals,
          tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
          rootFoundation,
        )
        await allowanceCrowdsale.stopSale()
      })

      it('cannot buy $ART tokens with ETH', async () => {
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user5,
          friendTokenAmount,
          whitelistIdx,
          treeSingle,
          ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
          whitelistIdx,
          user5,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        await testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user5,
          numNFTsOne,
          whitelistIdx,
          treeDouble,
          ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          revertMessageCrowdsaleNotOpen,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user5,
          numNFTsOne,
          whitelistIdx,
          treeDouble,
          mockUSDC,
          treasuryWallet,
          tokenVault,
          revertMessageCrowdsaleNotOpen,
        )
      })
    })

    describe('during sale', () => {
      beforeEach(async () => {
        await startSaleAndSetRate(
          allowanceCrowdsale,
          ethUSDPrice,
          decimals,
          tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
          rootFoundation,
        )
      })
      const revertMessageInvalidProof = 'Invalid proof'
      it('cannot buy $ART tokens with ETH', async () => {
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user5,
          friendTokenAmount,
          whitelistIdx,
          treeSingle,
          ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
          revertMessageInvalidProof,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        await testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
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
        await testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user5,
          numNFTsOne,
          whitelistIdx,
          treeDouble,
          ethValueForFriendAmount,
          membershipContract,
          treasuryWallet,
          revertMessageInvalidProof,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        await testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user5,
          numNFTsOne,
          whitelistIdx,
          treeDouble,
          mockUSDC,
          treasuryWallet,
          tokenVault,
          revertMessageInvalidProof,
        )
      })
    })
  })

  describe('pausability', () => {
    let whitelistIdx: number
    beforeEach(async () => {
      await startSaleAndSetRate(
        allowanceCrowdsale,
        ethUSDPrice,
        decimals,
        tokenSupply,
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
      whitelistIdx = findWhiteListArrIdx(whitelistArr, user1.address)
    })
    describe('tokens for whitelisted address', () => {
      it('can buy $ART with ETH', async () => {
        await testSuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user1,
          friendTokenAmount,
          whitelistIdxUserOne,
          treeSingle,
          ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
        )
      })
      it('can buy $ART with stablecoin', async () => {
        await testSuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
          whitelistIdxUserOne,
          user1,
          treeSingle,
          mockUSDT,
          tokenVault,
          treasuryWallet,
          stablecoinTokenRate,
        )
      })
      it('can redeem membership NFT with $ART', async () => {
        await testSuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user1,
          friendTokenAmount,
          whitelistIdxUserOne,
          treeSingle,
          ethValueForFriendAmount,
          tokenVault,
          treasuryWallet,
        )
        await tokenVault.connect(user1).approve(membershipContract.address, ethers.constants.MaxUint256)
        await expect(membershipContract.connect(user1).redeem(2, user1.address, user1.address)).to.not.be.reverted
        var [, start, ,] = await membershipContract.friendTier()
        expect(await membershipContract.ownerOf(start)).to.be.equal(user1.address)
      })
    })
    describe('NFTs for whitelisted address', () => {
      it('can buy NFTs with ETH', async () => {
        await testSuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user1,
          numNFTsOne,
          whitelistIdxUserOne,
          treeSingle,
          ethValueForFriendAmount,
          treasuryWallet,
          membershipContract,
        )
      })
      it('can buy NFTs with stablecoin', async () => {
        await testSuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user1,
          numNFTsOne,
          whitelistIdxUserOne,
          treeSingle,
          mockUSDC,
          treasuryWallet,
          tokenVault,
          friendTokenAmount.mul(stablecoinTokenRate),
        )
      })
      it('cannot release NFT for $ART', async () => {
        await testSuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user1,
          numNFTsOne,
          whitelistIdxUserOne,
          treeSingle,
          mockUSDC,
          treasuryWallet,
          tokenVault,
          friendTokenAmount.mul(stablecoinTokenRate),
        )
        var [, start, ,] = await membershipContract.friendTier()
        await membershipContract.connect(user1).approve(membershipContract.address, start)
        await expect(membershipContract.connect(user1).release(start)).to.be.revertedWith(
          revertMessageNoPermissionToSend,
        )
      })
    })
  })
})
