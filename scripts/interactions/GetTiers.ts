import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  //   const [signer] = await ethers.getSigners()
  //   const nonceSigner = new NonceManager(signer)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const tokenVaultCfg: cfg.TokenVaultConfig = cfg.loadConfig(cfg.ConfigEnv.tokenVault)

  const membership = await ethers.getContractAt(cfg.ContractName.membership, addressCfg.ERC721MembershipUpgradeable!)
  const arr = membership.genesisTier
  console.log(await arr())
  const arr1 = membership.foundationTier
  console.log(await arr1())
  const arr2 = membership.friendTier
  console.log(await arr2())

  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
  cfg.saveConfig(cfg.ConfigEnv.tokenVault, tokenVaultCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
