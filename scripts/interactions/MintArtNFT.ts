import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const tokenVaultCfg: cfg.TokenVaultConfig = cfg.loadConfig(cfg.ConfigEnv.tokenVault)

  const artNFT = await ethers.getContractAt(cfg.ContractName.artNFT, addressCfg.ERC721ArtNFT!)
  const tx = await artNFT.connect(nonceSigner).mint(signer.address)
  const receipt = await tx.wait()
  const [mintEvent] = receipt.events!.filter((event, i, arr) => event.event == 'Transfer')
  const tokenId = mintEvent.args!['tokenId']
  tokenVaultCfg.artId = tokenId
  await artNFT.connect(nonceSigner).approve(addressCfg.ERC721VaultFactory!, tokenId)

  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
  cfg.saveConfig(cfg.ConfigEnv.tokenVault, tokenVaultCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
