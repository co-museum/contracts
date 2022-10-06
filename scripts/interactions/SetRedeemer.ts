import { ethers } from 'hardhat'
import * as cfg from '../config'
import * as utils from '../../utils/deployment'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const membershipNFT = await ethers.getContractAt(
    cfg.ContractName.membership,
    utils.assertDefined(addressCfg.ERC721MembershipUpgradeable),
  )

  const crowdsale = await ethers.getContractAt(
    cfg.ContractName.crowdsale,
    utils.assertDefined(addressCfg.AllowanceCrowdsale),
  )

  const tx = await membershipNFT.connect(signer).setRedeemer(crowdsale.address)
  await tx.wait()
  utils.printTx('set crowdsale details in memberhsip', tx.hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
