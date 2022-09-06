import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as dotenv from 'dotenv'
import { assertDefined } from '../../utils/deployment'

dotenv.config()

async function main() {
  const addressCfg: cfg.AddressConfig = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const membership = await ethers.getContractAt(
    cfg.ContractName.membership,
    assertDefined(addressCfg.ERC721MembershipUpgradeable),
  )

  const remainingNFTs = await membership.getTierNumRemainingNFTs()

  console.log('genesis remaining NFTs:', remainingNFTs.numGenesis)
  console.log('foundation remaining NFTs:', remainingNFTs.numFoundation)
  console.log('friend remaining NFTss:', remainingNFTs.numFriend)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
