import { NonceManager } from '@ethersproject/experimental'
import { BigNumberish, BytesLike, ContractTransaction } from 'ethers'
import { task, types } from 'hardhat/config'
import { ERC721MembershipUpgradeable, TokenVault } from '../typechain'
require('@nomiclabs/hardhat-ethers')

//sample command
// npx hardhat partially-pause --contractaddress 0xd2DB665bCf769a65bDAa3fb9B95C9c919B264ef2 --contractname TokenVault --network goerli

task('partially-pause', 'Partially pauses a token contract')
  .addParam('contractaddress', "The account's address")
  .addParam('contractname', 'The name of the contract to be paused')
  .setAction(async (taskArgs, { ethers }) => {
    const contractName: string = taskArgs.contractname

    if (contractName == 'TokenVault') {
      const contract: TokenVault = await ethers.getContractAt('TokenVault', taskArgs.contractaddress)
      const txn = await contract.pause({ gasLimit: 50000 })
      console.log(txn.hash)
      // console.log('Contract pause status: ', await contract.paused({ gasLimit: 100000 }))
    } else if (contractName == 'ERC721MembershipUpgradeable') {
      const contract: ERC721MembershipUpgradeable = await ethers.getContractAt(
        'ERC721MembershipUpgradeable',
        taskArgs.contractaddress,
      )
      const txn = await contract.pause({ gasLimit: 50000 })
      console.log(txn.hash)
      // console.log('Contract pause status: ', await contract.paused())
    }
  })

module.exports = {}
