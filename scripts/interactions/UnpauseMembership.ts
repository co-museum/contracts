import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const membership = await ethers.getContractAt(cfg.ContractName.membership, addressCfg.ERC721MembershipUpgradeable!)

  await membership.connect(nonceSigner).unpause()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
