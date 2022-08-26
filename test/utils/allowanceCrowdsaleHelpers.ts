import { utils, constants, BigNumber } from 'ethers'
import { calculateEthRate } from '../../utils/crowdsale'
import { expect } from 'chai'
import { AllowanceCrowdsale, ERC721MembershipUpgradeable, TokenVault, IERC20 } from '../../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { MerkleTree } from 'merkletreejs'
import { Console } from 'console'

enum Tier {
  Genesis = 0,
  Foundation = 1,
  Friend = 2,
}

export async function testSuccessfulNFTSaleWithEth(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  nftNum: number,
  whitelistIdx: number,
  tree: MerkleTree,
  ethValue: BigNumber,
  treasuryWallet: SignerWithAddress,
  membershipContract: ERC721MembershipUpgradeable,
) {
  const priorUserBalance = await user.getBalance()
  const treasuryWalletBalance = await treasuryWallet.getBalance()
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyNFTs(nftNum, whitelistIdx, tree.getHexProof(user.address), true, constants.AddressZero, {
        value: ethValue,
      }),
  ).to.not.be.reverted
  expect(await membershipContract.balanceOf(user.address)).to.be.equal(nftNum)
  const newUserBalance = await user.getBalance()
  expect(newUserBalance.lt(priorUserBalance)).to.be.true
  expect((await treasuryWallet.getBalance()).eq(treasuryWalletBalance.add(ethValue))).to.be.true
}

export async function testUnsuccessfulNFTSaleWithEth(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  nftNum: number,
  whitelistIdx: number,
  tree: MerkleTree,
  ethValue: BigNumber,
  membershipContract: ERC721MembershipUpgradeable,
  treasuryWallet: SignerWithAddress,
  revertMessage: string,
) {
  const treasuryWalletBalance = await treasuryWallet.getBalance()
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyNFTs(nftNum, whitelistIdx, tree.getHexProof(user.address), true, constants.AddressZero, {
        value: ethValue,
      }),
  ).to.be.revertedWith(revertMessage)
  const newTreasuryWalletBalance = await treasuryWallet.getBalance()
  expect(treasuryWalletBalance).to.be.equal(newTreasuryWalletBalance)
  expect(await membershipContract.balanceOf(user.address)).to.be.equal(0)
}

export async function testSuccessfulNFTSaleWithStableCoin(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  nftNum: number,
  whitelistIdx: number,
  tree: MerkleTree,
  stablecoin: IERC20,
  treasuryWallet: SignerWithAddress,
  membershipContract: ERC721MembershipUpgradeable,
  priceInStablecoin: BigNumber,
) {
  const previousNFTBalance = await membershipContract.balanceOf(user.address)
  const previousTreasuryBalance = await stablecoin.balanceOf(treasuryWallet.address)
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyNFTs(nftNum, whitelistIdx, tree.getHexProof(user.address), false, stablecoin.address),
  ).to.not.be.reverted

  expect(await stablecoin.balanceOf(treasuryWallet.address)).to.be.equal(previousTreasuryBalance.add(priceInStablecoin))
  expect(await membershipContract.balanceOf(user.address)).to.be.equal(previousNFTBalance.add(nftNum))
}

export async function testUnsuccessfulNFTSaleWithStableCoin(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  nftNum: number,
  whitelistIdx: number,
  tree: MerkleTree,
  stablecoin: IERC20,
  treasuryWallet: SignerWithAddress,
  membershipContract: ERC721MembershipUpgradeable,
  revertMessage: string,
) {
  const previousNFTBalance = await membershipContract.balanceOf(user.address)
  const previousStablecoinBalance = await stablecoin.balanceOf(treasuryWallet.address)
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyNFTs(nftNum, whitelistIdx, tree.getHexProof(user.address), false, stablecoin.address),
  ).to.be.revertedWith(revertMessage)

  expect(await membershipContract.balanceOf(user.address)).to.be.equal(previousNFTBalance)
  expect(await stablecoin.balanceOf(treasuryWallet.address)).to.be.equal(previousStablecoinBalance)
}

export async function startSaleAndSetRate(
  allowanceCrowdsale: AllowanceCrowdsale,
  ethUSDPrice: number,
  decimals: number,
  tokenSupply: BigNumber,
  rootSingle: string,
  rootDouble: string,
  rootExceedingSupply: string,
  rootFoundation: string,
) {
  await allowanceCrowdsale.setRates(1, calculateEthRate(ethUSDPrice))
  await startSale(
    allowanceCrowdsale,
    decimals,
    tokenSupply,
    rootSingle,
    rootDouble,
    rootExceedingSupply,
    rootFoundation,
  )
}

export async function startSale(
  allowanceCrowdsale: AllowanceCrowdsale,
  decimals: number,
  tokenSupply: BigNumber,
  rootSingle: string,
  rootDouble: string,
  rootExceedingSupply: string,
  rootFoundation: string,
) {
  await allowanceCrowdsale.startSale(
    [Tier.Friend, Tier.Friend, Tier.Friend, Tier.Foundation],
    [
      utils.parseUnits('400', decimals),
      utils.parseUnits('800', decimals),
      tokenSupply.add(utils.parseUnits('400', decimals)),
      utils.parseUnits('4000', decimals),
    ],
    [rootSingle, rootDouble, rootExceedingSupply, rootFoundation],
  )
}

export function findWhiteListArrIdx(whiteListArr: string[][], address: string): number {
  for (var counter: number = 0; counter < whiteListArr.length; counter++) {
    if (whiteListArr[counter].includes(address)) {
      return counter
    }
  }
  return -1
}
