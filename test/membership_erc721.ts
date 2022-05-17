import { expect } from "chai";
import { MockProvider } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ERC20Mock } from "../typechain";
import { MembershipERC721 } from "../typechain/MembershipERC721";

describe("MembershipERC721", function () {
  let mockERC20: ERC20Mock;
  let membershipERC721: MembershipERC721;

  this.beforeEach(async function () {
    const [signer] = await ethers.getSigners()

    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockERC20 = await MockERC20.deploy(
      "Mock", "MCK", signer.address, ethers.utils.parseEther("44400")
    )
    await mockERC20.deployed()

    const MembershipERC721 = await ethers.getContractFactory("MembershipERC721");
    membershipERC721 = await MembershipERC721.deploy(
      "Membership", "MBR", mockERC20.address, "https://example.com"
    );
    await membershipERC721.deployed();
  })

  it("should reedeem genesis", async function () {
    const [signer, user] = await ethers.getSigners()
    const amt = ethers.utils.parseEther("40000")

    mockERC20.transfer(user.address, amt)
    mockERC20.approve(membershipERC721.address, amt)

    await membershipERC721.redeemGenesis()
  });
});
