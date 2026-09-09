// Deployed protocol addresses. Base Sepolia (chain 84532) — the current testnet deployment.
// Source of truth: frosty-core_OG/README.md "Deployments → Base Sepolia" + on-chain verification.
// When mainnet ships, add an 8453 map and select by CHAIN_ID.

import { CHAIN_ID } from '@/lib/thirdweb';

type Address = `0x${string}`;

const BASE_SEPOLIA = {
	frost: '0x090a3af9b5f1c5078b7178275eb3e53b857474e4',
	oracle: '0x74adbc5c256007a15891bcc4633ebd60cc155dd4',
	permaLocker: '0xbf91dfcca99fa4b95ea90cea2723a277ef46c504',
	permaLockerVotes: '0x7c4fe779a211dbf983e6f6e6d2df878affa14dab',
	timelock: '0x3dfa6b8a45703de4d9f0a1eb3f13f81fdfce9357',
	governor: '0x5622dadb36543e81fd8ec9959bddd93b30504d70',
	bondController: '0x9a20dc88bfd99414e947cd39b873d427d69fdb0c',
	bondFactory: '0x55a98236af5715c631bea83dd254032bc4c9a3de',
	feeDistributor: '0xeeb0a3a3a4337e7947b6772034c904728857a0cb',
	polVault: '0x7fa14d1467c3ea5fe763326f16c9805e257e4efc',
	devRewards: '0xb73057d7de0992a8c44467a2e4e9f4f73e54dca8',
	splitter: '0x005848e398495f85b7c0fb18acfd8eeab61bb3b9',
	subscriptionV3: '0x99aa0624168dcd06f64bb63e32aa15848d6d7d6d',
	subscriptionRewards: '0xdcaf54b5c4a78e10e1b7a7eddfddfb46d1b5a997',
	usdcBondMarket: '0x3405e253b82b1f503a07156a50ebddbe242cf3ed', // PolBondMarketV2: TWAP-floored pricing + idle routing
	usdcBondMarketV1: '0xbd2d65bfddbd220572121f9d2042006e21181da5', // claim-only legacy, see LEGACY_BOND_MARKETS
	wethBondMarket: '0x73455521a3d12725cceaa0bbfc2b0663b0a46636', // Erc20BondMarketV2: TWAP-floored pricing
	wethBondMarketV1: '0xd593e7b7679891a2806c1f4c2f901a44aa5e5722', // paused legacy, see LEGACY_BOND_MARKETS
	lpBondMarket: '0x02cd84daa90bf58c9278a1d0fee4e04c09c5c52e', // UniswapV3NFTBondMarketV2: TWAP-floored pricing
	lpBondMarketV1: '0x23e64970b3c37e1008b0d6460b03a510aef2f04b', // paused legacy, see LEGACY_BOND_MARKETS
	linkUsdcBondMarket: '0xd0bd3b5267fc4a03359c2cad5f5939557a063be3', // UniswapV3NFTBondMarketV2: TWAP-floored pricing
	linkUsdcBondMarketV1: '0xf4f62ec5c9d4e5464a9d1dd738e3f50b1d652101', // paused legacy, see LEGACY_BOND_MARKETS
	pool: '0x8D3CD1e76E493f51E6b247Bb46a6E94a21076813',
	usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
	weth: '0x4200000000000000000000000000000000000006',
	positionManager: '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2',
} satisfies Record<string, Address>;

const REGISTRY: Record<number, typeof BASE_SEPOLIA> = {
	84532: BASE_SEPOLIA,
};

export const CONTRACTS = REGISTRY[CHAIN_ID] ?? BASE_SEPOLIA;
export type ContractKey = keyof typeof BASE_SEPOLIA;

// Active LP-NFT bond markets, rendered one card each on /bonds. Only list markets whose
// (token0, token1) match Uniswap's canonical order; a misordered market rejects every
// position (see project_lp_bond_token_order_bug).
//
// EMPTY since 2026-09-02 (markets paused on-chain): LP bonds are structurally unattractive
// under market-accurate (TWAP-floored) payout pricing — the oracle discards the position's
// FROST leg by design, so a bonder receives ~52% of position value at BEST (proven in
// frosty-core test/fork/ProtocolPitfallsFork.t.sol P4). Contracts stay deployed; relist
// here only if the crediting design changes.
export const LP_BOND_MARKETS: readonly Address[] = [];

// Active ERC-20 bond markets (single-token principal, bought with `purchaseBond(amount)`), one
// buy card each on /bonds. Add a new market address here when a fresh ERC-20 bond is deployed
// (e.g. WETH, a stablecoin, WBTC) — the UI reads the principal token/decimals/symbol on-chain,
// so no other change is needed.
export const ERC20_BOND_MARKETS: readonly Address[] = [CONTRACTS.usdcBondMarket, CONTRACTS.wethBondMarket];

// Retired markets that still hold open bonds: no buy card, but "Your Bonds" keeps reading them so
// vesting positions stay claimable in the UI. Remove an entry once its last open bond is redeemed
// (then retire on-chain: unpause if needed → claims → removeMarket).
export const LEGACY_BOND_MARKETS: readonly { address: Address; label: string }[] = [
	{ address: CONTRACTS.usdcBondMarketV1, label: 'USDC Bond (legacy)' },
	{ address: CONTRACTS.wethBondMarketV1, label: 'WETH Bond (legacy)' },
	{ address: CONTRACTS.lpBondMarketV1, label: 'FROST/USDC LP (legacy)' },
	{ address: CONTRACTS.linkUsdcBondMarketV1, label: 'LINK/USDC LP (legacy)' },
];

// Token decimals used across reads/formatting.
export const FROST_DECIMALS = 18;
export const USDC_DECIMALS = 6;
