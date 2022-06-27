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
import { arrayify } from 'ethers/lib/utils'

describe('AllowanceCrowdsale', () => {
  let tokenVault: TokenVault
  let mockUSDC: IERC20
  let mockUSDT: IERC20
  let signer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let user3: SignerWithAddress
  let user4: SignerWithAddress
  let tokenHoldingWallet: SignerWithAddress
  let treasuryWallet: SignerWithAddress
  let allowanceCrowdsale: AllowanceCrowdsale
  let membershipContract: ERC721MembershipUpgradeable
  const decimals = 6
  const ethUSDPrice = 1000
  const totalSupplyOfMockUSDC = utils.parseUnits('9000000', decimals)
  const totalSupplyOfMockUSDT = utils.parseUnits('9000000', decimals)
  const rate = 1
  const tokenSupply = ethers.utils.parseUnits('4000000', decimals)
  const friendTokenAmount = utils.parseUnits('400', decimals)
  const ethValueForFriendAmount = calculateEthRate(ethUSDPrice).mul(friendTokenAmount)
  let whiteListOne: string[]
  let whiteListTwo: string[]
  let whiteListThree: string[]
  let whiteListArr: string[][]
  let treeSingle: MerkleTree
  let treeDouble: MerkleTree
  let treeExceedingSupply: MerkleTree
  let rootSingle: string
  let rootDouble: string
  let rootExceedingSupply: string

  beforeEach(async () => {
    ;[signer, user1, user2, user3, user4, tokenHoldingWallet, treasuryWallet] = await ethers.getSigners()
    whiteListOne = [user1.address]
    whiteListTwo = [user2.address]
    whiteListThree = [user3.address]
    whiteListArr = [whiteListOne, whiteListTwo, whiteListThree]

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
    const leavesSingle = whiteListOne.map((address) => utils.keccak256(address))
    treeSingle = new MerkleTree(leavesSingle, utils.keccak256, {
      sort: true,
    })
    rootSingle = treeSingle.getHexRoot()

    // two NFTs allocated for user 2
    const leavesDouble = whiteListTwo.map((address) => utils.keccak256(address))
    treeDouble = new MerkleTree(leavesDouble, utils.keccak256, {
      sort: true,
    })
    rootDouble = treeDouble.getHexRoot()

    const leavesExceedingSupply = whiteListThree.map((address) => utils.keccak256(address))
    treeExceedingSupply = new MerkleTree(leavesExceedingSupply, utils.keccak256, {
      sort: true,
    })
    rootExceedingSupply = treeExceedingSupply.getHexRoot()
  })

  describe('whitelisted', () => {
    describe('Before sale', () => {
      const revertMessage = 'crowdsale:not open'
      it('cannot buy $ART tokens with ETH', async () => {
        const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user1,
          friendTokenAmount,
          whiteListIdx,
          treeSingle,
          ethValueForFriendAmount,
          revertMessage,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
        await testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
          whiteListIdx,
          user1,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessage,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
        const numNFTs = 1
        await testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user1,
          numNFTs,
          whiteListIdx,
          treeDouble,
          ethValueForFriendAmount,
          revertMessage,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
        const numNFTs = 1
        await testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user1,
          numNFTs,
          whiteListIdx,
          treeDouble,
          mockUSDC,
          treasuryWallet,
          revertMessage,
        )
      })
    })

    describe('After sale', () => {
      beforeEach(async () => {
        await startSaleAndSetRate(
          allowanceCrowdsale,
          ethUSDPrice,
          decimals,
          tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
        )
        await allowanceCrowdsale.stopSale()
      })

      const numNFTs = 2

      it('cannot buy $ART tokens with ETH', async () => {
        const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
        const revertMessage = 'crowdsale:not open'
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user1,
          friendTokenAmount,
          whiteListIdx,
          treeSingle,
          ethValueForFriendAmount,
          revertMessage,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
        await expect(
          allowanceCrowdsale
            .connect(user1)
            .buyTokens(friendTokenAmount, whiteListIdx, treeSingle.getHexProof(user1.address), true, mockUSDC.address),
        ).to.be.revertedWith('crowdsale:not open')
      })

      it('cannot buy membership NFTs with ETH', async () => {
        const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
        await expect(
          allowanceCrowdsale
            .connect(user1)
            .buyNFTs(numNFTs, whiteListIdx, treeSingle.getHexProof(user1.address), true, constants.AddressZero, {
              value: ethValueForFriendAmount,
            }),
        ).to.be.revertedWith('crowdsale:not open')
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
        await expect(
          allowanceCrowdsale
            .connect(user1)
            .buyNFTs(numNFTs, whiteListIdx, treeSingle.getHexProof(user1.address), true, mockUSDC.address),
        ).to.be.revertedWith('crowdsale:not open')
      })
    })

    describe('During Sale', () => {
      beforeEach(async () => {
        await allowanceCrowdsale.startSale(
          [2, 2, 2],
          [
            utils.parseUnits('400', decimals),
            utils.parseUnits('800', decimals),
            tokenSupply.add(utils.parseUnits('400', decimals)),
          ],
          [rootSingle, rootDouble, rootExceedingSupply],
        )
      })
      describe('before rates are set', () => {
        const numNFTs = 2
        const revertMessageEth = 'crowdsale:ethRate <= 0'
        const revertMessageStablecoin = 'crowdsale:stablecoinRate <= 0'

        it('cannot buy $ART tokens with ETH', async () => {
          const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)

          await testUnsuccessfulTokenSaleWithEth(
            allowanceCrowdsale,
            user1,
            friendTokenAmount,
            whiteListIdx,
            treeSingle,
            ethValueForFriendAmount,
            revertMessageEth,
          )
        })
        it('cannot buy $ART tokens with accepted stablecoin', async () => {
          const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
          await testUnsuccessfulTokenSaleWithStableCoin(
            allowanceCrowdsale,
            friendTokenAmount,
            whiteListIdx,
            user1,
            treeSingle,
            mockUSDC,
            tokenVault,
            treasuryWallet,
            revertMessageStablecoin,
          )
        })

        it('cannot buy membership NFTs with ETH', async () => {
          const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
          const ethValue = calculateEthRate(ethUSDPrice).mul(friendTokenAmount)
          await testUnsuccessfulTokenSaleWithEth(
            allowanceCrowdsale,
            user1,
            friendTokenAmount,
            whiteListIdx,
            treeSingle,
            ethValue,
            revertMessageEth,
          )
        })
        it('cannot buy membership NFTs with accepted stablecoin', async () => {
          const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
          await testUnsuccessfulNFTSaleWithStableCoin(
            allowanceCrowdsale,
            user1,
            1,
            whiteListIdx,
            treeSingle,
            mockUSDC,
            treasuryWallet,
            revertMessageStablecoin,
          )
        })
      })

      describe('after rates are set', () => {
        beforeEach(async () => {
          await allowanceCrowdsale.setRates(1, calculateEthRate(ethUSDPrice))
        })
        describe('indiscrete purchases', () => {
          it('cannot buy lower tier $ART tokens', async () => {})
          it('cannot buy invalid fractional allocation of $ART tokens', async () => {})
        })

        describe('discrete purchases', () => {
          describe('full allocation of $ART tokens', () => {
            describe('with sufficient funds', () => {
              it('can buy full allocation of $ART tokens with ETH', async () => {
                await allowanceCrowdsale
                  .connect(user1)
                  .buyTokens(friendTokenAmount, 0, treeSingle.getHexProof(user1.address), true, constants.AddressZero, {
                    value: ethValueForFriendAmount,
                  })
              })
              it('can buy full allocation of $ART tokens with accepted stablecoin', async () => {
                await testSuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  friendTokenAmount.mul(2),
                  1,
                  user2,
                  treeDouble,
                  false,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  rate,
                )
              })

              it('cannot buy more than full allocation of $ART tokens with accepted stablecoin', async () => {
                await allowanceCrowdsale
                  .connect(user1)
                  .buyTokens(friendTokenAmount, 0, treeSingle.getHexProof(user1.address), false, mockUSDC.address)
                expect(await tokenVault.balanceOf(user1.address)).to.be.equal(friendTokenAmount)
                expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(friendTokenAmount.mul(rate))

                await expect(
                  allowanceCrowdsale
                    .connect(user1)
                    .buyTokens(friendTokenAmount, 0, treeSingle.getHexProof(user1.address), false, mockUSDT.address),
                ).to.be.revertedWith('crowdsale:user has already claimed allocation')
                expect(await tokenVault.balanceOf(user1.address)).to.be.equal(friendTokenAmount)
                expect(await mockUSDT.balanceOf(treasuryWallet.address)).to.be.equal(0)
              })

              it('cannot buy when there is insufficient supply of $ART tokens', async () => {
                const tokenAmountExceedingSupply = tokenSupply.add(utils.parseUnits('400', decimals))
                var whiteListIdx = findWhiteListArrIdx(whiteListArr, user3.address)
                const hexProof = treeExceedingSupply.getHexProof(user3.address)
                const buyWithEth = true
                const ethValue = calculateEthRate(ethUSDPrice).mul(tokenAmountExceedingSupply)
                const revertMessage = 'ERC20: transfer amount exceeds balance'

                await testUnsuccessfulTokenSaleWithEth(
                  allowanceCrowdsale,
                  user3,
                  tokenAmountExceedingSupply,
                  whiteListIdx,
                  treeExceedingSupply,
                  ethValue,
                  revertMessage,
                )
              })
            })

            describe('with insufficient funds', () => {
              // it.only('cannot buy full allocation of $ART tokens with ETH', async () => {
              //   console.log('HEREE\n\n\n')
              //   const prov = await ethers.getDefaultProvider()
              //   console.log(await prov.getBalance(user1.address))
              //   const balanceUser1ETH = await prov.getBalance(user1.address)
              //   await user1.sendTransaction({
              //     to: user4.address,
              //     value: balanceUser1ETH,
              //   })
              //   console.log(await prov.getBalance(user1.address))
              //   console.log(ethValueForFriendAmount)
              //   await allowanceCrowdsale
              //     .connect(user1)
              //     .buyTokens(friendTokenAmount, 0, treeSingle.getHexProof(user1.address), true, constants.AddressZero, {
              //       value: ethValueForFriendAmount,
              //     }),
              //     expect(await tokenVault.balanceOf(user1.address)).to.be.equal(0)
              // })
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
              it('can buy valid partial allocation of $ART tokens with ETH', async () => {})
              it('can buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {
                const whiteListIdx = findWhiteListArrIdx(whiteListArr, user1.address)
                await testSuccessfulTokenSaleWithStableCoin(
                  allowanceCrowdsale,
                  friendTokenAmount,
                  whiteListIdx,
                  user1,
                  treeDouble,
                  false,
                  mockUSDC,
                  tokenVault,
                  treasuryWallet,
                  rate,
                )
              })
            })

            describe('with insufficient funds', () => {
              it('can buy valid partial allocation of $ART tokens with ETH', async () => {})
              it('can buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {})
            })
          })
        })
      })
    })
  })

  describe('not whitelisted', () => {
    describe('Before sale', () => {
      const revertMessage = 'crowdsale:not open'
      it('cannot buy $ART tokens with ETH', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user4,
          friendTokenAmount,
          whiteListIdx,
          treeSingle,
          ethValueForFriendAmount,
          revertMessage,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        await testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
          whiteListIdx,
          user4,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessage,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        const numNFTs = 1
        await testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user4,
          numNFTs,
          whiteListIdx,
          treeDouble,
          ethValueForFriendAmount,
          revertMessage,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        const numNFTs = 1
        await testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user4,
          numNFTs,
          whiteListIdx,
          treeDouble,
          mockUSDC,
          treasuryWallet,
          revertMessage,
        )
      })
    })

    describe('After sale', () => {
      beforeEach(async () => {
        await startSaleAndSetRate(
          allowanceCrowdsale,
          ethUSDPrice,
          decimals,
          tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
        )
        await allowanceCrowdsale.stopSale()
      })
      const revertMessage = 'crowdsale:not open'
      it('cannot buy $ART tokens with ETH', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user4,
          friendTokenAmount,
          whiteListIdx,
          treeSingle,
          ethValueForFriendAmount,
          revertMessage,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        await testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
          whiteListIdx,
          user4,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessage,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        const numNFTs = 1
        await testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user4,
          numNFTs,
          whiteListIdx,
          treeDouble,
          ethValueForFriendAmount,
          revertMessage,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        const numNFTs = 1
        await testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user4,
          numNFTs,
          whiteListIdx,
          treeDouble,
          mockUSDC,
          treasuryWallet,
          revertMessage,
        )
      })
    })

    describe('During sale', () => {
      beforeEach(async () => {
        await startSaleAndSetRate(
          allowanceCrowdsale,
          ethUSDPrice,
          decimals,
          tokenSupply,
          rootSingle,
          rootDouble,
          rootExceedingSupply,
        )
      })
      const revertMessage = 'Invalid proof'
      it('cannot buy $ART tokens with ETH', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        await testUnsuccessfulTokenSaleWithEth(
          allowanceCrowdsale,
          user4,
          friendTokenAmount,
          whiteListIdx,
          treeSingle,
          ethValueForFriendAmount,
          revertMessage,
        )
      })
      it('cannot buy $ART tokens with accepted stablecoin', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        await testUnsuccessfulTokenSaleWithStableCoin(
          allowanceCrowdsale,
          friendTokenAmount,
          whiteListIdx,
          user4,
          treeDouble,
          mockUSDC,
          tokenVault,
          treasuryWallet,
          revertMessage,
        )
      })

      it('cannot buy membership NFTs with ETH', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        const numNFTs = 1
        await testUnsuccessfulNFTSaleWithEth(
          allowanceCrowdsale,
          user4,
          numNFTs,
          whiteListIdx,
          treeDouble,
          ethValueForFriendAmount,
          revertMessage,
        )
      })
      it('cannot buy membership NFTs with accepted stablecoin', async () => {
        var whiteListIdx = findWhiteListArrIdx(whiteListArr, user4.address)
        expect(whiteListIdx).to.be.equal(-1)
        // forcing an incorrect whiteListIdx to interact with the contract
        whiteListIdx = 1
        const numNFTs = 1
        await testUnsuccessfulNFTSaleWithStableCoin(
          allowanceCrowdsale,
          user4,
          numNFTs,
          whiteListIdx,
          treeDouble,
          mockUSDC,
          treasuryWallet,
          revertMessage,
        )
      })
    })
  })
})

// 1. Token sale with ETH

async function testSuccessfulTokenSaleWithEth(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  tokenAmount: BigNumber,
  whiteListIdx: number,
  tree: MerkleTree,
  ethValue: BigNumber,
) {
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyTokens(tokenAmount, whiteListIdx, tree.getHexProof(user.address), true, constants.AddressZero, {
        value: ethValue,
      }),
  ).to.be.revertedWith('crowdsale:not open')
}

async function testUnsuccessfulTokenSaleWithEth(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  tokenAmount: BigNumber,
  whiteListIdx: number,
  tree: MerkleTree,
  ethValue: BigNumber,
  revertMessage: string,
) {
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyTokens(tokenAmount, whiteListIdx, tree.getHexProof(user.address), true, constants.AddressZero, {
        value: ethValue,
      }),
  ).to.be.revertedWith(revertMessage)
}

// 2. NFT sale with ETH

async function testUnsuccessfulNFTSaleWithEth(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  nftNum: number,
  whiteListIdx: number,
  tree: MerkleTree,
  ethValue: BigNumber,
  revertMessage: string,
) {
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyNFTs(nftNum, whiteListIdx, tree.getHexProof(user.address), true, constants.AddressZero, {
        value: ethValue,
      }),
  ).to.be.revertedWith(revertMessage)
}

// 3. Token sale with stablecoin

async function testSuccessfulTokenSaleWithStableCoin(
  allowanceCrowdsale: AllowanceCrowdsale,
  tokenAmount: BigNumber,
  whitelistIdx: number,
  user: SignerWithAddress,
  tree: MerkleTree,
  buyWithEth: boolean,
  stablecoin: IERC20,
  tokenVault: TokenVault,
  treasuryWallet: SignerWithAddress,
  rate: number,
) {
  await allowanceCrowdsale
    .connect(user)
    .buyTokens(tokenAmount, whitelistIdx, tree.getHexProof(user.address), false, stablecoin.address)
  expect(await tokenVault.balanceOf(user.address)).to.be.equal(tokenAmount)
  expect(await stablecoin.balanceOf(treasuryWallet.address)).to.be.equal(tokenAmount.mul(rate))
}

async function testUnsuccessfulTokenSaleWithStableCoin(
  allowanceCrowdsale: AllowanceCrowdsale,
  tokenAmount: BigNumber,
  whitelistIdx: number,
  user: SignerWithAddress,
  tree: MerkleTree,
  stablecoin: IERC20,
  tokenVault: TokenVault,
  treasuryWallet: SignerWithAddress,
  revertMessage: string,
) {
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyTokens(tokenAmount, whitelistIdx, tree.getHexProof(user.address), false, stablecoin.address),
  ).to.be.revertedWith(revertMessage)
  expect(await tokenVault.balanceOf(user.address)).to.be.equal(0)
  expect(await stablecoin.balanceOf(treasuryWallet.address)).to.be.equal(0)
}

// 4. NFT sale with stablecoin

async function testUnsuccessfulNFTSaleWithStableCoin(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  nftNum: number,
  whiteListIdx: number,
  tree: MerkleTree,
  stablecoin: IERC20,
  treasuryWallet: SignerWithAddress,
  revertMessage: string,
) {
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyNFTs(nftNum, whiteListIdx, tree.getHexProof(user.address), false, stablecoin.address),
  ).to.be.revertedWith(revertMessage)

  expect(await stablecoin.balanceOf(treasuryWallet.address)).to.be.equal(0)
}

async function startSaleAndSetRate(
  allowanceCrowdsale: AllowanceCrowdsale,
  ethUSDPrice: number,
  decimals: number,
  tokenSupply: BigNumber,
  rootSingle: string,
  rootDouble: string,
  rootExceedingSupply: string,
) {
  await allowanceCrowdsale.setRates(1, calculateEthRate(ethUSDPrice))
  await allowanceCrowdsale.startSale(
    [2, 2, 2],
    [
      utils.parseUnits('400', decimals),
      utils.parseUnits('800', decimals),
      tokenSupply.add(utils.parseUnits('400', decimals)),
    ],
    [rootSingle, rootDouble, rootExceedingSupply],
  )
}

function findWhiteListArrIdx(whiteListArr: string[][], address: string): number {
  for (var counter: number = 0; counter < whiteListArr.length; counter++) {
    if (whiteListArr[counter].includes(address)) {
      return counter
    }
  }
  return -1
}
