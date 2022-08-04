import * as dotenv from 'dotenv'

import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import '@primitivefi/hardhat-dodoc'
import { BigNumber, ethers } from 'ethers'
import { NonceManager } from '@ethersproject/experimental'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Address } from 'cluster'
import '@nomiclabs/hardhat-ethers'
// import './tasks'

dotenv.config()

const samplePrivateKeyList = [
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0xaadf192f17e2a1674414417e85a95a5f916d2a1cc369eaed76fb80ba1dd1bdfa',
]

const accounts =
  process.env.ACCOUNT_ONE !== undefined &&
  process.env.ACCOUNT_TWO !== undefined &&
  process.env.ACCOUNT_THREE !== undefined &&
  process.env.ACCOUNT_FOUR !== undefined
    ? [
        `0x${process.env.ACCOUNT_ONE}`,
        `0x${process.env.ACCOUNT_TWO}`,
        `0x${process.env.ACCOUNT_THREE}`,
        `0x${process.env.ACCOUNT_FOUR}`,
      ]
    : samplePrivateKeyList

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts: [
        {
          // governance
          privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
          balance: '100000000000000000000000000',
        },
        {
          // curator
          privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
          balance: '100000000000000000000000000',
        },
        {
          // buyer
          privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
          balance: '100000000000000000000000000',
        },

        {
          privateKey: '0xaadf192f17e2a1674414417e85a95a5f916d2a1cc369eaed76fb80ba1dd1bdfa',
          balance: '100000000000000000000000000',
        },
        {
          privateKey: '0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd',
          balance: '100000000000000000000000000',
        },
        {
          privateKey: '0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0',
          balance: '100000000000000000000000000',
        },
        {
          privateKey: '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e',
          balance: '100000000000000000000000000',
        },
        {
          privateKey: 'd9ad1f3066623fc6d5e2edc230bfa475bb9c3fa011e1686f7af2a26284bce777',
          balance: '100000000000000000000000000',
        },
      ],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
      accounts: samplePrivateKeyList,
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || '',
      accounts: accounts,
    },

    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: accounts,
      // gas: 50000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
}

export default config
