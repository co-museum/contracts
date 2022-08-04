import { BigNumberish, BytesLike } from 'ethers'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

export function loadConfig(envVar: ConfigEnv): any {
  // require assumes relative to script and we want relative to cwd
  const fileName = resolve(process.env[envVar]!)
  console.log(`loading config from ${fileName}`)
  return require(fileName)
}

export function saveConfig(envVar: ConfigEnv, data: any): void {
  writeFileSync(process.env[envVar]!, JSON.stringify(data, undefined, 2))
}

export enum ContractName {
  settings = 'Settings',
  vaultFactory = 'ERC721VaultFactory',
  artNFT = 'ERC721ArtNFT',
  tokenVault = 'TokenVault',
  membership = 'ERC721MembershipUpgradeable',
  crowdsale = 'AllowanceCrowdsale',
}

export enum ConfigEnv {
  address = 'COMUCFG_ADDRESS',
  settings = 'COMUCFG_SETTINGS',
  startSale = 'COMUCFG_START_SALE',
  partiallyPause = 'COMUCFG_PARTIALLY_PAUSE',
  setRate = 'COMUCFG_SET_RATE',
  escrow = 'COMUCFG_ESCROW',
}

export interface AddressConfig {
  [ContractName.settings]?: string
  [ContractName.vaultFactory]?: string
  [ContractName.artNFT]?: string
  [ContractName.tokenVault]?: string
  [ContractName.membership]?: string
  [ContractName.crowdsale]?: string
}

export interface StartSaleConfig {
  tierCodes: BigNumberish[]
  allocations: BigNumberish[]
  roots?: BytesLike[]
  // converted to roots
  addresses?: string[][]
}

export interface SettingsConfig {
  minReserveFactor: BigNumberish
  maxReserveFactor: BigNumberish
}

export interface PartiallyPauseConfig {
  contractName: ContractName
}

export interface SetRateConfig {
  ethRate: BigNumberish
  stablecoinRate: BigNumberish
}

export interface EscrowConfig {
  tokenIds: BigNumberish[]
  timestamps?: BigNumberish[]
}
