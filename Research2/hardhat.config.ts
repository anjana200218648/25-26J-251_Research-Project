import "dotenv/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    version: "0.8.28",
    settings: {
      // Ganache sometimes fails with newer EVM targets (e.g. cancun) → invalid opcode.
      // Force an older, widely supported target.
      evmVersion: "istanbul",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    ganache: {
      type: "http",
      chainType: "l1",
      url: process.env.GANACHE_RPC_URL ?? "http://127.0.0.1:7545",
      // Default: use Ganache's unlocked RPC accounts (funded).
      // Opt-in to local signing with a specific key by setting GANACHE_USE_PRIVATE_KEY=1.
      accounts:
        process.env.GANACHE_USE_PRIVATE_KEY === "1" && process.env.GANACHE_PRIVATE_KEY
          ? [process.env.GANACHE_PRIVATE_KEY]
          : undefined,
    },
  },
});
