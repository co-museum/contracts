// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { BigNumberish, utils } from "ethers";
import { ethers } from "hardhat";
import { ERC20, TokenVault } from "../typechain";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // the first address is the default msg.sender
  // const [signer] = await ethers.getSigners();
  // console.log("Default signer:", signer.address);

  // // We get the contract to deploy
  // const Settings = await ethers.getContractFactory("Settings");
  // const settings = await Settings.deploy();
  // await settings.deployed();
  // console.log("Settings deployed to:", settings.address);

  // const VaultFactory = await ethers.getContractFactory("ERC721VaultFactory");
  // const vaultFactory = await VaultFactory.deploy(settings.address);
  // await vaultFactory.deployed();
  // console.log("VaultFactory deployed to:", vaultFactory.address);

  // const DummyNFT = await ethers.getContractFactory(
  //   "ERC721PresetMinterPauserAutoId"
  // );
  // const dummyNFT = await DummyNFT.deploy(
  //   "Dummy",
  //   "DMY",
  //   "co-museum.com/dummy-nft"
  // );
  // await dummyNFT.deployed();
  // console.log("DummyNFT deployed to:", dummyNFT.address);

  // dummyNFT.on(
  //   "Transfer",
  //   async (from: string, to: string, _tokenId: BigNumberish, event: Event) => {
  //     console.log("Token ID:", _tokenId);
  //     const tokenId = _tokenId;
  //     await dummyNFT.approve(vaultFactory.address, tokenId);

  //     await vaultFactory.mint(
  //       "Dummy Frac", // name
  //       "DMYF", // symbol
  //       dummyNFT.address, // token
  //       tokenId,
  //       utils.parseEther("10000"), // supply
  //       10, // listPrice
  //       0 // fee
  //     );

  //     dummyNFT.removeAllListeners();
  //   }
  // );

  // var tokenAddress = "";

  // await vaultFactory.on(
  //   "Mint",
  //   async (
  //     token: string,
  //     id: BigNumberish,
  //     listPrice: BigNumberish,
  //     vault: string,
  //     vaultId: BigNumberish,
  //     event: Event
  //   ) => {
  //     console.log("Fractionalised token address:", vault);
  //     tokenAddress = vault;
  //     vaultFactory.removeAllListeners();
  //   }
  // );

  // await dummyNFT.mint(signer.address);

  const [signer1, signer2] = await ethers.getSigners();
  console.log("Signer1 address:", signer1.address);
  console.log("Signer2 address:", signer2.address);

  const SampleERC20 = await ethers.getContractFactory("GLDToken");
  const sampleERC20 = await SampleERC20.deploy(4000000);
  await sampleERC20.deployed();
  console.log("SampleERC20 deployed to:", sampleERC20.address);

  const MembershipNFT = await ethers.getContractFactory("MembershipERC721");
  const membershipNFT = await MembershipNFT.deploy(
    "BSMY",
    "BSMY_",
    sampleERC20.address,
    "https"
  );
  await membershipNFT.deployed();
  console.log("Membership NFTs deployed to:", membershipNFT.address);

  await sampleERC20.transfer(signer2.address, 50000);
  var balanceOfSigner1 = await sampleERC20.balanceOf(signer1.address);
  var balanceOfSigner2 = await sampleERC20.balanceOf(signer2.address);
  console.log("Balance of Signer 1:", balanceOfSigner1);
  console.log("Balance of Signer 2:", balanceOfSigner2);

  await sampleERC20.connect(signer2).approve(membershipNFT.address, 100000);

  await membershipNFT.connect(signer2).redeem(2);
  console.log("NFT reedemed");

  balanceOfSigner1 = await sampleERC20.balanceOf(signer1.address);
  balanceOfSigner2 = await sampleERC20.balanceOf(signer2.address);
  console.log("Balance of Signer 1:", balanceOfSigner1);
  console.log("Balance of Signer 2:", balanceOfSigner2);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
