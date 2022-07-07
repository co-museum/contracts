import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { CoMuseumGenesis, ERC20Mock } from "../typechain";

describe("CoMuseum Genesis", () => {

  let coMuseumGenesisERC721: CoMuseumGenesis;
  let signer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [signer, user] = await ethers.getSigners()

    
    const CoMuseumGenesisERC721 = await ethers.getContractFactory("CoMuseumGenesis");
    coMuseumGenesisERC721 = await CoMuseumGenesisERC721.deploy(
    signer.address
    );
    await coMuseumGenesisERC721.deployed();

  })

  describe("airdrop", () => {

    it("can airdrop ", async () => {
    
    });

    it("redeems foundation", async () => {
    });

    it("redeems friend", async () => {
    });
  })
});
