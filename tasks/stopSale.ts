import { NonceManager } from '@ethersproject/experimental'
import { expect } from 'chai'
import { BigNumber, BigNumberish, BytesLike, utils } from 'ethers'
import { task, types } from 'hardhat/config'
require('@nomiclabs/hardhat-ethers')

//sample command
// npx hardhat stopSale --contractaddress 0xd2DB665bCf769a65bDAa3fb9B95C9c919B264ef2

task('stopSale', 'Stops the sale')
  .addParam('contractaddress', "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const crowdsale = await ethers.getContractAt('AllowanceCrowdsale', taskArgs.contractaddress)
    const txn = await crowdsale.connect(nonceSigner).stopSale()
    console.log(txn.hash)
  })

module.exports = {}
