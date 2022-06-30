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
USDC: 0x663F3ad617193148711d28f5334eE4Ed07016602
USDT: 0x2E983A1Ba5e8b38AAAeC4B440B9dDcFBf72E15d1
settings: 0x8438Ad1C834623CfF278AB6829a248E37C2D7E3f
vault factory: 0xF6168876932289D073567f347121A267095f3DD6
banksy NFT: 0x94B75AA39bEC4cB15e7B9593C315aF203B7B847f
banksy token: 0x7749f632935738EA2Dd32EBEcbb8B9145E1efeF6
vote delegator: 0x4F41b941940005aE25D5ecB0F01BaDbc7065E2dD
banksy membership: 0x558785b76e29e5b9f8Bf428936480B49d71F3d76
crowdsale: 0xE8BBb5F22E6b3d6CD9157B8FD2b59C076e57a9Fc
```

After that connect to the hardhat network at `http://localhost:8545`, with a chain
ID of `31337`. Input this info into your wallet to connect to the network and create custom tokens using the addresses listed above so you can see the relevant balances.

Make sure you're using one of the accounts specified in `hardhat.config.ts`

## Install

```
git clone https://github.com/co-museum/fractional.git
cd co-museum-contracts && yarn install
```

## Scripts

```
yarn prettier-action
yarn prettier-check
yarn test
yarn test:coverage
yarn test:gas
yarn deploy-test
```
