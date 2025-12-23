import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedEncryptedMedia = await deploy("EncryptedMedia", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedMedia contract: `, deployedEncryptedMedia.address);
};
export default func;
func.id = "deploy_encrypted_media"; // id required to prevent reexecution
func.tags = ["EncryptedMedia"];
