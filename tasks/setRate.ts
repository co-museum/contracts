import { NonceManager } from '@ethersproject/experimental'
import { BigNumberish, BytesLike } from 'ethers'
import { task, types } from 'hardhat/config'
require('@nomiclabs/hardhat-ethers')

//sample command
// npx hardhat setRate --contractaddress 0xd2DB665bCf769a65bDAa3fb9B95C9c919B264ef2 --ethrate 1 --stablerate 1 --network goerli

task('setRate', 'Prints active status of sale')
  .addParam('contractaddress', "The account's address")
  .addParam('ethrate', 'rate in Ethereum')
  .addParam('stablerate', 'rate in stablecoin')
  .setAction(async (taskArgs, { ethers }) => {
    const ethRate: BigNumberish = taskArgs.ethrate
    const stableRate: BigNumberish = taskArgs.stablerate
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const crowdsale = await ethers.getContractAt('AllowanceCrowdsale', taskArgs.contractaddress)
    const txn = await crowdsale.connect(nonceSigner).setRates(ethRate, stableRate)
    console.log(txn.hash)
  })

module.exports = {}
