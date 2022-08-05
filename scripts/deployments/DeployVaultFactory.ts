import { ethers } from 'hardhat'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const Settings = await ethers.getContractAt(cfg.ContractName.settings, addressCfg.Settings!)
  const vaultFactory = await utils.deployVaultFactory(Settings)
  addressCfg.ERC721VaultFactory = vaultFactory.address
  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
