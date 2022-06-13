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

  const DummyNFT = await ethers.getContractFactory("ERC721Mock");
  const dummyNFT = await DummyNFT.deploy("Dummy", "DMY");
  await dummyNFT.deployed();
  console.log("DummyNFT deployed to:", dummyNFT.address);

  const MockUSDC = await ethers.getContractFactory("ERC20Mock");
  const mockUSDC = await MockUSDC.deploy(
    "Usdc",
    "USDC",
    signer.address,
    ethers.utils.parseEther("1000000")
  );
  await mockUSDC.deployed();

  const MockUSDT = await ethers.getContractFactory("ERC20Mock");
  const mockUSDT = await MockUSDT.deploy(
    "Usdt",
    "USDT",
    signer.address,
    ethers.utils.parseEther("1000000")
  );
  await mockUSDT.deployed();

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

      const TimedAllowanceCrowdsale = await ethers.getContractFactory("TimedAllowanceCrowdsale")
      const timedAllowanceCrowdsale = await TimedAllowanceCrowdsale.deploy(
        1, signer.address, vault,
        mockUSDC.address, mockUSDT.address,
        signer.address, Date.now(), Date.now() + 20
      )
      await timedAllowanceCrowdsale.deployed()
      console.log("Crowdsale address:", timedAllowanceCrowdsale.address)


      const MembershipERC721 = await ethers.getContractFactory("MembershipERC721")
      const membershipERC721 = await MembershipERC721.deploy("Member", "MEM", vault, 2, 4, 6)
      await membershipERC721.deployed()
      console.log("Membership ERC721 address:", membershipERC721.address)

      vaultFactory.removeAllListeners()
    }
  )

  await dummyNFT.mint(signer.address, 0)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
