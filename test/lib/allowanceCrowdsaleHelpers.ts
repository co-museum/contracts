import { utils, constants, BigNumber } from 'ethers'
import { calculateEthRate } from '../../utils/crowdsale'
import { expect } from 'chai'
import { AllowanceCrowdsale, ERC721MembershipUpgradeable, TokenVault, IERC20 } from '../../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { MerkleTree } from 'merkletreejs'

// 1. Token sale with ETH
export async function testSuccessfulTokenSaleWithEth(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  tokenAmount: BigNumber,
  whiteListIdx: number,
  tree: MerkleTree,
  ethValue: BigNumber,
  tokenVault: TokenVault,
  treasuryWallet: SignerWithAddress,
) {
  const treasuryWalletBalance = await treasuryWallet.getBalance()
  const priorUserBalance = await user.getBalance()
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyTokens(tokenAmount, whiteListIdx, tree.getHexProof(user.address), true, constants.AddressZero, {
        value: ethValue,
      }),
  ).to.not.be.reverted
  expect(await tokenVault.balanceOf(user.address)).to.be.equal(tokenAmount)
  const newUserBalance = await user.getBalance()
  expect(newUserBalance.lt(priorUserBalance)).to.be.true
  expect((await treasuryWallet.getBalance()).eq(treasuryWalletBalance.add(ethValue))).to.be.true
}

export async function testUnsuccessfulTokenSaleWithEth(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  tokenAmount: BigNumber,
  whiteListIdx: number,
  tree: MerkleTree,
  ethValue: BigNumber,
  tokenVault: TokenVault,
  treasuryWallet: SignerWithAddress,
  revertMessage: string,
) {
  const treasuryWalletBalance = await treasuryWallet.getBalance()
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyTokens(tokenAmount, whiteListIdx, tree.getHexProof(user.address), true, constants.AddressZero, {
        value: ethValue,
      }),
  ).to.be.revertedWith(revertMessage)
  expect(await tokenVault.balanceOf(user.address)).to.be.equal(0)
  expect((await treasuryWallet.getBalance()).eq(treasuryWalletBalance)).to.be.true
}

// 2. NFT sale with ETH
export async function testUnsuccessfulNFTSaleWithEth(
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
export async function testSuccessfulTokenSaleWithStableCoin(
  allowanceCrowdsale: AllowanceCrowdsale,
  tokenAmount: BigNumber,
  whitelistIdx: number,
  user: SignerWithAddress,
  tree: MerkleTree,
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

export async function testUnsuccessfulTokenSaleWithStableCoin(
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
export async function testUnsuccessfulNFTSaleWithStableCoin(
  allowanceCrowdsale: AllowanceCrowdsale,
  user: SignerWithAddress,
  nftNum: number,
  whiteListIdx: number,
  tree: MerkleTree,
  stablecoin: IERC20,
  treasuryWallet: SignerWithAddress,
  tokenVault: TokenVault,
  revertMessage: string,
) {
  await expect(
    allowanceCrowdsale
      .connect(user)
      .buyNFTs(nftNum, whiteListIdx, tree.getHexProof(user.address), false, stablecoin.address),
  ).to.be.revertedWith(revertMessage)

  expect(await stablecoin.balanceOf(treasuryWallet.address)).to.be.equal(0)
  expect(await tokenVault.balanceOf(user.address)).to.be.equal(0)
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
    [2, 2, 2, 1],
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
