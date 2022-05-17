import { expect } from "chai";
import { MockProvider } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ERC20Mock } from "../typechain";
import { MembershipERC721 } from "../typechain/MembershipERC721";

describe("MembershipERC721", () => {
  let mockERC20: ERC20Mock;
  let membershipERC721: MembershipERC721;

  beforeEach(async () => {
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

  it("should redeem genesis", async () => {
    const [_, user] = await ethers.getSigners()
    const amt = ethers.utils.parseUnits("40000", await mockERC20.decimals())

    mockERC20.connect(user).approve(
      membershipERC721.address,
      ethers.constants.MaxUint256,
    )
    mockERC20.transfer(user.address, amt)

    await membershipERC721.connect(user).redeemGenesis()
    expect(await mockERC20.balanceOf(user.address)).to.be.equal(0, "not locking correct amount of ERC20")
    expect(await membershipERC721.balanceOf(user.address)).to.be.equal(1, "not transferring membership NFT")
  });
});
