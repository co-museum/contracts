import { ethers } from 'hardhat'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  // give NFT to signer by default
  const artNFT = await utils.deployHonoraryMembership(signer.address)
  addressCfg.ERC721ArtNFT = artNFT.address
  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
