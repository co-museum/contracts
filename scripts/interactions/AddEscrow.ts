import { ethers } from 'hardhat'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const escrowAddCfg = cfg.EscrowConfig.check(cfg.loadConfig(cfg.ConfigEnv.escrow))
  const membership = await ethers.getContractAt('ERC721MembershipUpgradeable', addressCfg.ERC721MembershipUpgradeable!)
  const tx = membership.connect(signer).addEscrowReleaseTime(escrowAddCfg.tokenIds, escrowAddCfg.timestamps!)
  utils.printTx('Escrow add release time hash: ', (await tx).hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
