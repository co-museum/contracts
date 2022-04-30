// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // the first address is the default msg.sender
  const [signer] = await ethers.getSigners()

  // We get the contract to deploy
  const Settings = await ethers.getContractFactory("Settings");
  const settings = await Settings.deploy();
  await settings.deployed();
  console.log("Settings deployed to:", settings.address);

  const VaultFactory = await ethers.getContractFactory("ERC721VaultFactory");
  const vaultFactory = await VaultFactory.deploy(settings.address);
  await vaultFactory.deployed();
  console.log("VaultFactory deployed to:", vaultFactory.address);

  const DummyNFT = await ethers.getContractFactory("ERC721PresetMinterPauserAutoId");
  const dummyNFT = await DummyNFT.deploy("Dummy", "DMY", "co-museum.com/dummy-nft");
  await dummyNFT.deployed();
  console.log("DummyNFT deployed to:", dummyNFT.address);

  // dummyNFT.mint(signer.address)
  // // TODO: get tokenID from Transfer event and use it in vaultFactory.mint

  // await vaultFactory.mint(
  //   "Dummy Frac", // name
  //   "DMYF", // symbol
  //   dummyNFT.address, // token
  //   0, // id
  //   10000, // supply
  //   10, // listPrice
  //   0, // fee
  // )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
