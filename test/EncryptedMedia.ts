import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Wallet } from "ethers";
import { ethers, fhevm } from "hardhat";
import { EncryptedMedia, EncryptedMedia__factory } from "../types";

type Signers = {
  owner: HardhatEthersSigner;
  viewer: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedMedia")) as EncryptedMedia__factory;
  const contract = (await factory.deploy()) as EncryptedMedia;
  const address = await contract.getAddress();

  return { contract, address };
}

describe("EncryptedMedia", function () {
  let signers: Signers;
  let contract: EncryptedMedia;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], viewer: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    const deployed = await deployFixture();
    contract = deployed.contract;
    contractAddress = deployed.address;
  });

  it("stores a record and lets the owner decrypt the secret address", async function () {
    const secretWallet = Wallet.createRandom();
    const encryptedAddressInput = await fhevm
      .createEncryptedInput(contractAddress, signers.owner.address)
      .addAddress(secretWallet.address)
      .encrypt();

    const encryptedCid = ethers.hexlify(ethers.randomBytes(32));
    await contract
      .connect(signers.owner)
      .saveMedia("sample.mp4", encryptedCid, encryptedAddressInput.handles[0], encryptedAddressInput.inputProof);

    const count = await contract.getMediaCount(signers.owner.address);
    expect(count).to.eq(1n);

    const stored = await contract.getMedia(signers.owner.address, 0);
    expect(stored.fileName).to.eq("sample.mp4");
    expect(stored.encryptedCid).to.eq(encryptedCid);
    expect(stored.encryptedSecretAddress).to.not.eq(ethers.ZeroHash);

    const handle = ethers.toBeHex(stored.encryptedSecretAddress, 32);
    const decryptedAddress = await fhevm.userDecryptEaddress(handle, contractAddress, signers.owner);
    expect(decryptedAddress).to.eq(secretWallet.address);
  });

  it("allows sharing decryption permissions with another wallet", async function () {
    const secretWallet = Wallet.createRandom();
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.owner.address)
      .addAddress(secretWallet.address)
      .encrypt();

    await contract
      .connect(signers.owner)
      .saveMedia("clip.mov", "0xfeed", encryptedInput.handles[0], encryptedInput.inputProof);

    await expect(
      contract.connect(signers.owner).grantDecryptionAccess(signers.owner.address, 0, signers.viewer.address),
    ).to.not.be.reverted;

    const stored = await contract.getMedia(signers.owner.address, 0);
    const handle = ethers.toBeHex(stored.encryptedSecretAddress, 32);
    const decryptedByViewer = await fhevm.userDecryptEaddress(handle, contractAddress, signers.viewer);

    expect(decryptedByViewer).to.eq(secretWallet.address);
  });
});
