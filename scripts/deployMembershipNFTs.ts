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

  // await sampleERC20.connect(membershipNFT.address).approve(signer2.address, 100000);
  await membershipNFT.connect(signer2).release(2,0);
  console.log("NFT released");

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
