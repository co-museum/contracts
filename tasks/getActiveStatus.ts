import { NonceManager } from '@ethersproject/experimental'
import { task, types } from 'hardhat/config'
require('@nomiclabs/hardhat-ethers')

task('get-active-status', 'Prints active status of sale')
  .addParam('contractaddress', "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const crowdsale = await ethers.getContractAt('AllowanceCrowdsale', taskArgs.contractaddress)
    console.log(await crowdsale.connect(nonceSigner).isActive())
  })

module.exports = {}
