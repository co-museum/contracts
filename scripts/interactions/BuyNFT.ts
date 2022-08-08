import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'
import MerkleTree from 'merkletreejs'
import { keccak256 } from 'ethers/lib/utils'
import { calculateEthRate } from '../../utils/crowdsale'
import { ERC721MembershipUpgradeable } from '../../typechain'

dotenv.config()

// localhost only
async function main() {
  const signers = await ethers.getSigners()
  console.log(signers.length)
  const signer = signers[7]
  const nonceSigner = new NonceManager(signer)
  console.log(signer.address)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const startSaleCfg: cfg.StartSaleConfig = cfg.loadConfig(cfg.ConfigEnv.startSale)
  const crowdsale = await ethers.getContractAt(cfg.ContractName.crowdsale, addressCfg.AllowanceCrowdsale!)
  console.log(startSaleCfg.addresses)

  const whitelistIdx = 0
  const userIdx = 0
  // const userAddress = startSaleCfg.addresses![whitelistIdx][userIdx]
  const leaves = startSaleCfg.addresses![whitelistIdx].map((address) => ethers.utils.keccak256(address))
  const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sort: true })
  const proof = tree.getHexProof(keccak256(signer.address))
  console.log(proof)
  const numNFTs = 1
  // const user = ethers.provider.getSigner(userAddress)

  const setRateCfg: cfg.SetRateConfig = cfg.loadConfig(cfg.ConfigEnv.setRate)
  const tokenVaultCfg: cfg.TokenVaultConfig = cfg.loadConfig(cfg.ConfigEnv.tokenVault)

  const ethRate = calculateEthRate(setRateCfg.ethUSDPrice, tokenVaultCfg.decimals, setRateCfg.stablecoinRate)
  const val = ethRate.mul(ethers.utils.parseUnits('400', 6))
  const tx = await crowdsale.connect(signer).buyNFTs(numNFTs, whitelistIdx, proof, true, ethers.constants.AddressZero, {
    // gasLimit: 500000,
    value: val,
  })
  utils.printTx('buy NFT', tx.hash, utils.txType.tx)

  // const membership = await ethers.getContractAt('ERC721MembershipUpgradeable', addressCfg.ERC721MembershipUpgradeable!)
  // console.log(await membership.ownerAddress())
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
