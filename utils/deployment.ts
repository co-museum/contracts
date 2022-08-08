import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumberish, Signer } from 'ethers'
import { ethers } from 'hardhat'
import hre from 'hardhat'
import {
  AllowanceCrowdsale,
  ERC721,
  ERC721MembershipUpgradeable,
  ERC721Mock,
  ERC721ArtNFT,
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

const etherscanUrl = 'etherscan.io'
const goerli = 'goerli'
const localhost = 'localhost'

export enum txType {
  address = 'address',
  tx = 'tx',
}

// prints etherscan URL if on goerli or mainnet
// just contract address otherwise
export function printTx(message: string, hash: string, type?: txType): void {
  switch (hre.network.name) {
    case 'mainnet': {
      console.log(`${message}: https://${etherscanUrl}/${type}/${hash}`)
      break
    }
    case goerli: {
      console.log(`${message}: https://${goerli}.${etherscanUrl}/${type}/${hash}`)
      break
    }
    case localhost: {
      console.log(`${message}: ${hash}`)
      break
    }
  }
}

async function getSignerOrDefault(signer?: Signer): Promise<Signer> {
  const [defaultSigner] = await ethers.getSigners()
  return signer ? Promise.resolve(signer) : Promise.resolve(defaultSigner)
}

export async function deployERC20Mock(
  holder: string,
  name = 'ERC20',
  symbol = 'ERC20',
  supply = ethers.utils.parseUnits('9000000', 6),
  decimals = 6,
  signer?: Signer,
): Promise<IERC20> {
  const sig = await getSignerOrDefault(signer)
  const MockERC20 = await ethers.getContractFactory('ERC20Mock')
  const mockERC20 = await MockERC20.connect(sig).deploy(name, symbol, holder, supply, decimals)
  printTx(name, mockERC20.address, txType.address)
  return mockERC20.deployed()
}

export async function deploySettings(signer?: Signer): Promise<Settings> {
  const Settings = await ethers.getContractFactory('Settings')
  const sig = await getSignerOrDefault(signer)
  const settings = await Settings.connect(sig).deploy()
  printTx('settings', settings.address, txType.address)
  return settings.deployed()
}

export async function deployVaultFactory(settings?: string, signer?: Signer): Promise<ERC721VaultFactory> {
  settings = settings ? settings : (await deploySettings()).address
  const VaultFactory = await ethers.getContractFactory('ERC721VaultFactory')
  const sig = await getSignerOrDefault(signer)
  const vaultFactory = await VaultFactory.connect(sig).deploy(settings)
  printTx('vault factory', vaultFactory.address, txType.address)
  return vaultFactory.deployed()
}

export async function deployERC721Mock(name = 'Dummy NFT', symbol = 'DMY', signer?: Signer): Promise<ERC721Mock> {
  const DummyNFT = await ethers.getContractFactory('ERC721Mock')
  const sig = await getSignerOrDefault(signer)
  const dummyNFT = await DummyNFT.connect(sig).deploy(name, symbol)
  printTx(name, dummyNFT.address, txType.address)
  return dummyNFT.deployed()
}

export async function deployERC721ArtNFT(receiverAddress: string, signer?: Signer): Promise<ERC721ArtNFT> {
  const ArtNFT = await ethers.getContractFactory('ERC721ArtNFT')
  const sig = await getSignerOrDefault(signer)
  const artNFT = await ArtNFT.connect(sig).deploy(receiverAddress)
  printTx('art NFT', artNFT.address, txType.address)
  return artNFT.deployed()
}

export async function deployTokenVault(
  usdc: string,
  nft: string,
  nftId: BigNumberish,
  vaultFactory: string,
  name = 'Dummy Frac',
  symbol = 'DMYF',
  tokenSupply: BigNumberish = ethers.utils.parseUnits('4000000', tokenVaultDecimals),
  initialPrice: BigNumberish = ethers.utils.parseUnits('4000000', tokenVaultDecimals),
  fee: BigNumberish = 0,
  signer?: Signer,
): Promise<TokenVault> {
  const sig = await getSignerOrDefault(signer)
  const vaultFactoryContract = await ethers.getContractAt('ERC721VaultFactory', vaultFactory)
  const tx = await vaultFactoryContract
    .connect(sig)
    .mint(name, symbol, nft, usdc, nftId, tokenSupply, initialPrice, fee)
  const receipt = await tx.wait()
  const [mintEvent] = receipt.events!.filter((event, i, arr) => event.event == 'Mint')
  const vaultAddress = mintEvent.args!['vault']
  printTx('token vault', vaultAddress, txType.address)
  return ethers.getContractAt('TokenVault', vaultAddress)
}

export async function deployVoteDelegator(tokenVault: string, signer?: Signer): Promise<VoteDelegator> {
  const sig = await getSignerOrDefault(signer)
  const VoteDelegator = await ethers.getContractFactory('VoteDelegator')
  const voteDelegator = await VoteDelegator.connect(sig).deploy()
  await voteDelegator.deployed()
  await voteDelegator.connect(sig).initialize(tokenVault)
  printTx('vote delegator', voteDelegator.address, txType.address)
  return Promise.resolve(voteDelegator)
}

export async function deployMembership(
  tokenVault: string,
  voteDelegator?: string,
  name = 'Membership',
  symbol = 'MBR',
  genesisEnd: BigNumberish = 2,
  foundationEnd: BigNumberish = 4,
  friendEnd: BigNumberish = 6,
  genesisPrice: BigNumberish = genesisTokenPrice,
  foundationPrice: BigNumberish = foundationTokenPrice,
  friendPrice: BigNumberish = friendTokenPrice,
  signer?: Signer,
): Promise<ERC721MembershipUpgradeable> {
  const sig = await getSignerOrDefault(signer)
  voteDelegator = voteDelegator ? voteDelegator : (await deployVoteDelegator(tokenVault)).address
  const MembershipContract = await ethers.getContractFactory('ERC721MembershipUpgradeable')
  const membershipContract = await MembershipContract.connect(sig).deploy()
  await membershipContract.deployed()
  await membershipContract
    .connect(sig)
    .initialize(
      name,
      symbol,
      tokenVault,
      voteDelegator,
      genesisEnd,
      foundationEnd,
      friendEnd,
      genesisPrice,
      foundationPrice,
      friendPrice,
    )
  printTx('membership', membershipContract.address, txType.address)
  return Promise.resolve(membershipContract)
}

export async function deployAllowanceCrowdsale(
  tokenVault: string,
  treasuryWallet: string,
  tokenHoldingWallet: string,
  membershipContract: string,
  acceptedStablecoins: string[],
  signer?: Signer,
): Promise<AllowanceCrowdsale> {
  const sig = await getSignerOrDefault(signer)
  const AllowanceCrowdsale = await ethers.getContractFactory('AllowanceCrowdsale')
  const allowanceCrowdsale = await AllowanceCrowdsale.connect(sig).deploy(
    tokenVault,
    treasuryWallet,
    tokenHoldingWallet,
    membershipContract,
    acceptedStablecoins,
  )
  printTx('crowdsale', allowanceCrowdsale.address, txType.address)
  return allowanceCrowdsale.deployed()
}
