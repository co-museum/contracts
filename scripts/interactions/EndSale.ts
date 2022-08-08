import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'
import MerkleTree from 'merkletreejs'

dotenv.config()

export function merkleRootFromAddresses(addresses: string[]): string {
  const leaves = addresses.map((address) => ethers.utils.keccak256(address))
  const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sort: true })
  return tree.getHexRoot()
}

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const crowdsale = await ethers.getContractAt('AllowanceCrowdsale', addressCfg.AllowanceCrowdsale!)

  const tx = await crowdsale.connect(nonceSigner).stopSale()
  utils.printTx('stop sale sale', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
