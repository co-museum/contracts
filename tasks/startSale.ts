import { NonceManager } from '@ethersproject/experimental'
import { expect } from 'chai'
import { BigNumber, BigNumberish, BytesLike, utils } from 'ethers'
import { task, types } from 'hardhat/config'
import MerkleTree from 'merkletreejs'
require('@nomiclabs/hardhat-ethers')

//sample command
// npx hardhat start-sale-manual --contractaddress 0xd2DB665bCf769a65bDAa3fb9B95C9c919B264ef2 --tiercodes 2,2,1 --allocations 400,800,40000 --roots 0xe9707d0e6171f728f7473c24cc0432a9b07eaaf1efed6a137a4a8c12c79552d9,0x00314e565e0574cb412563df634608d76f5c59d9f817e85966100ec1d48005c0,0x6079234475ac4992943f96a73c5e885e89ecaf8a07e9d34aa76ac8301352a2fd --network goerli
// npx hardhat start-sale-files --filenames "./data/genesisBatchOne.json" --crowdsaleaddress 0x6FA2bE3A77a00331bb96AB50C381B329277b2FC5 --network goerli

task('start-sale-files', 'Starts the sale')
  .addParam('filenames', "The account's address")
  .addParam('crowdsaleaddress', "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    const filenames: string[] = taskArgs.filenames.split(',')
    const allocations: BigNumberish[] = []
    const tierCodes: BigNumberish[] = []
    const roots: BytesLike[] = []
    for (var file of filenames) {
      const content = require(file)
      allocations.push(ethers.utils.parseUnits(content.allocation.toString(), 6))
      tierCodes.push(content.tiercode)
      const addresses: string[] = content.addresses
      const leaves = addresses.map((address) => utils.keccak256(address))
      const tree = new MerkleTree(leaves, utils.keccak256, {
        sort: true,
      })
      const root = tree.getHexRoot()
      roots.push(root)
    }

    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const crowdsale = await ethers.getContractAt('AllowanceCrowdsale', taskArgs.crowdsaleaddress)
    expect(
      tierCodes.length != 0 && tierCodes.length == allocations.length && tierCodes.length == roots.length,
      'all input arrays must be non zero length and equal in length',
    )
    console.log(roots)
    const txn = await crowdsale.connect(nonceSigner).startSale(tierCodes, allocations, roots)
    console.log('sale has started at txn hash', txn.hash)
  })

task('start-sale-manual', 'Starts the sale')
  .addParam('crowdsaleaddress', "The account's address")
  .addParam('tiercodes', 'tier code for each merkle root seperated by commas')
  .addParam('roots', 'merkle roots seperated by commas')
  .addParam('allocations', 'allocation for each merkle root seperated by commas')
  .setAction(async (taskArgs, { ethers }) => {
    const tierCodes: BigNumberish[] = taskArgs.tiercodes.split(',').map(Number)
    var allocations: BigNumberish[] = taskArgs.allocations
      .split(',')
      .map(Number)
      .map((val: BigNumberish) => utils.parseUnits(val.toString(), 6))

    const merkleRoots: BytesLike[] = taskArgs.roots.split(',')

    const [signer] = await ethers.getSigners()
    const nonceSigner = new NonceManager(signer)
    const crowdsale = await ethers.getContractAt('AllowanceCrowdsale', taskArgs.crowdsaleaddress)
    expect(
      tierCodes.length != 0 && tierCodes.length == allocations.length && tierCodes.length == merkleRoots.length,
      'all input arrays must be non zero length and equal in length',
    )
    const txn = await crowdsale.connect(nonceSigner).startSale(tierCodes, allocations, merkleRoots)
    console.log(txn.hash)
  })

module.exports = {}
