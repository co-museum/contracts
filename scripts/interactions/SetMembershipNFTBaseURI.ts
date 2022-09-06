import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const nftCofg = cfg.MembershipConfig.check(cfg.loadConfig(cfg.ConfigEnv.membership))
  const membershipNFT = await ethers.getContractAt(
    cfg.ContractName.membership,
    utils.assertDefined(addressCfg.ERC721MembershipUpgradeable),
  )

  const tokenBaseURI = nftCofg.membershipNFTBaseURI
  const tx = await membershipNFT.connect(signer).setBaseURI(tokenBaseURI)
  await tx.wait()
  utils.printTx('set base URI', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
