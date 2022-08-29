import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

// everything hardcoded here since it's unlikely to change
const stablecoinDecimals = 6

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const mockUSDC = await utils.deployERC20Mock(
    signer.address,
    'USD Coin',
    'USDC',
    ethers.utils.parseUnits('55000000000', stablecoinDecimals),
    stablecoinDecimals,
    nonceSigner,
  )
  const mockUSDT = await utils.deployERC20Mock(
    signer.address,
    'USD Tether',
    'USDT',
    ethers.utils.parseUnits('66000000000', stablecoinDecimals),
    stablecoinDecimals,
    nonceSigner,
  )

  addressCfg.usdcAddress = mockUSDC.address
  addressCfg.usdtAddress = mockUSDT.address
  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
