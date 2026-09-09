import { getContract, readContract, type ThirdwebContract } from 'thirdweb';
import { client, chain } from '@/lib/thirdweb';
import { CONTRACTS, FROST_DECIMALS, USDC_DECIMALS } from '@/lib/contracts';
import { frostUsdFromSqrtPriceX96, toUnits } from '@/lib/format';

const contractAt = (address: string): ThirdwebContract =>
	getContract({ client, chain, address });

// One flaky read must not blank the whole dashboard — fall back per call.
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
	try {
		return await p;
	} catch {
		return fallback;
	}
}

export interface BondMarketStat {
	label: string;
	priceUsd: number;
	discountPct: number; // fraction, e.g. 0.05
	vestingSeconds: number;
}

export interface OverviewData {
	livePriceUsd: number;
	refPriceUsd: number;
	totalSupply: number;
	marketCapUsd: number;
	totalLockedFrost: number;
	lockedPct: number; // fraction of supply
	votingWeight: number;
	polValueUsd: number; // deployed LP position + idle USDC + idle FROST
	polLpValueUsd: number; // oracle-valued deployed position alone
	polUsdc: number; // idle USDC held by the vault
	polFrost: number; // idle FROST held by the vault
	bondMarkets: BondMarketStat[];
	stale: boolean; // true if the pool price could not be read
}

export async function getOverview(): Promise<OverviewData> {
	const frost = contractAt(CONTRACTS.frost);
	const usdc = contractAt(CONTRACTS.usdc);
	const pool = contractAt(CONTRACTS.pool);
	const oracle = contractAt(CONTRACTS.oracle);
	const locker = contractAt(CONTRACTS.permaLocker);
	const usdcMkt = contractAt(CONTRACTS.usdcBondMarket);
	const lpMkt = contractAt(CONTRACTS.lpBondMarket);
	const polVault = contractAt(CONTRACTS.polVault);
	const pm = contractAt(CONTRACTS.positionManager);

	// thirdweb's readContract infers argument/return types from a *literal* method string.
	// Our helper reads uint256 getters dynamically, so call it through a narrowed signature.
	const readUint = readContract as unknown as (opts: {
		contract: ThirdwebContract;
		method: string;
		params: unknown[];
	}) => Promise<bigint>;
	const uint = (contract: ThirdwebContract, method: string, params: unknown[] = []) =>
		safe(readUint({ contract, method, params }), 0n);

	const [
		totalSupplyRaw,
		lockedFrostRaw,
		votingWeightRaw,
		refPriceRaw,
		slot0,
		token0,
		polUsdcRaw,
		polFrostRaw,
		usdcPriceRaw,
		usdcDiscountRaw,
		usdcVestRaw,
		lpPriceRaw,
		lpDiscountRaw,
		lpVestRaw,
		positionIdRaw,
	] = await Promise.all([
		uint(frost, 'function totalSupply() view returns (uint256)'),
		uint(frost, 'function balanceOf(address) view returns (uint256)', [CONTRACTS.permaLocker]),
		uint(locker, 'function totalSupply() view returns (uint256)'),
		uint(oracle, 'function frostReferencePriceUsd() view returns (uint256)'),
		safe(
			readContract({
				contract: pool,
				method:
					'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
				params: [],
			}) as Promise<readonly [bigint, number, number, number, number, number, boolean]>,
			null,
		),
		safe(
			readContract({ contract: pool, method: 'function token0() view returns (address)', params: [] }) as Promise<string>,
			CONTRACTS.usdc,
		),
		uint(usdc, 'function balanceOf(address) view returns (uint256)', [CONTRACTS.polVault]),
		uint(frost, 'function balanceOf(address) view returns (uint256)', [CONTRACTS.polVault]),
		uint(usdcMkt, 'function bondPriceUsd() view returns (uint256)'),
		uint(usdcMkt, 'function discountRate() view returns (uint256)'),
		uint(usdcMkt, 'function vestingTerm() view returns (uint256)'),
		uint(lpMkt, 'function bondPriceUsd() view returns (uint256)'),
		uint(lpMkt, 'function discountRate() view returns (uint256)'),
		uint(lpMkt, 'function vestingTerm() view returns (uint256)'),
		uint(polVault, 'function positionId() view returns (uint256)'),
	]);

	const sqrtPriceX96 = slot0 ? slot0[0] : 0n;
	const frostIsToken0 = token0.toLowerCase() === CONTRACTS.frost.toLowerCase();
	const livePriceUsd = frostUsdFromSqrtPriceX96(sqrtPriceX96, FROST_DECIMALS, USDC_DECIMALS, frostIsToken0);
	const refPriceUsd = toUnits(refPriceRaw, 18);
	const priceForValuation = livePriceUsd > 0 ? livePriceUsd : refPriceUsd;

	const totalSupply = toUnits(totalSupplyRaw, FROST_DECIMALS);
	const totalLockedFrost = toUnits(lockedFrostRaw, FROST_DECIMALS);
	const polUsdc = toUnits(polUsdcRaw, USDC_DECIMALS);
	const polFrost = toUnits(polFrostRaw, FROST_DECIMALS);

	// The deployed Uniswap V3 position IS the protocol-owned liquidity; idle USDC/FROST in the
	// vault are only what hasn't been deployed yet. Value the position through the oracle (same
	// call the treasury page uses) so the headline POL figure isn't just the idle balances.
	let polLpValueUsd = 0;
	if (positionIdRaw > 0n) {
		const pos = await safe(
			readContract({
				contract: pm,
				method:
					'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 f0, uint256 f1, uint128 owed0, uint128 owed1)',
				params: [positionIdRaw],
			}) as Promise<readonly [bigint, string, string, string, number, number, number, bigint, bigint, bigint, bigint, bigint] | null>,
			null,
		);
		if (pos) {
			const pt0 = frostIsToken0 ? CONTRACTS.frost : CONTRACTS.usdc;
			const pt1 = frostIsToken0 ? CONTRACTS.usdc : CONTRACTS.frost;
			const value = await uint(
				oracle,
				'function getUniV3PositionValue(address,address,int24,int24,uint128) view returns (uint256)',
				[pt0, pt1, Number(pos[5]), Number(pos[6]), pos[7]],
			);
			polLpValueUsd = toUnits(value, 18);
		}
	}

	return {
		livePriceUsd,
		refPriceUsd,
		totalSupply,
		marketCapUsd: totalSupply * priceForValuation,
		totalLockedFrost,
		lockedPct: totalSupply > 0 ? totalLockedFrost / totalSupply : 0,
		votingWeight: toUnits(votingWeightRaw, FROST_DECIMALS),
		polValueUsd: polLpValueUsd + polUsdc + polFrost * priceForValuation,
		polLpValueUsd,
		polUsdc,
		polFrost,
		bondMarkets: [
			{
				label: 'USDC Bond',
				priceUsd: toUnits(usdcPriceRaw, 18),
				discountPct: Number(usdcDiscountRaw) / 10_000,
				vestingSeconds: Number(usdcVestRaw),
			},
			{
				label: 'LP-NFT Bond',
				priceUsd: toUnits(lpPriceRaw, 18),
				discountPct: Number(lpDiscountRaw) / 10_000,
				vestingSeconds: Number(lpVestRaw),
			},
		],
		stale: sqrtPriceX96 <= 0n,
	};
}
