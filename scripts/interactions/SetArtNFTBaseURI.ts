import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const nftCofg = cfg.ArtNFTConfig.check(cfg.loadConfig(cfg.ConfigEnv.artNFT))
  const artNFT = await ethers.getContractAt(cfg.ContractName.artNFT, utils.assertDefined(addressCfg.ERC721ArtNFT))

  const tokenBaseURI = nftCofg.artNFTBaseURI
  const tx = await artNFT.connect(signer).setBaseURI(tokenBaseURI)
  utils.printTx('set base URI', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
