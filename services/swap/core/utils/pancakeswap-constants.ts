// PancakeSwap V2 constants - matches tiwi-test implementation exactly

import { type Address, getAddress } from 'viem';

// PancakeSwap V2 Factory addresses (properly checksummed)
export const PANCAKESWAP_V2_FACTORY: Record<number, Address> = {
  1: getAddress('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'), // Ethereum Mainnet
  42161: getAddress('0xf1D7CC64Fb4452F05c498126312eBE29f30Fb000'), // Arbitrum (SushiSwap)
  10: getAddress('0xc35DADB65012eC5796536bD9864eD8773aBc74C4'), // Optimism (SushiSwap)
  137: getAddress('0xc35DADB65012eC5796536bD9864eD8773aBc74C4'), // Polygon (SushiSwap)
  8453: getAddress('0x71524B4f93c58fcbF659783284E38825f0622859'), // Base (SushiSwap)
  56: getAddress('0xcA143Ce32Fe78f1f7019d7d551a6402fC4550CDc'), // BSC (PancakeSwap)
};

// PancakeSwap V2 Router02 addresses (properly checksummed)
export const PANCAKESWAP_V2_ROUTER: Record<number, Address> = {
  1: getAddress('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'), // Ethereum Mainnet
  42161: getAddress('0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'), // Arbitrum (SushiSwap)
  10: getAddress('0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'), // Optimism (SushiSwap)
  137: getAddress('0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'), // Polygon (SushiSwap)
  8453: getAddress('0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891'), // Base (SushiSwap)
  56: getAddress('0x10ED43C718714eb63d5aA57B78B54704E256024E'), // BSC (PancakeSwap)
};

// WETH addresses (properly checksummed)
export const WETH_ADDRESSES: Record<number, Address> = {
  1: getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'), // Ethereum WETH
  42161: getAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'), // Arbitrum WETH
  10: getAddress('0x4200000000000000000000000000000000000006'), // Optimism WETH
  137: getAddress('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'), // Polygon WMATIC
  8453: getAddress('0x4200000000000000000000000000000000000006'), // Base WETH
  56: getAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'), // BSC WBNB
};

