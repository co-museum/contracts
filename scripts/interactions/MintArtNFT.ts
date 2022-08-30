import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as cfg from '../config'
import * as dotenv from 'dotenv'
import * as utils from '../../utils/deployment'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const tokenVaultCfg = cfg.TokenVaultConfig.check(cfg.loadConfig(cfg.ConfigEnv.tokenVault))

  const artNFT = await ethers.getContractAt(cfg.ContractName.artNFT, utils.assertDefined(addressCfg.ERC721ArtNFT))
  const tx = await artNFT.connect(nonceSigner).mint(signer.address)
  utils.printTx('Minted NFT at txn', tx.hash)
  const receipt = await tx.wait()
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [mintEvent] = receipt.events!.filter((event) => event.event == 'Transfer')
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const tokenId = mintEvent.args!['tokenId']
  tokenVaultCfg.artId = tokenId
  await artNFT.connect(nonceSigner).approve(utils.assertDefined(addressCfg.ERC721VaultFactory), tokenId)

  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
  cfg.saveConfig(cfg.ConfigEnv.tokenVault, tokenVaultCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
