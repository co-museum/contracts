import { NonceManager } from '@ethersproject/experimental'
import { expect } from 'chai'
import { BigNumber, BigNumberish, BytesLike, utils } from 'ethers'
import { task, types } from 'hardhat/config'
require('@nomiclabs/hardhat-ethers')

//sample command
// npx hardhat startSale --contractaddress 0xd2DB665bCf769a65bDAa3fb9B95C9c919B264ef2 --tiercodes 2,2,1 --allocations 400,800,40000 --hah 0xe9707d0e6171f728f7473c24cc0432a9b07eaaf1efed6a137a4a8c12c79552d9,0x00314e565e0574cb412563df634608d76f5c59d9f817e85966100ec1d48005c0,0x6079234475ac4992943f96a73c5e885e89ecaf8a07e9d34aa76ac8301352a2fd --network goerli

task('startSale', 'Starts the sale')
  .addParam('contractaddress', "The account's address")
  .addParam('tiercodes', 'tier code for each merkle root seperated by commas')
  .addParam('hah', 'merkle roots seperated by commas')
  .addParam('allocations', 'allocation for each merkle root seperated by commas')
  .setAction(async (taskArgs, { ethers }) => {
    const tierCodes: BigNumberish[] = taskArgs.tiercodes.split(',').map(Number)
    var allocations: BigNumberish[] = taskArgs.allocations
      .split(',')
      .map(Number)
      .map((val: BigNumberish) => utils.parseUnits(val.toString(), 6))

    const merkleRoots: BytesLike[] = taskArgs.hah.split(',')

    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const crowdsale = await ethers.getContractAt('AllowanceCrowdsale', taskArgs.contractaddress)
    expect(
      tierCodes.length != 0 && tierCodes.length == allocations.length && tierCodes.length == merkleRoots.length,
      'all input arrays must be non zero length and equal in length',
    )
    const txn = await crowdsale.connect(nonceSigner).startSale(tierCodes, allocations, merkleRoots)
    console.log(txn.hash)
  })

module.exports = {}
