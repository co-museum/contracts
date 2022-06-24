import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { BigNumberish, utils, constants, BigNumber } from 'ethers'
import { MerkleTree } from 'merkletreejs'
import { ERC20Mock, AllowanceCrowdsale, ERC721MembershipUpgradeable, TokenVault } from '../typechain'

describe('AllowanceCrowdsale', () => {
  let tokenVault: TokenVault
  let mockUSDC: ERC20Mock
  let mockUSDT: ERC20Mock
  let acceptedStablecoins: string[]
  let signer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let user3: SignerWithAddress
  let tokeHoldingWallet: SignerWithAddress
  let treasuryWallet: SignerWithAddress
  let allowanceCrowdsale: AllowanceCrowdsale
  let membershipContract: ERC721MembershipUpgradeable
  const decimals = 6
  const ethUSDPrice = 1000
  const totalSupplyOfMockUSDC = utils.parseUnits('9000000', decimals)
  const totalSupplyOfMockUSDT = utils.parseUnits('9000000', decimals)
  const rate = 1
  const initialPrice = ethers.utils.parseEther('4000')
  const tokenSupply = ethers.utils.parseUnits('4000000', decimals)

  function calculateEthRate(ethPrice: BigNumberish): BigNumber {
    // assuming BKLN has 6 decimals and is worht 1 USD
    return ethers.BigNumber.from(10).pow(12).div(ethUSDPrice)
  }

  beforeEach(async () => {
    ;[signer, user1, user2, user3, tokeHoldingWallet, treasuryWallet] = await ethers.getSigners()

    /**
     * @param mockERC20 Mock ERC20 token representing tokens associated with our art work
     * @param totalSupplyOfERC20 total supply of our mockERC20
     */
    /**
     * @param mockUSDC Mock ERC20 token representing USDC
     * @param totalSupplyOfERC20 total supply of our mockERC20
     */
    const MockUSDC = await ethers.getContractFactory('ERC20Mock')
    mockUSDC = await MockUSDC.deploy('Usdc', 'USDC', signer.address, totalSupplyOfMockUSDC.toString(), 6)
    await mockUSDC.deployed()
    await mockUSDC.transfer(user1.address, totalSupplyOfMockUSDC.div(3))
    await mockUSDC.transfer(user2.address, totalSupplyOfMockUSDC.div(3))
    await mockUSDC.transfer(user3.address, totalSupplyOfMockUSDC.div(3))

    /**
     * @param mockUSDT Mock ERC20 token representing USDT
     * @param totalSupplyOfMockUSDT total supply of our mockERC20
     */
    const MockUSDT = await ethers.getContractFactory('ERC20Mock')
    mockUSDT = await MockUSDT.deploy('Usdc', 'USDC', signer.address, totalSupplyOfMockUSDC.toString(), 6)
    await mockUSDT.deployed()
    mockUSDT.approve(user1.address, totalSupplyOfMockUSDT)
    await mockUSDT.transfer(user1.address, totalSupplyOfMockUSDT.div(3))
    await mockUSDT.transfer(user2.address, totalSupplyOfMockUSDT.div(3))
    await mockUSDT.transfer(user3.address, totalSupplyOfMockUSDT.div(3))

    acceptedStablecoins = [mockUSDC.address, mockUSDT.address]

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
      mockUSDC.address,
      0, // tokenID
      tokenSupply, // supply
      // TODO: tweak once USDC price is implemented
      initialPrice, // list price
      0, // fee
    )

    const receipt = await tx.wait()
    const [mintEvent] = receipt.events!.filter((event, i, arr) => event.event == 'Mint')
    const vaultAddress = mintEvent.args!['vault']
    tokenVault = await ethers.getContractAt('TokenVault', vaultAddress)
    await tokenVault.transfer(tokeHoldingWallet.address, await tokenVault.balanceOf(signer.address))

    const VoteDelegator = await ethers.getContractFactory('VoteDelegator')
    const voteDelegator = await VoteDelegator.deploy()
    await voteDelegator.deployed()
    await voteDelegator.initialize(tokenVault.address)

    const MembershipContract = await ethers.getContractFactory('ERC721MembershipUpgradeable')
    membershipContract = await MembershipContract.deploy()
    await membershipContract.deployed()
    await membershipContract.initialize('Membership', 'MBR', tokenVault.address, voteDelegator.address, 2, 4, 6)

    const AllowanceCrowdsale = await ethers.getContractFactory('AllowanceCrowdsale')
    allowanceCrowdsale = await AllowanceCrowdsale.deploy(
      tokenVault.address,
      treasuryWallet.address,
      tokeHoldingWallet.address,
      membershipContract.address,
      acceptedStablecoins,
    )
    await allowanceCrowdsale.deployed()
    tokenVault.connect(tokeHoldingWallet).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)

    mockUSDC.connect(user1).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)

    mockUSDC.connect(user2).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
    mockUSDC.connect(user3).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)

    mockUSDT.connect(user1).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)

    mockUSDT.connect(user2).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
    mockUSDT.connect(user3).approve(allowanceCrowdsale.address, ethers.constants.MaxUint256)
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

      // describe('BKLN supply', () => {
      //   it('sells BKLN tokens when there is sufficient supply', async () => {
      //     await allowanceCrowdsale
      //       .connect(user1)
      //       .buyTokens(
      //         utils.parseUnits('400', decimals),
      //         0,
      //         treeSingle.getHexProof(user1.address),
      //         true,
      //         constants.AddressZero,
      //         {
      //           value: calculateEthRate(ethUSDPrice).mul(utils.parseUnits('400', decimals)),
      //         },
      //       )
      //   })

      //   it('fails to sell BKLN tokens when there is insufficient supply', async () => {
      //     await expect(
      //       allowanceCrowdsale
      //         .connect(user1)
      //         .buyTokens(
      //           tokenSupply.add(utils.parseUnits('400', decimals)),
      //           2,
      //           treeExceedingSupply.getHexProof(user3.address),
      //           true,
      //           constants.AddressZero,
      //           {
      //             value: calculateEthRate(ethUSDPrice).mul(tokenSupply.add(utils.parseUnits('400', decimals))),
      //           },
      //         ),
      //     ).to.be.revertedWith('ERC20: transfer amount exceeds balance')
      //   })
      // })

      // describe('accepting payment with different currencies', () => {
      //   it('accepts payments in USDC', async () => {
      //     const quantity = utils.parseUnits('400', decimals)
      //     await allowanceCrowdsale
      //       .connect(user1)
      //       .buyTokens(quantity, 0, treeSingle.getHexProof(user1.address), false, mockUSDC.address)
      //     expect(await tokenVault.balanceOf(user1.address)).to.be.equal(quantity)
      //     expect(await mockUSDC.balanceOf(treasuryWallet.address)).to.be.equal(quantity.mul(rate))
      //   })

      //   it('accepts payments in USDT', async () => {
      //     const quantity = utils.parseUnits('400', decimals)
      //     await allowanceCrowdsale
      //       .connect(user1)
      //       .buyTokens(quantity, 0, treeSingle.getHexProof(user1.address), false, mockUSDT.address)
      //     expect(await tokenVault.balanceOf(user1.address)).to.be.equal(quantity)
      //     expect(await mockUSDT.balanceOf(treasuryWallet.address)).to.be.equal(quantity.mul(rate))
      //   })
      // })
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
