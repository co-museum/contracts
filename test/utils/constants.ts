import { ethers } from 'hardhat'
import { utils, constants, BigNumber } from 'ethers'
import { calculateEthRate } from '../../utils/crowdsale'

export const stablecoinTokenRate = 1
export const decimals = 6
export const ethUSDPrice = 1000
export const tokenSupply = ethers.utils.parseUnits('4000000', decimals)
export const totalSupplyOfMockUSDC = utils.parseUnits('9000000', decimals)
export const totalSupplyOfMockUSDT = utils.parseUnits('9000000', decimals)
export const friendTokenAmount = utils.parseUnits('400', decimals)
export const ethValueForFriendAmount = calculateEthRate(ethUSDPrice).mul(friendTokenAmount)
export const revertMessageCrowdsaleNotOpen = 'crowdsale:not open'
export const revertMessageERC20Balance = 'ERC20: transfer amount exceeds balance'
export const revertMessageNotEnoughEth = 'crowdsale:not enough eth'
export const revertMessageEthRate = 'crowdsale:ethRate <= 0'
export const revertMessageStablecoinRate = 'crowdsale:stablecoinRate <= 0'
export const revertMessageTransferExceedsBalance = 'ERC20: transfer amount exceeds balance'
export const revertMessageDiscrete = 'crowdsale:must purchase tokens in discrete quantities based on allocation'
export const revertMessageUserClaimedAllocation = 'crowdsale:user has already claimed allocation'
export const revertMessageNoPermissionToSend = 'No permission to send'
export const revertMessageRunsOutOfNFTs = 'membership:cannot mint more tokens at tier'
export const numNFTsOne = 1
export const numNFTsTwo = 2
