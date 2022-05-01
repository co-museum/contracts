# Running the local dev environment

Running `yarn hardhat node` followed by
`yarn ldeploy` should always produce the same output, reproduced below for convenience:
```
Settings deployed to: 0xd6add4444D873B4DEe4256ef1f9486ff4554A100
VaultFactory deployed to: 0xd93dF4266355432f112B8826346CE18EFF1A4EE0
DummyNFT deployed to: 0x17ee101B2BFaae3452d04F1cb2f4e671210E4cb4
Token ID: BigNumber { value: "0" }
Fractionalised token address: 0x21B99E15Fa25664487C243d3f4ab8daFB82f0707
```

After that connect to the hardhat network at `http://localhost:8545`, with a chain
ID of `31337`. Input this info into your wallet to connect to the network and create
custom tokens using the addresses listed above so you can see the relevant balances.

Make sure you're using one of the accounts specified in `hardhat.config.ts`

# Advanced Sample Hardhat Project

This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

The project comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts. It also comes with a variety of other tools, preconfigured to work with the project code.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.ts
TS_NODE_FILES=true npx ts-node scripts/deploy.ts
npx eslint '**/*.{js,ts}'
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

# Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).
