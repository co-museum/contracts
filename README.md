# Co-Museum Contracts

[![Tests](https://github.com/co-museum/fractional/actions/workflows/main.yml/badge.svg)](https://github.com/co-museum/fractional/actions/workflows/main.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<h1 align="center">
  <br>
  <a href="https://www.co-museum.com/" target="_blank"><img src=".github/logo.png" alt="Co-Museum Contracts" width="300"></a>
  <br>
  <br>
</h1>

This repository contains the smart contracts for the Co-Museum project.

## Running the local dev environment

Running `yarn hardhat node` followed by
`yarn deploy-test` should always produce the same output, reproduced below for convenience:

```
To be filled...
```

After that connect to the hardhat network at `http://localhost:8545`, with a chain
ID of `31337`. Input this info into your wallet to connect to the network and create custom tokens using the addresses listed above so you can see the relevant balances.

Make sure you're using one of the accounts specified in `hardhat.config.ts`

## Install

```
git clone https://github.com/co-museum/fractional.git
cd co-museum-contracts && yarn install
```

### Scripts

```
yarn prettier-action
yarn prettier-check
yarn test
yarn test:coverage
yarn test:gas
yarn deploy-test
```
