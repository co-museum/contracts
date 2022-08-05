import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import { calculateEthRate } from '../../utils/crowdsale'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const tokenVaultCfg: cfg.TokenVaultConfig = cfg.loadConfig(cfg.ConfigEnv.tokenVault)
  const setRateCfg: cfg.SetRateConfig = cfg.loadConfig(cfg.ConfigEnv.setRate)
  const crowdsale = await ethers.getContractAt(cfg.ContractName.crowdsale, addressCfg.AllowanceCrowdsale!)

  let tx = await crowdsale.setRates(
    setRateCfg.stablecoinRate,
    calculateEthRate(setRateCfg.ethUSDPrice, tokenVaultCfg.decimals, setRateCfg.stablecoinRate),
  )
  utils.printTx('set rates', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
