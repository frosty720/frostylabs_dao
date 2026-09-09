import { contractAt, readUint, readAddress, readAny } from '@/lib/contract';
import { CONTRACTS, ERC20_BOND_MARKETS, LP_BOND_MARKETS } from '@/lib/contracts';
import { toUnits, shortAddress } from '@/lib/format';

export interface Erc20BondDetail {
	key: 'erc20';
	address: string;
	label: string; // e.g. "USDC Bond" / "WETH Bond"
	priceUsd: number; // current bond price, USD per FROST
	discountBps: number; // raw bps (e.g. 500 = 5%)
	vestingSeconds: number;
	principalToken: string; // the asset bonded
	principalSymbol: string; // e.g. "USDC" / "WETH"
	principalDecimals: number; // 6 for USDC, 18 for WETH
	minPurchase: number; // whole principal tokens
}

export interface LpBondDetail {
	key: 'lp';
	address: string;
	label: string; // e.g. "FROST/USDC Bond"
	pairLabel: string; // e.g. "FROST/USDC"
	priceUsd: number;
	discountBps: number;
	vestingSeconds: number;
	// Pool identity the position picker filters on (lowercased addresses, numeric fee).
	token0: string;
	token1: string;
	fee: number;
}

export interface BondMarkets {
	erc20s: Erc20BondDetail[];
	lps: LpBondDetail[];
}

async function getErc20Market(address: string): Promise<Erc20BondDetail> {
	const m = contractAt(address);
	const [price, discount, vest, min, principal] = await Promise.all([
		readUint(m, 'function bondPriceUsd() view returns (uint256)'),
		readUint(m, 'function discountRate() view returns (uint256)'),
		readUint(m, 'function vestingTerm() view returns (uint256)'),
		readUint(m, 'function minimumPurchaseAmount() view returns (uint256)'),
		readAddress(m, 'function principalToken() view returns (address)'),
	]);

	const token = contractAt(principal);
	const [symbol, decimals] = await Promise.all([
		readAny<string>(token, 'function symbol() view returns (string)', [], shortAddress(principal)),
		readUint(token, 'function decimals() view returns (uint8)'),
	]);
	const dec = Number(decimals) || 18;

	return {
		key: 'erc20',
		address,
		label: `${symbol} Bond`,
		priceUsd: toUnits(price, 18),
		discountBps: Number(discount),
		vestingSeconds: Number(vest),
		principalToken: principal,
		principalSymbol: symbol,
		principalDecimals: dec,
		minPurchase: toUnits(min, dec),
	};
}

async function getLpMarket(address: string): Promise<LpBondDetail> {
	const m = contractAt(address);
	const [price, discount, vest, token0, token1, fee] = await Promise.all([
		readUint(m, 'function bondPriceUsd() view returns (uint256)'),
		readUint(m, 'function discountRate() view returns (uint256)'),
		readUint(m, 'function vestingTerm() view returns (uint256)'),
		readAddress(m, 'function token0() view returns (address)'),
		readAddress(m, 'function token1() view returns (address)'),
		readUint(m, 'function poolFee() view returns (uint24)'),
	]);

	const [sym0, sym1] = await Promise.all([
		readAny<string>(contractAt(token0), 'function symbol() view returns (string)', [], shortAddress(token0)),
		readAny<string>(contractAt(token1), 'function symbol() view returns (string)', [], shortAddress(token1)),
	]);

	// Display the pair with the stablecoin (USDC) second — "FROST/USDC" reads better than the
	// address-sorted "USDC/FROST".
	const usdc = CONTRACTS.usdc.toLowerCase();
	const pairLabel = token0.toLowerCase() === usdc ? `${sym1}/${sym0}` : `${sym0}/${sym1}`;

	return {
		key: 'lp',
		address,
		label: `${pairLabel} Bond`,
		pairLabel,
		priceUsd: toUnits(price, 18),
		discountBps: Number(discount),
		vestingSeconds: Number(vest),
		token0: token0.toLowerCase(),
		token1: token1.toLowerCase(),
		fee: Number(fee),
	};
}

export async function getBondMarkets(): Promise<BondMarkets> {
	const [erc20s, lps] = await Promise.all([
		Promise.all(ERC20_BOND_MARKETS.map((a) => getErc20Market(a))),
		Promise.all(LP_BOND_MARKETS.map((a) => getLpMarket(a))),
	]);
	return { erc20s, lps };
}
