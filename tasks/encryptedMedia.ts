import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { Wallet, ethers } from "ethers";

task("task:address", "Prints the EncryptedMedia address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const encryptedMedia = await deployments.get("EncryptedMedia");
  console.log("EncryptedMedia address is " + encryptedMedia.address);
});

task("task:save-media", "Store an encrypted media reference")
  .addParam("name", "Original file name")
  .addParam("cid", "Encrypted IPFS hash generated client-side")
  .addOptionalParam("secret", "Plain address used to encrypt the cid; generates one if omitted")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers: hreEthers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const secretAddress =
      taskArguments.secret && ethers.isAddress(taskArguments.secret)
        ? taskArguments.secret
        : Wallet.createRandom().address;

    const deployment = await deployments.get("EncryptedMedia");
    console.log(`EncryptedMedia: ${deployment.address}`);
    console.log(`Secret address (plaintext): ${secretAddress}`);

    const signers = await hreEthers.getSigners();
    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signers[0].address)
      .addAddress(secretAddress)
      .encrypt();

    const contract = await hreEthers.getContractAt("EncryptedMedia", deployment.address);
    const tx = await contract
      .connect(signers[0])
      .saveMedia(taskArguments.name, taskArguments.cid, encryptedInput.handles[0], encryptedInput.inputProof);

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:decrypt-secret", "Decrypt the stored secret address for a record")
  .addParam("owner", "Owner of the record")
  .addParam("index", "Record index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers: hreEthers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("EncryptedMedia");
    const contract = await hreEthers.getContractAt("EncryptedMedia", deployment.address);
    const signers = await hreEthers.getSigners();

    const record = await contract.getMedia(taskArguments.owner, taskArguments.index);

    const clearSecret = await fhevm.userDecryptEaddress(
      FhevmType.eaddress,
      record.encryptedSecretAddress,
      deployment.address,
      signers[0],
    );

    console.log(`Encrypted handle : ${record.encryptedSecretAddress}`);
    console.log(`Decrypted address: ${clearSecret}`);
  });
