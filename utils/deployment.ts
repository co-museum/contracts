import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import {
  AllowanceCrowdsale,
  ERC721MembershipUpgradeable,
  ERC721Mock,
  ERC721VaultFactory,
  IERC20,
  IERC721,
  Settings,
  TokenVault,
  VoteDelegator,
} from '../typechain'

const tokenVaultDecimals = 6
const genesisTokenPrice = ethers.utils.parseUnits('40000', tokenVaultDecimals)
const foundationTokenPrice = ethers.utils.parseUnits('4000', tokenVaultDecimals)
const friendTokenPrice = ethers.utils.parseUnits('400', tokenVaultDecimals)

export async function deployERC20Mock(
  holder: SignerWithAddress,
  name = 'ERC20',
  symbol = 'ERC20',
  supply = ethers.utils.parseUnits('9000000', 6),
  decimals = 6,
): Promise<IERC20> {
  const MockERC20 = await ethers.getContractFactory('ERC20Mock')
  const mockERC20 = await MockERC20.deploy(name, symbol, holder.address, supply, decimals)
  return mockERC20.deployed()
}

export async function deploySettings(): Promise<Settings> {
  const Settings = await ethers.getContractFactory('Settings')
  const settings = await Settings.deploy()
  return settings.deployed()
}

export async function deployVaultFactory(settings?: Settings): Promise<ERC721VaultFactory> {
  settings = settings ? settings : await deploySettings()
  const VaultFactory = await ethers.getContractFactory('ERC721VaultFactory')
  const vaultFactory = await VaultFactory.deploy(settings.address)
  return vaultFactory.deployed()
}

export async function deployERC721Mock(name = 'Dummy NFT', symbol = 'DMY'): Promise<ERC721Mock> {
  const DummyNFT = await ethers.getContractFactory('ERC721Mock')
  const dummyNFT = await DummyNFT.deploy(name, symbol)
  return dummyNFT.deployed()
}

export async function deployTokenVault(
  usdc: IERC20,
  // HACK: ERC721 seems to not satisfy IERC721 after compilation to TypeScript
  nft: ERC721Mock | IERC721,
  nftId: BigNumberish,
  vaultFactory: ERC721VaultFactory,
  name = 'Dummy Frac',
  symbol = 'DMYF',
  tokenSupply = ethers.utils.parseUnits('4000000', tokenVaultDecimals),
  initialPrice = ethers.utils.parseUnits('4000000', tokenVaultDecimals),
  fee = 0,
): Promise<TokenVault> {
  const tx = await vaultFactory.mint(name, symbol, nft.address, usdc.address, nftId, tokenSupply, initialPrice, fee)
  const receipt = await tx.wait()
  const [mintEvent] = receipt.events!.filter((event, i, arr) => event.event == 'Mint')
  const vaultAddress = mintEvent.args!['vault']
  return ethers.getContractAt('TokenVault', vaultAddress)
}

export async function deployVoteDelegator(tokenVault: TokenVault): Promise<VoteDelegator> {
  const VoteDelegator = await ethers.getContractFactory('VoteDelegator')
  const voteDelegator = await VoteDelegator.deploy()
  await voteDelegator.deployed()
  await voteDelegator.initialize(tokenVault.address)
  return Promise.resolve(voteDelegator)
}

export async function deployMembership(
  tokenVault: TokenVault,
  voteDelegator?: VoteDelegator,
  name = 'Membership',
  symbol = 'MBR',
  genesisEnd = 2,
  foundationEnd = 4,
  friendEnd = 6,
): Promise<ERC721MembershipUpgradeable> {
  voteDelegator = voteDelegator ? voteDelegator : await deployVoteDelegator(tokenVault)
  const MembershipContract = await ethers.getContractFactory('ERC721MembershipUpgradeable')
  const membershipContract = await MembershipContract.deploy()
  await membershipContract.deployed()
  await membershipContract.initialize(
    name,
    symbol,
    tokenVault.address,
    voteDelegator.address,
    genesisEnd,
    foundationEnd,
    friendEnd,
    genesisTokenPrice,
    foundationTokenPrice,
    friendTokenPrice
  )
  return Promise.resolve(membershipContract)
}

export async function deployAllowanceCrowdsale(
  tokenVault: TokenVault,
  treasuryWallet: SignerWithAddress,
  tokenHoldingWallet: SignerWithAddress,
  membershipContract: ERC721MembershipUpgradeable,
  acceptedStablecoins: IERC20[],
): Promise<AllowanceCrowdsale> {
  const AllowanceCrowdsale = await ethers.getContractFactory('AllowanceCrowdsale')
  const allowanceCrowdsale = await AllowanceCrowdsale.deploy(
    tokenVault.address,
    treasuryWallet.address,
    tokenHoldingWallet.address,
    membershipContract.address,
    acceptedStablecoins.map((erc20) => erc20.address),
  )
  return allowanceCrowdsale.deployed()
}
