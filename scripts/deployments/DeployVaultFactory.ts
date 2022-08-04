import { ethers } from 'hardhat'

async function main() {
    const [signer] = await ethers.getSigners()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})