import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as cfg from '../config'
import * as dotenv from 'dotenv'
import * as utils from '../../utils/deployment'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const tokenVault = await ethers.getContractAt(
    cfg.ContractName.tokenVault,
    utils.assertDefined(addressCfg.TokenVault, 'token vault address undefined'),
  )
  await tokenVault.connect(nonceSigner).unpause()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
