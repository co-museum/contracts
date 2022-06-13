// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const recieverAddress = "0x3e3dcca9c8022d777241E3A105E3C98E467C043b"
  const ComuseumGenesis = await hre.ethers.getContractFactory("ComuseumGenesis");
  const comuseumGenesis = await ComuseumGenesis.deploy(recieverAddress);

  await comuseumGenesis.deployed();

  console.log("Comuseum Genesis deployed to:", comuseumGenesis.address);

  await comuseumGenesis.setDefaultRoyalty(recieverAddress, "500")

  console.log("Default royalty percentage set:", 5);

  await comuseumGenesis.setBaseURI("https://minting-pipeline-openedition.herokuapp.com/");

  console.log("Base URI set to https://minting-pipeline-openedition.herokuapp.com/");

  await comuseumGenesis.devMintSeries(5);

  console.log("5 NFTs minted to dev address");
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
