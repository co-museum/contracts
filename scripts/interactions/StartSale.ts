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

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const tokenVaultCfg = cfg.TokenVaultConfig.check(cfg.loadConfig(cfg.ConfigEnv.tokenVault))
  const startSaleCfg = cfg.StartSaleConfig.check(cfg.loadConfig(cfg.ConfigEnv.startSale))

  const crowdsale = await ethers.getContractAt(
    'AllowanceCrowdsale',
    utils.assertDefined(addressCfg.AllowanceCrowdsale, 'crowdsale address unedfined'),
  )
  const rootsFromAddresses = startSaleCfg.addresses?.map((addresses) => merkleRootFromAddresses(addresses))
  const roots = startSaleCfg.roots ? startSaleCfg.roots : []
  if (rootsFromAddresses) {
    roots.push(...rootsFromAddresses)
  }
  const allocations = startSaleCfg.allocations?.map((alloc) =>
    ethers.utils.parseUnits(alloc.toString(), tokenVaultCfg.decimals),
  )
  const tx = await crowdsale.connect(nonceSigner).startSale(startSaleCfg.tierCodes, allocations, roots)
  utils.printTx('start sale', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
