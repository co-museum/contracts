import { ethers } from 'hardhat'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const treasuryWallet = addressCfg.treasuryWallet ? addressCfg.treasuryWallet : signer.address
  const tokenHolder = addressCfg.tokenHolder ? addressCfg.tokenHolder : signer.address
  const crowdsale = await utils.deployAllowanceCrowdsale(
    utils.assertDefined(addressCfg.TokenVault, 'vault address undefined'),
    treasuryWallet,
    tokenHolder,
    utils.assertDefined(addressCfg.ERC721MembershipUpgradeable, 'membership address undefined'),
    [
      utils.assertDefined(addressCfg.usdcAddress, 'usdc address undefined'),
      utils.assertDefined(addressCfg.usdtAddress, 'usdt address undefined'),
    ],
  )
  addressCfg.AllowanceCrowdsale = crowdsale.address
  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
