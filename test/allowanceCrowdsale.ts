import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { utils, constants } from 'ethers'
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

describe('AllowanceCrowdsale', () => {
  let tokenVault: TokenVault
  let mockUSDC: IERC20
  let mockUSDT: IERC20
  let signer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let user3: SignerWithAddress
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

  beforeEach(async () => {
    ;[signer, user1, user2, user3, tokenHoldingWallet, treasuryWallet] = await ethers.getSigners()

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
  })

  describe('whitelisted', () => {
    let treeSingle: MerkleTree
    let treeDouble: MerkleTree
    let treeExceedingSupply: MerkleTree

    beforeEach(async () => {
      // one NFT allocated
      const leavesSingle = [user1.address].map((address) => utils.keccak256(address))
      treeSingle = new MerkleTree(leavesSingle, utils.keccak256, {
        sort: true,
      })
      const rootSingle = treeSingle.getHexRoot()

      // two NFTs allocated
      const leavesDouble = [user2.address].map((address) => utils.keccak256(address))
      treeDouble = new MerkleTree(leavesDouble, utils.keccak256, {
        sort: true,
      })
      const rootDouble = treeDouble.getHexRoot()

      const leavesExceedingSupply = [user3.address].map((address) => utils.keccak256(address))
      treeExceedingSupply = new MerkleTree(leavesExceedingSupply, utils.keccak256, {
        sort: true,
      })
      const rootExceedingSupply = treeSingle.getHexRoot()

      await allowanceCrowdsale.setRates(1, calculateEthRate(ethUSDPrice))
      await allowanceCrowdsale.startSale(
        [2, 2, 2], // friend, friend, friend
        [
          utils.parseUnits('400', decimals),
          utils.parseUnits('800', decimals),
          tokenSupply.add(utils.parseUnits('400', decimals)),
        ], // BKLN tokens
        [rootSingle, rootDouble, rootExceedingSupply], // merkle roots
      )
    })

    describe('Before sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {})
      it('cannot buy $ART tokens with accepted stablecoin', async () => {})

      it('cannot buy membership NFTs with ETH', async () => {})
      it('cannot buy membership NFTs with accepted stablecoin', async () => {})
    })

    describe('After sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {})
      it('cannot buy $ART tokens with accepted stablecoin', async () => {})

      it('cannot buy membership NFTs with ETH', async () => {})
      it('cannot buy membership NFTs with accepted stablecoin', async () => {})
    })

    describe('During Sale', () => {
      describe('before rates are set', () => {
        it('cannot buy $ART tokens with ETH', async () => {})
        it('cannot buy $ART tokens with accepted stablecoin', async () => {})
        it('cannot buy membership NFTs with ETH', async () => {})
        it('cannot buy membership NFTs with accepted stablecoin', async () => {})
      })

      describe('after rates are set', () => {
        describe('indiscrete purchases', () => {
          it('cannot buy lower tier $ART tokens', async () => {})
          it('cannot buy invalid fractional allocation of $ART tokens', async () => {})
        })

        describe('discrete purchases', () => {
          describe('full allocation of $ART tokens', () => {
            describe('with sufficient funds', () => {
              it('can buy full allocation of $ART tokens with ETH', async () => {})
              it('can buy full allocation of $ART tokens with accepted stablecoin', async () => {})
            })

            describe('with insufficient funds', () => {
              it('cannot buy full allocation of $ART tokens with ETH', async () => {})
              it('cannot buy full allocation of $ART tokens with accepted stablecoin', async () => {})
            })
          })
          describe('partial allocation of $ART tokens', () => {
            describe('with sufficient funds', () => {
              it('can buy valid partial allocation of $ART tokens with ETH', async () => {})
              it('can buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {})
            })

            describe('with insufficient funds', () => {
              it('can buy valid partial allocation of $ART tokens with ETH', async () => {})
              it('can buy valid partial allocation of $ART tokens with accepted stablecoin', async () => {})
            })
          })
        })
      })

      describe('BKLN supply', () => {
        it('sells BKLN tokens when there is sufficient supply', async () => {
          await allowanceCrowdsale
            .connect(user1)
            .buyTokens(
              utils.parseUnits('400', decimals),
              0,
              treeSingle.getHexProof(user1.address),
              true,
              constants.AddressZero,
              {
                value: calculateEthRate(ethUSDPrice).mul(utils.parseUnits('400', decimals)),
              },
            )
        })

        it('fails to sell BKLN tokens when there is insufficient supply', async () => {
          await expect(
            allowanceCrowdsale
              .connect(user1)
              .buyTokens(
                tokenSupply.add(utils.parseUnits('400', decimals)),
                2,
                treeExceedingSupply.getHexProof(user3.address),
                true,
                constants.AddressZero,
                {
                  value: calculateEthRate(ethUSDPrice).mul(tokenSupply.add(utils.parseUnits('400', decimals))),
                },
              ),
          ).to.be.revertedWith('ERC20: transfer amount exceeds balance')
        })
      })

      describe('accepting payment with different currencies', () => {
        it('accepts payments in USDC', async () => {
          const quantity = utils.parseUnits('400', decimals)
          await allowanceCrowdsale
            .connect(user1)
            .buyTokens(quantity, 0, treeSingle.getHexProof(user1.address), false, mockUSDC.address)
          expect(await tokenVault.balanceOf(user1.address)).to.be.equal(quantity)
          expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(quantity.mul(rate))
        })

        it('accepts payments in USDT', async () => {
          const quantity = utils.parseUnits('400', decimals)
          await allowanceCrowdsale
            .connect(user1)
            .buyTokens(quantity, 0, treeSingle.getHexProof(user1.address), false, mockUSDT.address)
          expect(await tokenVault.balanceOf(user1.address)).to.be.equal(quantity)
          expect(await mockUSDT.balanceOf(treasuryWallet.address)).to.be.equal(quantity.mul(rate))
        })
      })
    })
  })

  describe('not whitelisted', () => {
    describe('Before sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {})
      it('cannot buy $ART tokens with accepted stablecoin', async () => {})

      it('cannot buy membership NFTs with ETH', async () => {})
      it('cannot buy membership NFTs with accepted stablecoin', async () => {})
    })

    describe('After sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {})
      it('cannot buy $ART tokens with accepted stablecoin', async () => {})

      it('cannot buy membership NFTs with ETH', async () => {})
      it('cannot buy membership NFTs with accepted stablecoin', async () => {})
    })

    describe('During sale', () => {
      it('cannot buy $ART tokens with ETH', async () => {})
      it('cannot buy $ART tokens with accepted stablecoin', async () => {})

      it('cannot buy membership NFTs with ETH', async () => {})
      it('cannot buy membership NFTs with accepted stablecoin', async () => {})
    })
  })
})
