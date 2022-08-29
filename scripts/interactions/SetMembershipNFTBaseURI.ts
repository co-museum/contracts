import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const nftCofg = cfg.NFTConfig.check(cfg.loadConfig(cfg.ConfigEnv.nfts))
  const membershipNFT = await ethers.getContractAt(
    cfg.ContractName.membership,
    utils.assertDefined(addressCfg.ERC721MembershipUpgradeable, 'memebrship undefined'),
  )

  const tokenBaseURI = nftCofg.membershipNFTBaseURI

  const tx = await membershipNFT
    .connect(signer)
    .setBaseURI(utils.assertDefined(tokenBaseURI, 'membership token URI undefined'))
  await tx.wait()
  utils.printTx('set base URI', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
