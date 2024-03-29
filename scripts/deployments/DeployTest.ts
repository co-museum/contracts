import { ethers } from 'hardhat'
import * as utils from '../../utils/deployment'

const stablecoinDecimals = 6
const mockArtId = 0
// NOTE: we assume stablecoin.decimals() == artToken.decimals() in contracts
const artSupply = ethers.utils.parseUnits('4000000', stablecoinDecimals)
const artPrice = artSupply // 1 ART == 1 USDC/USDT
const artFee = 0 // no inflation
const genesisEnd = 15
const foundationEnd = genesisEnd + 200
const friendEnd = foundationEnd + 3500

async function main() {
  const [signer, treasury, tokenHolder, user] = await ethers.getSigners()

  const honoraryMembership = await utils.deployHonoraryMembership(signer.address)
  console.log(`honorary Membership: ${honoraryMembership.address}`)

  const mockUSDC = await utils.deployERC20Mock(
    user.address,
    'USD Coin',
    'USDC',
    ethers.utils.parseUnits('55000000000', stablecoinDecimals),
    stablecoinDecimals,
  )
  console.log(`USDC: ${mockUSDC.address}`)

  const mockUSDT = await utils.deployERC20Mock(
    user.address,
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

  const vaultFactory = await utils.deployVaultFactory(settings.address)
  console.log(`vault factory: ${vaultFactory.address}`)

  const mockArtNFT = await utils.deployERC721Mock('Art NFT', 'ARTN')
  await mockArtNFT.mint(signer.address, mockArtId)
  // NOTE: needs to happen before mint
  await mockArtNFT.approve(vaultFactory.address, mockArtId)
  console.log(`art NFT: ${mockArtNFT.address}`)

  const artToken = await utils.deployTokenVault(
    mockUSDC.address,
    mockArtNFT.address,
    mockArtId,
    vaultFactory.address,
    'Art',
    'ART',
    artSupply,
    artPrice,
    artFee,
  )
  await artToken.transfer(tokenHolder.address, artSupply)
  console.log(`art token: ${artToken.address}`)

  const voteDelegator = await utils.deployVoteDelegator(artToken.address)

  const membership = await utils.deployMembership(
    artToken.address,
    voteDelegator.address,
    'Art Membership',
    'ARTM',
    genesisEnd,
    foundationEnd,
    friendEnd,
  )
  console.log(`art membership: ${membership.address}`)

  const crowdsale = await utils.deployAllowanceCrowdsale(
    artToken.address,
    treasury.address,
    tokenHolder.address,
    membership.address,
    [mockUSDC.address, mockUSDT.address],
  )

  // NOTE: crowdsale transfers tokens through membership
  await artToken.connect(tokenHolder).approve(membership.address, artSupply)
  await artToken.connect(tokenHolder).approve(crowdsale.address, artSupply)

  // NOTE: crowdsale transfers tokens through membership
  await membership.addSender(membership.address)
  await artToken.addSender(crowdsale.address)
  await artToken.addSender(membership.address)

  await membership.pause()
  await artToken.pause()

  membership.setRedeemer(crowdsale.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
