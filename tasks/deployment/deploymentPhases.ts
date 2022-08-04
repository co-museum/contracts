require('@nomiclabs/hardhat-ethers')
import { NonceManager } from '@ethersproject/experimental'
import { task, subtask } from 'hardhat/config'
import {
  AllowanceCrowdsale,
  ERC721ArtNFT,
  ERC721MembershipUpgradeable,
  ERC721VaultFactory,
  Settings,
  TokenVault,
  VoteDelegator,
} from '../../typechain'

// COMMANDS
// deploy-phase-nft: yarn hardhat deployment-phase-one --network goerli
// phase-one-approve: yarn hardhat deployment-phase-one-approve --network goerli --vaultfactoryaddress 0x2E74fB56cfc5F48D9081C4c57981CEFc180a5332 --artnftaddress 0x8BC19A026c00658c461fa259004845BAF7758890
// phase-two: yarn hardhat deployment-phase-two --network goerli --vaultfactoryaddress 0x2E74fB56cfc5F48D9081C4c57981CEFc180a5332 --artnftaddress 0x8BC19A026c00658c461fa259004845BAF7758890
// phase-three: yarn hardhat deployment-phase-three --network goerli --tokenvaultaddress 0x77AACA9866437294728f5cdb7B912B1D4D43AE3C --artnftaddress 0x8BC19A026c00658c461fa259004845BAF7758890
// phase-four: yarn hardhat deployment-phase-four --network goerli --tokenvaultaddress 0x77AACA9866437294728f5cdb7B912B1D4D43AE3C --artnftaddress 0x8BC19A026c00658c461fa259004845BAF7758890 --membershipaddress 0xd6276FE4a7Af3C5361B646085B52e8863d078bc7
// phase-five: yarn hardhat deployment-phase-five --network goerli --tokenvaultaddress 0x77AACA9866437294728f5cdb7B912B1D4D43AE3C --membershipaddress 0xd6276FE4a7Af3C5361B646085B52e8863d078bc7 --crowdsaleaddress 0x6FA2bE3A77a00331bb96AB50C381B329277b2FC5
// phase-six: yarn hardhat deployment-phase-six --network goerli --tokenvaultaddress 0x77AACA9866437294728f5cdb7B912B1D4D43AE3C --membershipaddress 0xd6276FE4a7Af3C5361B646085B52e8863d078bc7 --crowdsaleaddress 0x6FA2bE3A77a00331bb96AB50C381B329277b2FC5

const usdcaddress = '0x07865c6E87B9F70255377e024ace6630C1Eaa37F'

// DEPLOYMENT PHASES
task('deploy-phase-nft', 'Deploys, mints and approves ART NFT').setAction(async (taskArgs, hre) => {
  const settings: Settings = await hre.run('settings')
  const vaultFactory: ERC721VaultFactory = await hre.run('vault-factory', { settingsaddress: settings.address })
  const artNFT: ERC721ArtNFT = await hre.run('art-nft', { recieveraddress: process.env.RECIEVER_ADDRESS })
  await hre.run('mint-art-nft', { artnftaddress: artNFT.address })
})

task('deployment-phase-one-approve', 'Deploys, mints and approves ART NFT')
  .addParam('vaultfactoryaddress', 'Address of Vault Factory')
  .addParam('artnftaddress', 'Address of ART NFT')
  .setAction(async (taskArgs, hre) => {
    await hre.run('approve-art-nft', {
      artnftaddress: taskArgs.artnftaddress,
      approvetoaddress: taskArgs.vaultfactoryaddress,
      tokenid: '0',
    })
  })

task('deployment-phase-two', 'Deploys Contracts')
  .addParam('vaultfactoryaddress', 'rate in Ethereum')
  .addParam('artnftaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, hre) => {
    const usdcaddress = '0x07865c6E87B9F70255377e024ace6630C1Eaa37F'
    const tokenVault: TokenVault = await hre.run('deploy-token-vault', {
      usdcaddress: usdcaddress,
      artnftaddress: taskArgs.artnftaddress,
      vaultfactoryaddress: taskArgs.vaultfactoryaddress,
      tokenid: '0',
    })
  })

task('deployment-phase-three', 'Deploys Membership contracts')
  .addParam('tokenvaultaddress', 'rate in Ethereum')
  .addParam('artnftaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, hre) => {
    const voteDelegator: VoteDelegator = await hre.run('deploy-vote-delegator', {
      tokenvaultaddress: taskArgs.tokenvaultaddress,
    })

    const membership: ERC721MembershipUpgradeable = await hre.run('deploy-membership', {
      votedelegatoraddress: voteDelegator.address,
      artnftaddress: taskArgs.artnftaddress,
      tokenvaultaddress: taskArgs.tokenvaultaddress,
    })
  })

task('deployment-phase-four', 'Deploys Membership contracts')
  .addParam('tokenvaultaddress', 'rate in Ethereum')
  .addParam('artnftaddress', 'rate in Ethereum')
  .addParam('membershipaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, hre) => {
    const crowdsale: AllowanceCrowdsale = await hre.run('deploy-crowdsale', {
      tokenvaultaddress: taskArgs.tokenvaultaddress,
      artnftaddress: taskArgs.artnftaddress,
      membershipaddress: taskArgs.membershipaddress,
      usdcaddress: usdcaddress,
    })
  })

task('deployment-phase-five', 'Deploys Membership contracts')
  .addParam('tokenvaultaddress', 'rate in Ethereum')
  .addParam('membershipaddress', 'rate in Ethereum')
  .addParam('crowdsaleaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, hre) => {
    await hre.run('add-permissions', {
      tokenvaultaddress: taskArgs.tokenvaultaddress,
      membershipaddress: taskArgs.membershipaddress,
      crowdsaleaddress: taskArgs.crowdsaleaddress,
    })
  })

task('deployment-phase-six', 'Deploys Membership contracts')
  .addParam('tokenvaultaddress', 'rate in Ethereum')
  .addParam('membershipaddress', 'rate in Ethereum')
  .addParam('crowdsaleaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, hre) => {
    await hre.run('add-senders', {
      tokenvaultaddress: taskArgs.tokenvaultaddress,
      membershipaddress: taskArgs.membershipaddress,
      crowdsaleaddress: taskArgs.crowdsaleaddress,
    })
  })

// DEPLOYMENT SUBTASKS
subtask('settings', 'Prints a message').setAction(async (taskArgs, { ethers }) => {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)
  const Settings = await ethers.getContractFactory('Settings')
  const settings = await Settings.connect(nonceSigner).deploy()
  await settings.deployed()
  await settings.connect(nonceSigner).setMinReserveFactor(750) // 75%
  await settings.connect(nonceSigner).setMaxReserveFactor(5000) // 500%
  console.log(`settings: ${settings.address}`)
  return settings
})

subtask('vault-factory', 'Prints a message')
  .addParam('settingsaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const VaultFactory = await ethers.getContractFactory('ERC721VaultFactory')
    const vaultFactory = await VaultFactory.connect(nonceSigner).deploy(taskArgs.settingsaddress)
    await vaultFactory.deployed()
    console.log(`vault factory: ${vaultFactory.address}`)
    return vaultFactory
  })

subtask('art-nft', 'Prints a message')
  .addParam('recieveraddress', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const ArtNFT = await ethers.getContractFactory('ERC721ArtNFT')
    const artNFT = await ArtNFT.connect(nonceSigner).deploy(taskArgs.recieveraddress)
    await artNFT.deployed()
    console.log(`art NFT: ${artNFT.address}`)
    return artNFT
  })

subtask('mint-art-nft', 'Prints a message')
  .addParam('artnftaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const artNFT = await ethers.getContractAt('ERC721ArtNFT', taskArgs.artnftaddress)
    const txn = await artNFT.connect(nonceSigner).mint(await nonceSigner.getAddress())
    console.log(`art NFT minted at txn hash: ${txn.hash}`)
  })

subtask('approve-art-nft', 'Prints a message')
  .addParam('artnftaddress', 'rate in Ethereum')
  .addParam('approvetoaddress', 'rate in Ethereum')
  .addParam('tokenid', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const artNFT = await ethers.getContractAt('ERC721ArtNFT', taskArgs.artnftaddress)
    const txn = await artNFT.connect(nonceSigner).approve(taskArgs.approvetoaddress, taskArgs.tokenid)
    console.log(`art NFT approved to vaultFactory at txn hash: ${txn.hash}`)
  })

subtask('deploy-token-vault', 'Prints a message')
  .addParam('usdcaddress', 'rate in Ethereum')
  .addParam('artnftaddress', 'rate in Ethereum')
  .addParam('tokenid', 'rate in Ethereum')
  .addParam('vaultfactoryaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const abiERC20 = require('../abis/erc20.json')
    const nftId = taskArgs.tokenid
    const tokenSupply = ethers.utils.parseUnits('4000000', 6)
    const initialPrice = ethers.utils.parseUnits('4000000', 6)
    const fee = 0
    const name = 'Dummy Frac'
    const symbol = 'DMYF'
    // console.log(JSON.stringify(abiERC20.abi))
    // const usdcContract = new ethers.Contract(taskArgs.usdcaddress, abiERC20.abi)
    // console.log(usdcContract.address)
    // const artNFT = await ethers.getContractAt('ERC721ArtNFT', taskArgs.artnftaddress)
    const vaultFactory = await ethers.getContractAt('ERC721VaultFactory', taskArgs.vaultfactoryaddress)

    const tx = await vaultFactory
      .connect(nonceSigner)
      .mint(name, symbol, taskArgs.artnftaddress, taskArgs.usdcaddress, BigInt(nftId), tokenSupply, initialPrice, fee)
    // console.log('HERE1')
    const receipt = await tx.wait()
    // console.log('HERE2')
    const [mintEvent] = receipt.events!.filter((event, i, arr) => event.event == 'Mint')
    // console.log('HERE1')
    const vaultAddress = mintEvent.args!['vault']
    const tokenVault: TokenVault = await ethers.getContractAt('TokenVault', vaultAddress)
    console.log(`tokenVault address: ${tokenVault.address}`)
    return tokenVault
  })

subtask('deploy-vote-delegator', 'Prints a message')
  .addParam('tokenvaultaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const VoteDelegator = await ethers.getContractFactory('VoteDelegator')
    const voteDelegator = await VoteDelegator.connect(signer).deploy()
    await voteDelegator.deployed()
    await voteDelegator.connect(nonceSigner).initialize(taskArgs.tokenvaultaddress)
    console.log(`vote delegator: ${voteDelegator.address}`)
    return voteDelegator
  })

subtask('deploy-membership', 'Prints a message')
  .addParam('artnftaddress', 'rate in Ethereum')
  .addParam('votedelegatoraddress', 'rate in Ethereum')
  .addParam('tokenvaultaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const genesisEnd = 15
    const foundationEnd = genesisEnd + 200
    const friendEnd = foundationEnd + 3500
    const name = 'Art Membership'
    const symbol = 'ARTM'
    const tokenVaultDecimals = 6
    const genesisTokenPrice = ethers.utils.parseUnits('40000', tokenVaultDecimals)
    const foundationTokenPrice = ethers.utils.parseUnits('4000', tokenVaultDecimals)
    const friendTokenPrice = ethers.utils.parseUnits('400', tokenVaultDecimals)
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const voteDelegator = await ethers.getContractAt('VoteDelegator', taskArgs.votedelegatoraddress)
    const MembershipContract = await ethers.getContractFactory('ERC721MembershipUpgradeable')
    const membershipContract = await MembershipContract.connect(nonceSigner).deploy()
    await membershipContract.deployed()
    await membershipContract
      .connect(nonceSigner)
      .initialize(
        name,
        symbol,
        taskArgs.tokenvaultaddress,
        voteDelegator.address,
        genesisEnd,
        foundationEnd,
        friendEnd,
        genesisTokenPrice,
        foundationTokenPrice,
        friendTokenPrice,
      )
    console.log(`art membership: ${membershipContract.address}`)
    return membershipContract
  })

subtask('deploy-crowdsale', 'Prints a message')
  .addParam('tokenvaultaddress', 'rate in Ethereum')
  .addParam('artnftaddress', 'rate in Ethereum')
  .addParam('membershipaddress', 'rate in Ethereum')
  .addParam('usdcaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const AllowanceCrowdsale = await ethers.getContractFactory('AllowanceCrowdsale')
    const treasuryWalletAddress = signer.address
    const tokenHoldingAddress = signer.address
    const acceptedStablecoins = [taskArgs.usdcaddress]
    const allowanceCrowdsale = await AllowanceCrowdsale.connect(nonceSigner).deploy(
      taskArgs.tokenvaultaddress,
      treasuryWalletAddress,
      tokenHoldingAddress,
      taskArgs.membershipaddress,
      acceptedStablecoins,
    )
    await allowanceCrowdsale.deployed()
    console.log(`crowdsale: ${allowanceCrowdsale.address}`)
    return allowanceCrowdsale
  })

subtask('add-permissions', 'Prints a message')
  .addParam('tokenvaultaddress', 'rate in Ethereum')
  .addParam('membershipaddress', 'rate in Ethereum')
  .addParam('crowdsaleaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const artSupply = ethers.utils.parseUnits('4000000', 6)
    const [signer] = await ethers.getSigners()
    const nonceTokenHolder = signer

    const artToken: TokenVault = await ethers.getContractAt('TokenVault', taskArgs.tokenvaultaddress)
    const membership: ERC721MembershipUpgradeable = await ethers.getContractAt(
      'ERC721MembershipUpgradeable',
      taskArgs.membershipaddress,
    )
    const crowdsale: AllowanceCrowdsale = await ethers.getContractAt('AllowanceCrowdsale', taskArgs.membershipaddress)

    // NOTE: crowdsale transfers tokens through membership
    await artToken.connect(nonceTokenHolder).approve(membership.address, artSupply)
    await artToken.connect(nonceTokenHolder).approve(crowdsale.address, artSupply)
    console.log(`art token permissions sorted`)
  })

subtask('add-senders', 'Prints a message')
  .addParam('tokenvaultaddress', 'rate in Ethereum')
  .addParam('membershipaddress', 'rate in Ethereum')
  .addParam('crowdsaleaddress', 'rate in Ethereum')
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)

    const artToken: TokenVault = await ethers.getContractAt('TokenVault', taskArgs.tokenvaultaddress)
    const membership: ERC721MembershipUpgradeable = await ethers.getContractAt(
      'ERC721MembershipUpgradeable',
      taskArgs.membershipaddress,
    )
    const crowdsale: AllowanceCrowdsale = await ethers.getContractAt('AllowanceCrowdsale', taskArgs.membershipaddress)

    // NOTE: crowdsale transfers tokens through membership
    await membership.connect(nonceSigner).addSender(membership.address)
    await artToken.connect(nonceSigner).addSender(crowdsale.address)
    await artToken.connect(nonceSigner).addSender(membership.address)
    console.log(`senders added`)

    await membership.connect(nonceSigner).pause()
    await artToken.connect(nonceSigner).pause()
    console.log(`contracts paused`)
  })

module.exports = {}
