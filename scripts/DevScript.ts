import { ethers } from 'hardhat'
import { NonceManager } from '@ethersproject/experimental'

async function main() {
  const [signer] = await ethers.getSigners()
  const nonceSigner = new NonceManager(signer)
  const crowdsale = await ethers.getContractAt('AllowanceCrowdsale', '0xd2DB665bCf769a65bDAa3fb9B95C9c919B264ef2')
  console.log(await crowdsale.connect(nonceSigner).isActive())
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
