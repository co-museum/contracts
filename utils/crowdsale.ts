import { BigNumberish, BigNumber } from 'ethers'
import { ethers } from 'hardhat'

const ethDecimals = 18

export function calculateEthRate(ethUSDPrice = 1000, artDecimals = 6, stablecoinRate = 1): BigNumber {
  return ethers.BigNumber.from(10)
    .pow(ethDecimals - artDecimals)
    .div(ethUSDPrice)
    .mul(stablecoinRate)
}
