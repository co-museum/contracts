import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { Record, String, Number, Static, Array } from 'runtypes'
import { assertDefined } from '../utils/deployment'

// TODO: figure out how to enforce mandatory configs

export function loadConfig(envVar: ConfigEnv): unknown {
  // require assumes path is relative to script and we want relative to cwd
  const fileName = resolve(assertDefined(process.env[envVar], `environment variable '${envVar}' undefined`))
  console.log(`loading config from: ${fileName}`)
  if (existsSync(fileName)) {
    return require(fileName)
  } else {
    return {}
  }
}

export function saveConfig(envVar: ConfigEnv, data: unknown): void {
  // relative paths are fine here but for visual consistency convert to absolute
  const fileName = resolve(assertDefined(process.env[envVar], `environment variable '${envVar}' undefined`))
  console.log(`saving config to: ${fileName}`)
  writeFileSync(fileName, JSON.stringify(data, undefined, 2))
}

export enum ContractName {
  settings = 'Settings',
  vaultFactory = 'ERC721VaultFactory',
  artNFT = 'ERC721ArtNFT',
  tokenVault = 'TokenVault',
  membership = 'ERC721MembershipUpgradeable',
  honoraryMembership = 'ERC721HonoraryMembership',
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
  honoraryMembership = 'COMUCFG_HON',
  artNFT = 'COMUCFG_ARTNFT',
}

export const AddressConfig = Record({
  [ContractName.settings]: String.optional(),
  [ContractName.vaultFactory]: String.optional(),
  [ContractName.artNFT]: String.optional(),
  [ContractName.tokenVault]: String.optional(),
  [ContractName.membership]: String.optional(),
  [ContractName.crowdsale]: String.optional(),
  tokenHolder: String.optional(),
  treasuryWallet: String.optional(),
  usdcAddress: String.optional(),
  usdtAddress: String.optional(),
})
export type AddressConfig = Static<typeof AddressConfig>

export const StartSaleConfig = Record({
  tierCodes: Array(Number),
  roots: Array(String).optional(),
  // converted to roots
  addresses: Array(Array(String)).optional(),
  // parsed internally
  allocations: Array(Number),
})
export type StartSaleConfig = Static<typeof StartSaleConfig>

export const SettingsConfig = Record({
  minReserveFactor: Number,
  maxReserveFactor: Number,
})
export type SettingsConfig = Static<typeof SettingsConfig>

export const PartiallyPauseConfig = Record({
  contractName: String,
})
export type PartiallyPauseConfig = Static<typeof PartiallyPauseConfig>

export const SetRateConfig = Record({
  ethUSDPrice: Number,
  stablecoinRate: Number,
})
export type SetRateConfig = Static<typeof SetRateConfig>

export const EscrowConfig = Record({
  tokenIds: Array(Number),
  timestamps: Array(Number),
})
export type EscrowConfig = Static<typeof EscrowConfig>

export const TokenVaultConfig = Record({
  artId: Number,
  name: String,
  symbol: String,
  fee: Number,
  decimals: Number,
  // parsed in script
  tokenSupply: Number,
  initialPrice: Number,
})
export type TokenVaultConfig = Static<typeof TokenVaultConfig>

export const MembershipConfig = Record({
  name: String,
  symbol: String,
  friendEnd: Number,
  foundationEnd: Number,
  genesisEnd: Number,
  // parsed in script
  friendPrice: Number,
  foundationPrice: Number,
  genesisPrice: Number,
  membershipNFTBaseURI: String.optional(),
})
export type MembershipConfig = Static<typeof MembershipConfig>

export const HonoraryNFTConfig = Record({
  honoraryMembershipBaseURI: String.optional(),
})

export const ArtNFTConfig = Record({
  artNFTBaseURI: String.optional(),
})
