import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import { calculateEthRate } from '../../utils/crowdsale'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const tokenVaultCfg = cfg.TokenVaultConfig.check(cfg.loadConfig(cfg.ConfigEnv.tokenVault))
  const setRateCfg = cfg.SetRateConfig.check(cfg.loadConfig(cfg.ConfigEnv.setRate))
  const crowdsale = await ethers.getContractAt(
    cfg.ContractName.crowdsale,
    utils.assertDefined(addressCfg.AllowanceCrowdsale, 'crowdsale address undefined'),
  )

  const tx = await crowdsale.setRates(
    setRateCfg.stablecoinRate,
    calculateEthRate(setRateCfg.ethUSDPrice, tokenVaultCfg.decimals, setRateCfg.stablecoinRate),
  )
  utils.printTx('set rates', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
