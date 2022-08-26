import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const nftCofg: cfg.NFTConfig = cfg.loadConfig(cfg.ConfigEnv.artNFT)
  const membershipNFT = await ethers.getContractAt(cfg.ContractName.membership, addressCfg.ERC721MembershipUpgradeable!)

  const tokenBaseURI = nftCofg.membershipNFTBaseURI
  const tx = await membershipNFT.connect(signer).setBaseURI(tokenBaseURI!)
  utils.printTx('set base URI', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
