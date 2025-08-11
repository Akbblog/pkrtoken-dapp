# PKRtoken dApp (Vite + Ethers v6)

Live: https://pkrtokens.netlify.app

## Features
- Connect wallet (MetaMask), auto network switch to Sepolia
- Show name/symbol/decimals/total supply/owner; show user balance
- Transfer, owner-only mint, burn
- Status shows clickable Etherscan tx links

## Setup
```bash
cp .env.example .env   # set the contract address
npm ci
npm run dev
