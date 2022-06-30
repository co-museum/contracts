import { ethers } from 'hardhat'
import * as utils from '../utils/deployment'

const stablecoinDecimals = 6
const mockBanksyId = 0
// NOTE: we assum stablecoin.decimals() == banksyToken.decimals() in contracts
const banksySupply = ethers.utils.parseUnits('4000000', stablecoinDecimals)
const banksyPrice = banksySupply // 1 BKLN == 1 USDC/USDT
const banksyFee = 0 // no inflation
const genesisEnd = 15
const foundationEnd = genesisEnd + 200
const friendEnd = foundationEnd + 3500

async function main() {
  const [signer, treasury, tokenHolder, user] = await ethers.getSigners()

  const mockUSDC = await utils.deployERC20Mock(
    user,
    'USD Coin',
    'USDC',
    ethers.utils.parseUnits('55000000000', stablecoinDecimals),
    stablecoinDecimals,
  )
  console.log(`USDC: ${mockUSDC.address}`)

  const mockUSDT = await utils.deployERC20Mock(
    user,
    'USD Tether',
    'USDT',
    ethers.utils.parseUnits('66000000000', stablecoinDecimals),
    stablecoinDecimals,
  )
  console.log(`USDT: ${mockUSDT.address}`)

  const settings = await utils.deploySettings()
  await settings.setMinReserveFactor(750) // 75%
  await settings.setMaxReserveFactor(5000) // 500%
  console.log(`settings: ${settings.address}`)

  const vaultFactory = await utils.deployVaultFactory(settings)
  console.log(`vault factory: ${vaultFactory.address}`)

  const mockBanksyNFT = await utils.deployERC721Mock('Banksy Laugh Now Title Deed NFT', 'BKLNTD')
  await mockBanksyNFT.mint(signer.address, mockBanksyId)
  await mockBanksyNFT.approve(vaultFactory.address, mockBanksyId)
  console.log(`banksy NFT: ${mockBanksyNFT.address}`)

  const banksyToken = await utils.deployTokenVault(
    mockUSDC,
    mockBanksyNFT,
    mockBanksyId,
    vaultFactory,
    'Banksy Laugh Now',
    'BKLN',
    banksySupply,
    banksyPrice,
    banksyFee,
  )
  await banksyToken.transfer(tokenHolder.address, banksySupply)
  await banksyToken.pause()
  console.log(`banksy token: ${banksyToken.address}`)

  const voteDelegator = await utils.deployVoteDelegator(banksyToken)
  console.log(`vote delegator: ${voteDelegator.address}`)

  const membership = await utils.deployMembership(
    banksyToken,
    voteDelegator,
    'Banksy Laugh Now Membership',
    'BKLNM',
    genesisEnd,
    foundationEnd,
    friendEnd,
  )
  await banksyToken.connect(tokenHolder).approve(membership.address, banksySupply)
  await membership.pause()
  console.log(`banksy membership: ${membership.address}`)

  const crowdsale = await utils.deployAllowanceCrowdsale(banksyToken, treasury, tokenHolder, membership, [
    mockUSDC,
    mockUSDT,
  ])
  await banksyToken.connect(tokenHolder).approve(crowdsale.address, banksySupply)
  await banksyToken.addSender(crowdsale.address)
  await membership.addSender(crowdsale.address)
  console.log(`crowdsale: ${crowdsale.address}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
