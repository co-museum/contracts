import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as dotenv from 'dotenv'
import { assertDefined } from '../../utils/deployment'

dotenv.config()

async function main() {
  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)

  const membership = await ethers.getContractAt(
    cfg.ContractName.membership,
    assertDefined(addressCfg.ERC721MembershipUpgradeable, 'membership undefined'),
  )
  console.log('genesis tier details:', await membership.genesisTier())
  console.log('foundation tier details:', await membership.foundationTier())
  console.log('friend tier details:', await membership.friendTier())
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
