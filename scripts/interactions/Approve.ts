import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const tokenVault = await ethers.getContractAt(
    cfg.ContractName.tokenVault,
    utils.assertDefined(addressCfg.TokenVault, 'token vault undefined'),
  )

  const [signer] = await ethers.getSigners()
  const tokenHolder = addressCfg.tokenHolder ? ethers.provider.getSigner(addressCfg.tokenHolder) : signer
  const nonceTokenHolder = new NonceManager(tokenHolder)

  let tx = await tokenVault
    .connect(nonceTokenHolder)
    .approve(
      utils.assertDefined(addressCfg.ERC721MembershipUpgradeable, 'membership address undefined'),
      ethers.constants.MaxUint256,
    )
  utils.printTx('token holder approves membership', tx.hash, utils.txType.tx)
  tx = await tokenVault
    .connect(nonceTokenHolder)
    .approve(
      utils.assertDefined(addressCfg.AllowanceCrowdsale, 'crowdsale address undefined'),
      ethers.constants.MaxUint256,
    )
  utils.printTx('token holder approves crowdsale', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
