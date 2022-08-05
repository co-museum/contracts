import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const tokenVault = await ethers.getContractAt(cfg.ContractName.tokenVault, addressCfg.TokenVault!)

  const [signer] = await ethers.getSigners()
  const tokenHolder = addressCfg.tokenHolder ? ethers.provider.getSigner(addressCfg.tokenHolder) : signer
  const nonceTokenHolder = new NonceManager(tokenHolder)

  let tx = await tokenVault
    .connect(nonceTokenHolder)
    .approve(addressCfg.ERC721MembershipUpgradeable!, ethers.constants.MaxUint256)
  utils.printTx('token holder approves membership', tx.hash, utils.txType.tx)
  tx = await tokenVault.connect(nonceTokenHolder).approve(addressCfg.AllowanceCrowdsale!, ethers.constants.MaxUint256)
  utils.printTx('token holder approves crowdsale', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
