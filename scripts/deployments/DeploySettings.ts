import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const settingsCfg: cfg.SettingsConfig = cfg.loadConfig(cfg.ConfigEnv.settings)
  const settings = await utils.deploySettings(nonceSigner)
  addressCfg.Settings = settings.address
  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
  
  await settings.connect(nonceSigner).setMinReserveFactor(settingsCfg.minReserveFactor)
  await settings.connect(nonceSigner).setMaxReserveFactor(settingsCfg.maxReserveFactor)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
