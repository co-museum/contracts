import { ethers } from 'hardhat'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const escrowCfg = cfg.EscrowConfig.check(cfg.loadConfig(cfg.ConfigEnv.escrow))
  const membership = await ethers.getContractAt(
    'ERC721MembershipUpgradeable',
    utils.assertDefined(addressCfg.ERC721MembershipUpgradeable),
  )
  const tx = await membership.connect(signer).removeEscrowReleaseTime(escrowCfg.tokenIds)
  utils.printTx('Escrow add release time for token IDs hash: ', (await tx).hash, utils.txType.tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
