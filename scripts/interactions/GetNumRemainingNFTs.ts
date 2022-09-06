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

  const remainingGenesisNFTs = await membership.getTierNumRemainingNFTs(0)
  const remainingFoundationNFTs = await membership.getTierNumRemainingNFTs(1)
  const remainingFriendNFTs = await membership.getTierNumRemainingNFTs(2)

  console.log('genesis remaining NFTs:', remainingGenesisNFTs)
  console.log('foundation remaining NFTs:', remainingFoundationNFTs)
  console.log('friend remaining NFTss:', remainingFriendNFTs)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
