import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners()
  console.log("Default signer:", signer.address)

  const Settings = await ethers.getContractFactory("Settings");
  const settings = await Settings.deploy();
  await settings.deployed();
  console.log("Settings deployed to:", settings.address);

  const VaultFactory = await ethers.getContractFactory("ERC721VaultFactory");
  const vaultFactory = await VaultFactory.deploy(settings.address);
  await vaultFactory.deployed();
  console.log("VaultFactory deployed to:", vaultFactory.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

