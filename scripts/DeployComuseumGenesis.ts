import { ethers } from "hardhat";


async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const recieverAddress = "0x3e3dcca9c8022d777241E3A105E3C98E467C043b"
  const ComuseumGenesis = await ethers.getContractFactory("ComuseumGenesis");
  const comuseumGenesis = await ComuseumGenesis.deploy(recieverAddress);

  await comuseumGenesis.deployed();

  console.log("Comuseum Genesis deployed to:", comuseumGenesis.address);

  await comuseumGenesis.setDefaultRoyalty(recieverAddress, "500")

  console.log("Default royalty percentage set:", 5);

  await comuseumGenesis.setBaseURI("https://test.com/");

  console.log("Base URI set to https://test.com/"); 
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
