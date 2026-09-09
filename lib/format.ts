// Display + on-chain math helpers. All price math is done in bigint and only cast to
// number at the very end, so a full-range Uniswap sqrtPriceX96 never loses precision mid-calc.

const Q192 = 1n << 192n;
const E18 = 10n ** 18n;

/**
 * USD price of one whole FROST from a Uniswap V3 `sqrtPriceX96`, assuming the paired token
 * is a $1 stablecoin. Handles both token orderings.
 *
 * Uniswap defines price P = token1/token0 in RAW units, with P = sqrtPriceX96^2 / 2^192.
 * - FROST is token1 (stable is token0): USD/FROST = 10^(frostDec-stableDec) * 2^192 / sqrt^2
 * - FROST is token0 (stable is token1): USD/FROST = 10^(frostDec-stableDec) * sqrt^2 / 2^192
 */
export function frostUsdFromSqrtPriceX96(
	sqrtPriceX96: bigint,
	frostDecimals: number,
	stableDecimals: number,
	frostIsToken0: boolean,
): number {
	if (sqrtPriceX96 <= 0n) return 0;
	const sq = sqrtPriceX96 * sqrtPriceX96;
	const gap = frostDecimals - stableDecimals; // e.g. 18 - 6 = 12
	const gapNum = gap >= 0 ? 10n ** BigInt(gap) : 1n;
	const gapDen = gap >= 0 ? 1n : 10n ** BigInt(-gap);

	// Scale by E18 for fixed-point, then divide back out to a JS number.
	let e18: bigint;
	if (frostIsToken0) {
		// USD/FROST = sq/Q192 * 10^gap
		e18 = (sq * gapNum * E18) / (Q192 * gapDen);
	} else {
		// USD/FROST = Q192/sq * 10^gap
		e18 = (Q192 * gapNum * E18) / (sq * gapDen);
	}
	return Number(e18) / 1e18;
}

/**
 * Token amounts currently held by a Uniswap V3 position, from the pool's live sqrt price,
 * the position's tick range, and its liquidity — LiquidityAmounts.getAmountsForLiquidity
 * with the price clamped to the range edges. Float math: display precision only, never
 * settlement math. Returns RAW (wei-scale) amounts; callers scale by token decimals.
 */
export function uniV3PositionAmounts(
	sqrtPriceX96: bigint,
	tickLower: number,
	tickUpper: number,
	liquidity: bigint,
): { amount0: number; amount1: number } {
	if (liquidity <= 0n || sqrtPriceX96 <= 0n || tickLower >= tickUpper) return { amount0: 0, amount1: 0 };
	const L = Number(liquidity);
	const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
	const sqrtA = 1.0001 ** (tickLower / 2);
	const sqrtB = 1.0001 ** (tickUpper / 2);
	const sp = Math.min(Math.max(sqrtP, sqrtA), sqrtB);
	return { amount0: L * (1 / sp - 1 / sqrtB), amount1: L * (sp - sqrtA) };
}

/** Scale a raw token amount (bigint wei) to a whole-unit JS number. */
export function toUnits(raw: bigint, decimals: number): number {
	if (raw === 0n) return 0;
	// Keep 6 fractional digits of precision without overflowing Number on large supplies.
	const scaled = (raw * 1_000_000n) / 10n ** BigInt(decimals);
	return Number(scaled) / 1_000_000;
}

export function formatUsd(n: number, opts: { compact?: boolean } = {}): string {
	if (!isFinite(n)) return '—';
	if (opts.compact && Math.abs(n) >= 1000) {
		return `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n)}`;
	}
	// Small prices (sub-dollar) want more decimals so $0.001 doesn't render as $0.00.
	const maximumFractionDigits = Math.abs(n) !== 0 && Math.abs(n) < 1 ? 5 : 2;
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits }).format(n);
}

export function formatNumber(n: number, opts: { compact?: boolean; maximumFractionDigits?: number } = {}): string {
	if (!isFinite(n)) return '—';
	return new Intl.NumberFormat('en-US', {
		notation: opts.compact ? 'compact' : 'standard',
		maximumFractionDigits: opts.maximumFractionDigits ?? (opts.compact ? 2 : 0),
	}).format(n);
}

export function formatPercent(fraction: number, maximumFractionDigits = 1): string {
	if (!isFinite(fraction)) return '—';
	return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits }).format(fraction);
}

export function formatDuration(seconds: number): string {
	if (!isFinite(seconds) || seconds <= 0) return '—';
	const days = seconds / 86400;
	if (days >= 1) return `${formatNumber(days, { maximumFractionDigits: days < 10 ? 1 : 0 })}d`;
	const hours = seconds / 3600;
	return `${formatNumber(hours, { maximumFractionDigits: 1 })}h`;
}

export function shortAddress(addr: string): string {
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
