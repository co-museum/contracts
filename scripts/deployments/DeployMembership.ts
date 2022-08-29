import { ethers } from 'hardhat'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const tokenVaultCfg = cfg.TokenVaultConfig.check(cfg.loadConfig(cfg.ConfigEnv.tokenVault))
  const membershipCfg = cfg.MembershipConfig.check(cfg.loadConfig(cfg.ConfigEnv.membership))
  // careful with default args here
  const membership = await utils.deployMembership(
    addressCfg.TokenVault!,
    undefined, // always deploy a new one
    membershipCfg.name,
    membershipCfg.symbol,
    membershipCfg.genesisEnd,
    membershipCfg.foundationEnd,
    membershipCfg.friendEnd,
    ethers.utils.parseUnits(membershipCfg.genesisPrice.toString(), tokenVaultCfg.decimals),
    ethers.utils.parseUnits(membershipCfg.foundationPrice.toString(), tokenVaultCfg.decimals),
    ethers.utils.parseUnits(membershipCfg.friendPrice.toString(), tokenVaultCfg.decimals),
  )
  addressCfg.ERC721MembershipUpgradeable = membership.address
  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
