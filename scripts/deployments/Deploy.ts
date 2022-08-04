import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
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
  const [signer, treasury, tokenHolder] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)
  const nonceTokenHolder = new NonceManager(tokenHolder)

  console.log('signer', signer.address)

  const mockUSDC = await utils.deployERC20Mock(
    signer,
    'USD Coin',
    'USDC',
    ethers.utils.parseUnits('55000000000', stablecoinDecimals),
    stablecoinDecimals,
  )

  console.log(`USDC: ${mockUSDC.address}`)

  const mockUSDT = await utils.deployERC20Mock(
    signer,
    'USD Tether',
    'USDT',
    ethers.utils.parseUnits('66000000000', stablecoinDecimals),
    stablecoinDecimals,
  )
  console.log(`USDT: ${mockUSDT.address}`)

  const settings = await utils.deploySettings(nonceSigner)
  await settings.connect(nonceSigner).setMinReserveFactor(750) // 75%
  await settings.connect(nonceSigner).setMaxReserveFactor(5000) // 500%
  console.log(`settings: ${settings.address}`)

  const vaultFactory = await utils.deployVaultFactory(settings, nonceSigner)
  console.log(`vault factory: ${vaultFactory.address}`)

  const artNFT = await utils.deployERC721ArtNFT(signer.address, nonceSigner)
  await artNFT.connect(nonceSigner).mint(signer.address)
  // NOTE: needs to happen before mint
  await artNFT.connect(nonceSigner).approve(vaultFactory.address, mockArtId)
  console.log(`art NFT: ${artNFT.address}`)

  // const artNFT = await utils.deployERC721Mock('Art NFT', 'ARTN')
  // await artNFT.mint(signer.address, mockArtId)
  // // NOTE: needs to happen before mint
  // await artNFT.approve(vaultFactory.address, mockArtId)
  // console.log(`art NFT: ${artNFT.address}`)

  const artToken = await utils.deployTokenVault(
    mockUSDC,
    artNFT,
    mockArtId,
    vaultFactory,
    'Art',
    'ART',
    artSupply,
    artPrice,
    artFee,
    nonceSigner,
  )
  await artToken.connect(nonceSigner).transfer(tokenHolder.address, artSupply)
  console.log(`art token: ${artToken.address}`)

  const voteDelegator = await utils.deployVoteDelegator(artToken, nonceSigner)
  console.log(`vote delegator: ${voteDelegator.address}`)

  const membership = await utils.deployMembership(
    artToken,
    voteDelegator,
    'Art Membership',
    'ARTM',
    genesisEnd,
    foundationEnd,
    friendEnd,
    nonceSigner,
  )
  console.log(`art membership: ${membership.address}`)

  const crowdsale = await utils.deployAllowanceCrowdsale(
    artToken,
    treasury,
    tokenHolder,
    membership,
    [mockUSDC, mockUSDT],
    nonceSigner,
  )
  console.log(`crowdsale: ${crowdsale.address}`)

  // NOTE: crowdsale transfers tokens through membership
  await artToken.connect(nonceTokenHolder).approve(membership.address, artSupply)
  await artToken.connect(nonceTokenHolder).approve(crowdsale.address, artSupply)
  console.log(`art token permissions sorted`)

  // NOTE: crowdsale transfers tokens through membership
  await membership.connect(nonceSigner).addSender(membership.address)
  await artToken.connect(nonceSigner).addSender(crowdsale.address)
  await artToken.connect(nonceSigner).addSender(membership.address)
  console.log(`senders added`)

  await membership.connect(nonceSigner).pause()
  await artToken.connect(nonceSigner).pause()
  console.log(`contracts paused`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
