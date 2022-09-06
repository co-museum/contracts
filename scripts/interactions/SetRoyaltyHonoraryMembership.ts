import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const nftCofg = cfg.MembershipConfig.check(cfg.loadConfig(cfg.ConfigEnv.membership))
  const honoraryMembershipNFT = await ethers.getContractAt(cfg.ContractName.honoraryMembership, utils.assertDefined(addressCfg.))

  const tx = await honoraryMembershipNFT
    .connect(signer)
    .setDefaultRoyalty(utils.assertDefined(nftCofg.royaltyRecieveingAddress), utils.assertDefined(nftCofg.royalty))
  utils.printTx('set royalty honorary membership NFT', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
