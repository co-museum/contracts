import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'
import { IERC20 } from '../../typechain'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const tokenVaultCfg: cfg.TokenVaultConfig = cfg.loadConfig(cfg.ConfigEnv.tokenVault)

  const tokenVault = await utils.deployTokenVault(
    addressCfg.usdcAddress!,
    addressCfg.ERC721ArtNFT!,
    tokenVaultCfg.artId,
    addressCfg.ERC721VaultFactory!,
    tokenVaultCfg.name,
    tokenVaultCfg.symbol,
    ethers.utils.parseUnits(tokenVaultCfg.tokenSupply.toString(), tokenVaultCfg.decimals),
    ethers.utils.parseUnits(tokenVaultCfg.initialPrice.toString(), tokenVaultCfg.decimals),
    tokenVaultCfg.fee,
    nonceSigner,
  )
  // default to singer as the token holder
  const holder = addressCfg.tokenHolder ? addressCfg.tokenHolder : signer.address
  if (holder != signer.address) {
    await tokenVault.connect(nonceSigner).transfer(holder, tokenVaultCfg.tokenSupply)
  }

  addressCfg.TokenVault = tokenVault.address
  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
