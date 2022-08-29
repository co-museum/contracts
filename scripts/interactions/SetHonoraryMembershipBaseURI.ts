import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const nftCofg = cfg.NFTConfig.check(cfg.loadConfig(cfg.ConfigEnv.nfts))
  const honoraryMembershipNFT = await ethers.getContractAt(
    cfg.ContractName.honoraryMembership,
    utils.assertDefined(addressCfg.ERC721HonoraryMembership, 'membership undefined'),
  )

  const tokenBaseURI = nftCofg.honoraryMembershipBaseURI
  const tx = await honoraryMembershipNFT.connect(signer).setBaseURI(tokenBaseURI)
  utils.printTx('set base URI', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
