// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { BigNumberish, utils } from "ethers";
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // the first address is the default msg.sender
  console.log("\n\n");
  const [signer, user1, user2, wallet] = await ethers.getSigners()
  console.log("Default signer:", signer.address)
  console.log("User1:", user1.address)
  console.log("User2:", user2.address)
  console.log("Wallet:", wallet.address)

  // We get the contract to deploy
  const SampleBKLN = await ethers.getContractFactory("BKLNToken");
  const sampleBKLN = await SampleBKLN.deploy(4000000 * 10 **6);
  await sampleBKLN.deployed();
  await sampleBKLN.transfer(wallet.address, 4000000 * 10 **6)
  console.log("sampleBKLN contract deployed to:", sampleBKLN.address);
  var defaultSignerBKLNBalance = await sampleBKLN.balanceOf(signer.address)
  var walletBKLNBalance = await sampleBKLN.balanceOf(wallet.address)
  console.log("sampleBKLN balance of default signer:", defaultSignerBKLNBalance);
  console.log("sampleBKLN balance of wallet:", walletBKLNBalance);
  console.log("\n\n");


  // mock USDC token and distribute amongst two users
  const USDCToken = await ethers.getContractFactory("USDCToken");
  const usdcToken = await USDCToken.connect(user1).deploy(4000000 * 10 **6);
  await usdcToken.deployed();
  console.log("usdcToken contract deployed to:", usdcToken.address);
  var user1USDCBalance = await usdcToken.balanceOf(user1.address)
  console.log("user1USDCBalance:", user1USDCBalance);
  console.log("transferring half of USDC to user2");
  await usdcToken.connect(user1).transfer(user2.address, 2000000000000)
  user1USDCBalance = await usdcToken.balanceOf(user1.address);
  var user2USDCBalance = await usdcToken.balanceOf(user2.address);
  console.log("user1USDCBalance:", user1USDCBalance);
  console.log("user2USDCBalance:", user2USDCBalance);
  console.log("\n\n");

   // mock USDC token and distribute amongst two users
   const KycContract = await ethers.getContractFactory("KycContract");
   const kycContract = await KycContract.deploy();
   await kycContract.deployed();
   console.log("\n\n");

    // mock USDC token and distribute amongst two users
    const TimedAllowanceCrowdsale = await ethers.getContractFactory("TimedAllowanceCrowdsale");
    const timedAllowanceCrowdsale = await TimedAllowanceCrowdsale.deploy(1, wallet.address, sampleBKLN.address, usdcToken.address, wallet.address,
        Date.now(), Date.now() * 2, kycContract.address);
    await timedAllowanceCrowdsale.deployed();
    console.log("\n\n");

     // crowdsale demo
     await kycContract.setKycCompleted(user1.address)
     await usdcToken.connect(user1).approve(timedAllowanceCrowdsale.address, 1000000000000)
     await sampleBKLN.connect(wallet).approve(timedAllowanceCrowdsale.address, 4000000000000)
     await timedAllowanceCrowdsale.connect(user1).buyTokens(user1.address, 1000000000000)
     user1USDCBalance = await usdcToken.balanceOf(user1.address);
     console.log("user1USDCBalance:", user1USDCBalance);
     var user1BLKNBalance = await sampleBKLN.balanceOf(user1.address);
     console.log("user1BLKNBalance:", user1BLKNBalance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
