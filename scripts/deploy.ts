// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { BigNumberish, utils } from "ethers";
import { ethers } from "hardhat";
import { TokenVault } from "../typechain";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // the first address is the default msg.sender
  const [signer] = await ethers.getSigners()
  console.log("Default signer:", signer.address)

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

  dummyNFT.on("Transfer", async (from: string, to: string, _tokenId: BigNumberish, event: Event) => {
    console.log("Token ID:", _tokenId)
    const tokenId = _tokenId
    await dummyNFT.approve(vaultFactory.address, tokenId)

    await vaultFactory.mint(
      "Dummy Frac", // name
      "DMYF", // symbol
      dummyNFT.address, // token
      tokenId,
      utils.parseEther("10000"), // supply
      10, // listPrice
      0, // fee
    )

    dummyNFT.removeAllListeners()
  })

  vaultFactory.on("Mint",
    async (
      token: string,
      id: BigNumberish,
      listPrice: BigNumberish,
      vault: string,
      vaultId: BigNumberish,
      event: Event
    ) => {
      console.log("Fractionalised token address:", vault)
      vaultFactory.removeAllListeners()
    }
  )

  await dummyNFT.mint(signer.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
