import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const nftCofg = cfg.MembershipConfig.check(cfg.loadConfig(cfg.ConfigEnv.membership))
  const artNFT = await ethers.getContractAt(cfg.ContractName.artNFT, utils.assertDefined(addressCfg.ERC721ArtNFT))

  const tx = await artNFT.connect(signer).setDefaultRoyalty(nftCofg.royaltyRecieveingAddress, nftCofg.royalty)
  utils.printTx('set royalty art NFT', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
