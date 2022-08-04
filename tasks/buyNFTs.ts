import { NonceManager } from '@ethersproject/experimental'
import { constants } from 'buffer'
import { expect } from 'chai'
import { BigNumber, BigNumberish, BytesLike, utils } from 'ethers'
import { task, types } from 'hardhat/config'
import MerkleTree from 'merkletreejs'
require('@nomiclabs/hardhat-ethers')

//sample command
// npx hardhat start-sale-manual --contractaddress 0xd2DB665bCf769a65bDAa3fb9B95C9c919B264ef2 --tiercodes 2,2,1 --allocations 400,800,40000 --roots 0xe9707d0e6171f728f7473c24cc0432a9b07eaaf1efed6a137a4a8c12c79552d9,0x00314e565e0574cb412563df634608d76f5c59d9f817e85966100ec1d48005c0,0x6079234475ac4992943f96a73c5e885e89ecaf8a07e9d34aa76ac8301352a2fd --network goerli
// npx hardhat buy-nfts-files --filenames "./data/genesisBatchOne.json" --crowdsaleaddress 0x6FA2bE3A77a00331bb96AB50C381B329277b2FC5 --network goerli

task('buy-nfts-files', 'Starts the sale')
  .addParam('filenames', "The account's address")
  .addParam('crowdsaleaddress', "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    const filenames: string[] = taskArgs.filenames.split(',')
    const allocations: BigNumberish[] = []
    const tierCodes: BigNumberish[] = []
    const roots: BytesLike[] = []
    const trees: MerkleTree[] = []
    const allAddresses: string[][] = []
    for (var file of filenames) {
      const content = require(file)
      allocations.push(content.allocation)
      tierCodes.push(content.tiercode)
      const addresses: string[] = content.addresses
      allAddresses.push(addresses)
      const leaves = addresses.map((address) => utils.keccak256(address))
      const tree = new MerkleTree(leaves, utils.keccak256, {
        sort: true,
      })
      trees.push(tree)
      const root = tree.getHexRoot()
      roots.push(root)
    }

    const [signer] = await ethers.getSigners()
    console.log(trees)
    console.log(trees.length)
    console.log(signer.address)
    const nonceSigner = new NonceManager(signer)
    const crowdsale = await ethers.getContractAt('AllowanceCrowdsale', taskArgs.crowdsaleaddress)

    const proof = trees[0].getHexProof('0xbfB72a546d63F35a9BF64Ec01815782Ed6014422')
    console.log(proof)
    const txn = await crowdsale.connect(signer).buyNFTs(1, 0, proof, true, signer.address, { gasLimit: 50000 })
    console.log('NFT sale status at', txn.hash)
  })

module.exports = {}
