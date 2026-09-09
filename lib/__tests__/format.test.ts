import { describe, it, expect } from 'vitest';
import {
	frostUsdFromSqrtPriceX96,
	uniV3PositionAmounts,
	toUnits,
	formatUsd,
	formatPercent,
	formatDuration,
} from '@/lib/format';

// Integer sqrt over bigint — mirrors how the pool derives sqrtPriceX96 at seed time,
// so the test drives the function with a genuinely on-chain-shaped input.
function isqrt(n: bigint): bigint {
	if (n < 0n) throw new Error('neg');
	if (n < 2n) return n;
	let x = n;
	let y = (x + 1n) / 2n;
	while (y < x) {
		x = y;
		y = (x + n / x) / 2n;
	}
	return x;
}

// Uniswap: sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96 = isqrt((amount1 << 192) / amount0)
function sqrtPriceX96(amount0: bigint, amount1: bigint): bigint {
	return isqrt((amount1 << 192n) / amount0);
}

const USDC = (n: number) => BigInt(n) * 10n ** 6n;
const FROST = (n: number) => BigInt(n) * 10n ** 18n;

describe('frostUsdFromSqrtPriceX96', () => {
	it('prices FROST at ~$0.001 when it is token1 (stable is token0)', () => {
		// $0.001 → 100 USDC paired with 100_000 FROST
		const sqrt = sqrtPriceX96(USDC(100), FROST(100_000));
		const price = frostUsdFromSqrtPriceX96(sqrt, 18, 6, false);
		expect(price).toBeGreaterThan(0.00099);
		expect(price).toBeLessThan(0.00101);
	});

	it('prices FROST at ~$0.001 when it is token0 (stable is token1)', () => {
		// reversed ordering: token0 = FROST, token1 = USDC
		const sqrt = sqrtPriceX96(FROST(100_000), USDC(100));
		const price = frostUsdFromSqrtPriceX96(sqrt, 18, 6, true);
		expect(price).toBeGreaterThan(0.00099);
		expect(price).toBeLessThan(0.00101);
	});

	it('prices FROST at ~$1 for a 1:1 pool', () => {
		const sqrt = sqrtPriceX96(USDC(1_000), FROST(1_000));
		const price = frostUsdFromSqrtPriceX96(sqrt, 18, 6, false);
		expect(price).toBeGreaterThan(0.999);
		expect(price).toBeLessThan(1.001);
	});

	it('returns 0 for a zero sqrt price', () => {
		expect(frostUsdFromSqrtPriceX96(0n, 18, 6, false)).toBe(0);
	});
});

describe('toUnits', () => {
	it('scales 18-decimal wei to whole units', () => {
		expect(toUnits(FROST(1_500_000), 18)).toBe(1_500_000);
	});
	it('scales 6-decimal USDC', () => {
		expect(toUnits(USDC(25), 6)).toBe(25);
	});
	it('keeps fractional precision', () => {
		expect(toUnits(1_500_000n, 6)).toBeCloseTo(1.5, 6);
	});
	it('returns 0 for 0', () => {
		expect(toUnits(0n, 18)).toBe(0);
	});
});

describe('formatters', () => {
	it('shows 5 decimals for sub-dollar prices', () => {
		expect(formatUsd(0.001)).toBe('$0.001');
	});
	it('shows 2 decimals for normal prices', () => {
		expect(formatUsd(22.5)).toBe('$22.50');
	});
	it('compacts large USD', () => {
		expect(formatUsd(1_250_000, { compact: true })).toBe('$1.25M');
	});
	it('formats percent from a fraction', () => {
		expect(formatPercent(0.05)).toBe('5%');
	});
	it('formats vesting duration in days', () => {
		expect(formatDuration(5 * 86400)).toBe('5d');
	});
});

describe('uniV3PositionAmounts', () => {
	const Q96 = 2n ** 96n;
	// Full-range bounds used by the protocol's pools (SeedPool.s.sol / PolVault config).
	const FULL_LOWER = -887220;
	const FULL_UPPER = 887220;

	it('splits a full-range position ~50/50 at price 1 (closed form: L of each token)', () => {
		const L = 1_000_000_000_000n;
		const { amount0, amount1 } = uniV3PositionAmounts(Q96, FULL_LOWER, FULL_UPPER, L);
		// At sqrtP=1 the closed form is amount0 = L·(1 − 1/sqrtB) ≈ L and amount1 = L·(1 − sqrtA) ≈ L,
		// because the full-range edges are ~1e±19. Independent of the implementation's algebra.
		expect(amount0 / Number(L)).toBeCloseTo(1, 9);
		expect(amount1 / Number(L)).toBeCloseTo(1, 9);
	});

	it('satisfies the virtual-reserve invariant (x + L/√B)(y + L·√A) = L² in range', () => {
		const L = 5_000_000_000n;
		const tickLower = -60000;
		const tickUpper = 60000;
		const sqrtP = 1.0001 ** 5000; // tick 10000, inside the range
		const sqrtPX96 = BigInt(Math.round(sqrtP * 2 ** 96));
		const { amount0, amount1 } = uniV3PositionAmounts(sqrtPX96, tickLower, tickUpper, L);
		const sqrtA = 1.0001 ** (tickLower / 2);
		const sqrtB = 1.0001 ** (tickUpper / 2);
		const lhs = (amount0 + Number(L) / sqrtB) * (amount1 + Number(L) * sqrtA);
		expect(lhs / Number(L) ** 2).toBeCloseTo(1, 9);
	});

	it('is all token0 below the range and all token1 above it', () => {
		const L = 7_000_000_000n;
		const tickLower = 10000;
		const tickUpper = 20000;
		const below = uniV3PositionAmounts(Q96, tickLower, tickUpper, L); // price tick 0 < lower
		expect(below.amount1).toBe(0);
		expect(below.amount0).toBeGreaterThan(0);
		const sqrtAbove = BigInt(Math.round(1.0001 ** 15000 * 2 ** 96)); // tick 30000 > upper
		const above = uniV3PositionAmounts(sqrtAbove, tickLower, tickUpper, L);
		expect(above.amount0).toBe(0);
		expect(above.amount1).toBeGreaterThan(0);
	});

	it('returns zeros for empty or invalid inputs', () => {
		expect(uniV3PositionAmounts(Q96, -100, 100, 0n)).toEqual({ amount0: 0, amount1: 0 });
		expect(uniV3PositionAmounts(0n, -100, 100, 10n)).toEqual({ amount0: 0, amount1: 0 });
		expect(uniV3PositionAmounts(Q96, 100, 100, 10n)).toEqual({ amount0: 0, amount1: 0 });
	});
});
