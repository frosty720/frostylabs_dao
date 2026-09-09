import { getContractEvents, prepareEvent, prepareContractCall, simulateTransaction, type ThirdwebContract } from 'thirdweb';
import { getRpcClient, eth_blockNumber } from 'thirdweb/rpc';
import { contractAt, readUint, readAny, safe } from '@/lib/contract';
import { client, chain } from '@/lib/thirdweb';
import { CONTRACTS, FROST_DECIMALS, USDC_DECIMALS } from '@/lib/contracts';
import { frostUsdFromSqrtPriceX96, uniV3PositionAmounts, toUnits } from '@/lib/format';

export interface TreasuryData {
	polUsdc: number;
	polFrost: number;
	positionId: string;
	totalUsdcDeployed: number;
	totalFrostBought: number;
	distributeBps: number;
	lpValueUsd: number; // oracle-marked PolVault position: FROST leg $0, floor-priced USDC leg, 10% haircut
	lpSpotValueUsd: number; // same position at the live pool price (0 if none)
	// Trading fees earned by the POL position. "Uncollected" is live (simulated collect);
	// "lifetime" sums every FeesCompounded harvest. USD legs are valued at the current price.
	uncollectedUsdc: number;
	uncollectedFrost: number;
	uncollectedUsd: number;
	lifetimeFeesUsdc: number;
	lifetimeFeesFrost: number;
	lifetimeFeesUsd: number;
	// FROST/USDC pool depth
	poolUsdc: number;
	poolFrost: number;
	livePriceUsd: number;
	poolTvlUsd: number;
}

// publicnode caps eth_getLogs at 50k blocks per call (same limits as lib/reads/governance.ts).
const CHUNK = 50_000n;
const FROM_BLOCK = BigInt(process.env.NEXT_PUBLIC_GOV_FROM_BLOCK ?? '45400000');
const MAX_UINT128 = (1n << 128n) - 1n;

const feesCompounded = prepareEvent({
	signature: 'event FeesCompounded(uint256 indexed positionId, uint256 amount0, uint256 amount1)',
});

/**
 * Fees sitting in the position right now, exactly as a harvest would collect them.
 * `positions().tokensOwed` goes stale between pokes, so instead we eth_call the position
 * manager's `collect` impersonating the vault (the NFT owner) — the node runs the real
 * fee accounting and returns what a harvest would pay out, without sending anything.
 */
async function getUncollectedFees(pm: ThirdwebContract, positionId: bigint): Promise<readonly [bigint, bigint]> {
	const tx = prepareContractCall({
		contract: pm,
		method:
			'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)',
		params: [{ tokenId: positionId, recipient: CONTRACTS.polVault, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
	});
	const res = await safe(
		simulateTransaction({ transaction: tx, from: CONTRACTS.polVault }) as Promise<unknown>,
		[0n, 0n] as const,
	);
	if (Array.isArray(res)) return [res[0] as bigint, res[1] as bigint];
	const obj = res as { amount0?: bigint; amount1?: bigint };
	return [obj.amount0 ?? 0n, obj.amount1 ?? 0n];
}

/**
 * Sum every FeesCompounded harvest the vault has ever emitted. Dual-source merge for the
 * same reason as governance: thirdweb Insight has full history but lags the head a few
 * minutes, while a direct RPC scan of the recent tail sees a just-run harvest immediately.
 */
async function getLifetimeFees(polVault: ThirdwebContract): Promise<readonly [bigint, bigint]> {
	const rpc = getRpcClient({ client, chain });
	const latest = await safe(eth_blockNumber(rpc), FROM_BLOCK);

	const indexed = safe(
		getContractEvents({ contract: polVault, events: [feesCompounded], fromBlock: FROM_BLOCK, useIndexer: true }),
		[] as Awaited<ReturnType<typeof getContractEvents>>,
	);

	const TAIL = 100_000n;
	const tailFrom = latest > FROM_BLOCK + TAIL ? latest - TAIL : FROM_BLOCK;
	const tailScans: Promise<Awaited<ReturnType<typeof getContractEvents>>>[] = [];
	for (let from = tailFrom; from <= latest; from += CHUNK) {
		const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
		tailScans.push(
			safe(
				getContractEvents({ contract: polVault, events: [feesCompounded], fromBlock: from, toBlock: to, useIndexer: false }),
				[] as Awaited<ReturnType<typeof getContractEvents>>,
			),
		);
	}

	const [indexedEvents, ...tailChunks] = await Promise.all([indexed, ...tailScans]);
	const byLog = new Map<string, (typeof indexedEvents)[number]>();
	for (const e of [...indexedEvents, ...tailChunks.flat()]) {
		byLog.set(`${e.transactionHash}:${e.logIndex}`, e);
	}

	let fees0 = 0n;
	let fees1 = 0n;
	for (const e of byLog.values()) {
		const args = e.args as { amount0: bigint; amount1: bigint };
		fees0 += args.amount0;
		fees1 += args.amount1;
	}
	return [fees0, fees1];
}

export async function getTreasury(): Promise<TreasuryData> {
	const frost = contractAt(CONTRACTS.frost);
	const usdc = contractAt(CONTRACTS.usdc);
	const polVault = contractAt(CONTRACTS.polVault);
	const pool = contractAt(CONTRACTS.pool);
	const oracle = contractAt(CONTRACTS.oracle);
	const pm = contractAt(CONTRACTS.positionManager);

	const [polUsdcRaw, polFrostRaw, positionId, deployedRaw, boughtRaw, distributeBps, poolUsdcRaw, poolFrostRaw, slot0, token0] =
		await Promise.all([
			readUint(usdc, 'function balanceOf(address) view returns (uint256)', [CONTRACTS.polVault]),
			readUint(frost, 'function balanceOf(address) view returns (uint256)', [CONTRACTS.polVault]),
			readUint(polVault, 'function positionId() view returns (uint256)'),
			readUint(polVault, 'function totalUsdcDeployed() view returns (uint256)'),
			readUint(polVault, 'function totalFrostBought() view returns (uint256)'),
			readUint(polVault, 'function distributeBps() view returns (uint16)'),
			readUint(usdc, 'function balanceOf(address) view returns (uint256)', [CONTRACTS.pool]),
			readUint(frost, 'function balanceOf(address) view returns (uint256)', [CONTRACTS.pool]),
			readAny<readonly [bigint, number, number, number, number, number, boolean] | null>(
				pool,
				'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
				[],
				null,
			),
			readAny<string>(pool, 'function token0() view returns (address)', [], CONTRACTS.usdc),
		]);

	const sqrtPriceX96 = slot0 ? slot0[0] : 0n;
	const frostIsToken0 = token0.toLowerCase() === CONTRACTS.frost.toLowerCase();
	const livePriceUsd = frostUsdFromSqrtPriceX96(sqrtPriceX96, FROST_DECIMALS, USDC_DECIMALS, frostIsToken0);

	const lifetimePromise = getLifetimeFees(polVault);

	// Value PolVault's LP position through the oracle, if it holds one.
	let lpValueUsd = 0;
	let lpSpotValueUsd = 0;
	let owed: readonly [bigint, bigint] = [0n, 0n];
	if (positionId > 0n) {
		const [pos, owedRes] = await Promise.all([
			readAny<Record<string, unknown> | readonly unknown[] | null>(
				pm,
				'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 f0, uint256 f1, uint128 owed0, uint128 owed1)',
				[positionId],
				null,
			),
			getUncollectedFees(pm, positionId),
		]);
		owed = owedRes;
		if (pos) {
			const arr = pos as Record<string, unknown> & { tickLower?: number; tickUpper?: number; liquidity?: bigint };
			const tickLower = Array.isArray(pos) ? Number(pos[5]) : Number(arr.tickLower);
			const tickUpper = Array.isArray(pos) ? Number(pos[6]) : Number(arr.tickUpper);
			const liquidity = Array.isArray(pos) ? (pos[7] as bigint) : (arr.liquidity as bigint);
			const pt0 = frostIsToken0 ? CONTRACTS.frost : CONTRACTS.usdc;
			const pt1 = frostIsToken0 ? CONTRACTS.usdc : CONTRACTS.frost;
			const value = await readUint(
				oracle,
				'function getUniV3PositionValue(address,address,int24,int24,uint128) view returns (uint256)',
				[pt0, pt1, tickLower, tickUpper, liquidity],
			);
			lpValueUsd = toUnits(value, 18);

			const { amount0, amount1 } = uniV3PositionAmounts(sqrtPriceX96, tickLower, tickUpper, liquidity);
			const posUsdcRaw = frostIsToken0 ? amount1 : amount0;
			const posFrostRaw = frostIsToken0 ? amount0 : amount1;
			lpSpotValueUsd = posUsdcRaw / 10 ** USDC_DECIMALS + (posFrostRaw / 10 ** FROST_DECIMALS) * livePriceUsd;
		}
	}

	const [lifetime0, lifetime1] = await lifetimePromise;

	// Map pool token order (amount0/amount1) onto USDC/FROST legs.
	const uncollectedUsdc = toUnits(frostIsToken0 ? owed[1] : owed[0], USDC_DECIMALS);
	const uncollectedFrost = toUnits(frostIsToken0 ? owed[0] : owed[1], FROST_DECIMALS);
	const lifetimeFeesUsdc = toUnits(frostIsToken0 ? lifetime1 : lifetime0, USDC_DECIMALS);
	const lifetimeFeesFrost = toUnits(frostIsToken0 ? lifetime0 : lifetime1, FROST_DECIMALS);

	const poolUsdc = toUnits(poolUsdcRaw, USDC_DECIMALS);
	const poolFrost = toUnits(poolFrostRaw, FROST_DECIMALS);

	return {
		polUsdc: toUnits(polUsdcRaw, USDC_DECIMALS),
		polFrost: toUnits(polFrostRaw, FROST_DECIMALS),
		positionId: positionId.toString(),
		totalUsdcDeployed: toUnits(deployedRaw, USDC_DECIMALS),
		totalFrostBought: toUnits(boughtRaw, FROST_DECIMALS),
		distributeBps: Number(distributeBps),
		lpValueUsd,
		lpSpotValueUsd,
		uncollectedUsdc,
		uncollectedFrost,
		uncollectedUsd: uncollectedUsdc + uncollectedFrost * livePriceUsd,
		lifetimeFeesUsdc,
		lifetimeFeesFrost,
		lifetimeFeesUsd: lifetimeFeesUsdc + lifetimeFeesFrost * livePriceUsd,
		poolUsdc,
		poolFrost,
		livePriceUsd,
		poolTvlUsd: poolUsdc + poolFrost * livePriceUsd,
	};
}
