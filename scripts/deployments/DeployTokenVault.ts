import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'
import * as utils from '../../utils/deployment'
import * as cfg from '../config'
import * as dotenv from 'dotenv'
import { IERC20 } from '../../typechain'

dotenv.config()

// never really changes
const tokenVaultDecimals = 6

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)

  const addressCfg: cfg.AddressConfig = cfg.loadConfig(cfg.ConfigEnv.address)
  const tokenVaultCfg: cfg.TokenVaultConfig = cfg.loadConfig(cfg.ConfigEnv.tokenVault)

  // don't need to know anything about the abi - we just need the address
  const usdc = new ethers.Contract(addressCfg.usdcAddress!, []) as IERC20
  const artNFT = await ethers.getContractAt(cfg.ContractName.artNFT, addressCfg.ERC721ArtNFT!)
  const vaultFactory = await ethers.getContractAt(cfg.ContractName.vaultFactory, addressCfg.ERC721VaultFactory!)
  const tokenVault = await utils.deployTokenVault(
    usdc,
    artNFT,
    tokenVaultCfg.artId,
    vaultFactory,
    tokenVaultCfg.name,
    tokenVaultCfg.symbol,
    ethers.utils.parseUnits(tokenVaultCfg.tokenSupply.toString(), tokenVaultDecimals),
    ethers.utils.parseUnits(tokenVaultCfg.initialPrice.toString(), tokenVaultDecimals),
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
