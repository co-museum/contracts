import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'
import MerkleTree from 'merkletreejs'

dotenv.config()

// localhost only
async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const startSaleCfg: cfg.StartSaleConfig = cfg.loadConfig(cfg.ConfigEnv.startSale)
  const crowdsale = await ethers.getContractAt(cfg.ContractName.crowdsale, addressCfg.AllowanceCrowdsale!)

  const whitelistIdx = 0
  const userIdx = 0
  const userAddress = startSaleCfg.addresses![whitelistIdx][userIdx]
  const leaves = startSaleCfg.addresses![whitelistIdx].map((address) => ethers.utils.keccak256(address))
  const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sort: true })
  const proof = tree.getHexProof(userAddress)
  const numNFTs = 1
  const user = ethers.provider.getSigner(userAddress)
  const tx = await crowdsale
    .connect(user)
    .buyNFTs(numNFTs, whitelistIdx, proof, true, ethers.constants.AddressZero, { gasLimit: 50000 })
  utils.printTx('buy NFT', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
