import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const tokenVault = await ethers.getContractAt(cfg.ContractName.tokenVault, addressCfg.TokenVault!)
  const membership = await ethers.getContractAt(cfg.ContractName.membership, addressCfg.ERC721MembershipUpgradeable!)

  // NOTE: crowdsale transfers tokens through membership
  let tx = await membership.connect(nonceSigner).addSender(membership.address)
  utils.printTx('add membership sender to membership', tx.hash, utils.txType.tx)
  tx = await tokenVault.connect(nonceSigner).addSender(addressCfg.AllowanceCrowdsale!)
  utils.printTx('add crowdsale sender to token vault', tx.hash, utils.txType.tx)
  tx = await tokenVault.connect(nonceSigner).addSender(membership.address)
  utils.printTx('add membership sender to token vault', tx.hash, utils.txType.tx)

  tx = await membership.connect(nonceSigner).pause()
  utils.printTx('pause membership', tx.hash, utils.txType.tx)
  tx = await tokenVault.connect(nonceSigner).pause()
  utils.printTx('pause token vault', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
