import { BigNumberish, BytesLike } from 'ethers'
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// TODO: figure out how to enforce mandatory configs

export function loadConfig(envVar: ConfigEnv): any {
  // require assumes path is relative to script and we want relative to cwd
  const fileName = resolve(process.env[envVar]!)
  console.log(`loading config from: ${fileName}`)
  if (existsSync(fileName)) {
    return require(fileName)
  } else {
    return {}
  }
}

export function saveConfig(envVar: ConfigEnv, data: any): void {
  // relative paths are fine here but for visual consistency convert to absolute
  const fileName = resolve(process.env[envVar]!)
  console.log(`saving config to: ${fileName}`)
  writeFileSync(fileName, JSON.stringify(data, undefined, 2))
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
  tokenVault = 'COMUCFG_TOKEN_VAULT',
  membership = 'COMUCFG_MEMBERSHIP',
}

export interface AddressConfig {
  [ContractName.settings]?: string
  [ContractName.vaultFactory]?: string
  [ContractName.artNFT]?: string
  [ContractName.tokenVault]?: string
  [ContractName.membership]?: string
  [ContractName.crowdsale]?: string
  tokenHolder?: string
  treasuryWallet?: string
  usdcAddress?: string
  usdtAddress?: string
}

export interface StartSaleConfig {
  tierCodes: BigNumberish[]
  roots?: BytesLike[]
  // converted to roots
  addresses?: string[][]
  // parsed internally
  allocations: number[]
}

export interface SettingsConfig {
  minReserveFactor: BigNumberish
  maxReserveFactor: BigNumberish
}

export interface PartiallyPauseConfig {
  contractName: ContractName
}

export interface SetRateConfig {
  ethUSDPrice: number
  stablecoinRate: number
}

export interface EscrowConfig {
  tokenIds: BigNumberish[]
  timestamps?: BigNumberish[]
}

export interface TokenVaultConfig {
  artId: BigNumberish
  name: string
  symbol: string
  fee: BigNumberish
  decimals: number
  // parsed in script
  tokenSupply: number
  initialPrice: number
}

export interface MembershipConfig {
  name: string
  symbol: string
  friendEnd: BigNumberish
  foundationEnd: BigNumberish
  genesisEnd: BigNumberish
  // parsed in script
  friendPrice: number
  foundationPrice: number
  genesisPrice: number
}
