import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg = cfg.AddressConfig.check(cfg.loadConfig(cfg.ConfigEnv.address))
  const tokenVaultCfg = cfg.TokenVaultConfig.check(cfg.loadConfig(cfg.ConfigEnv.tokenVault))

  const tokenVault = await utils.deployTokenVault(
    utils.assertDefined(addressCfg.usdcAddress, 'usdc address undefined'),
    utils.assertDefined(addressCfg.ERC721ArtNFT, 'art nft undefined'),
    tokenVaultCfg.artId,
    utils.assertDefined(addressCfg.ERC721VaultFactory, 'vault factory undefined'),
    tokenVaultCfg.name,
    tokenVaultCfg.symbol,
    ethers.utils.parseUnits(tokenVaultCfg.tokenSupply.toString(), tokenVaultCfg.decimals),
    ethers.utils.parseUnits(tokenVaultCfg.initialPrice.toString(), tokenVaultCfg.decimals),
    tokenVaultCfg.fee,
    nonceSigner,
  )
  // default to signer as the token holder
  if (addressCfg.tokenHolder !== undefined) {
    await tokenVault.connect(nonceSigner).transfer(addressCfg.tokenHolder, tokenVaultCfg.tokenSupply)
  }

  addressCfg.TokenVault = tokenVault.address
  cfg.saveConfig(cfg.ConfigEnv.address, addressCfg)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
