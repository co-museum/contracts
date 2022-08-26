import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const nftCofg: cfg.NFTConfig = cfg.loadConfig(cfg.ConfigEnv.artNFT)
  const honoraryMembershipNFT = await ethers.getContractAt(
    cfg.ContractName.honoraryMembership,
    addressCfg.ERC721HonoraryMembership!,
  )

  const tokenBaseURI = nftCofg.honoraryMembershipBaseURI
  const tx = await honoraryMembershipNFT.connect(signer).setBaseURI(tokenBaseURI)
  utils.printTx('set base URI', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
