// scripts/deploy.js
// Hardhat v3 + ESM deploy script (Ganache-ready)

import dotenv from "dotenv";
import { network } from "hardhat";
import { fileURLToPath } from "url";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

async function main() {
  const contractName = process.env.CONTRACT_NAME || "ReportNotary";
  const { ethers } = await network.connect();

  const net = await ethers.provider.getNetwork();
  const pk = process.env.GANACHE_PRIVATE_KEY;
  const deployer =
    net.name === "ganache"
      ? await ethers.provider.getSigner(
          Number(process.env.GANACHE_SIGNER_INDEX ?? 0),
        )
      : pk
        ? new ethers.Wallet(pk, ethers.provider)
        : (await ethers.getSigners())[0];

  if (!deployer) {
    throw new Error(
      "No deployer signer available. Set GANACHE_PRIVATE_KEY in .env or configure accounts in hardhat.config.ts.",
    );
  }

  console.log("Network:", net.name);
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", balance.toString());

  const Factory = await ethers.getContractFactory(contractName, deployer);
  const contract = await Factory.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("Contract deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });