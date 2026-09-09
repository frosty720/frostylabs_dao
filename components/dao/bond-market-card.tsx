import type { BondMarketStat } from '@/lib/reads/overview';
import { formatUsd, formatPercent, formatDuration } from '@/lib/format';

export function BondMarketCard({ market }: { market: BondMarketStat }) {
	return (
		<div className="frosted-glass rounded-xl p-5">
			<div className="flex items-center justify-between">
				<span className="text-lg font-semibold text-ink">{market.label}</span>
				<span className="mono-label text-cyan">{formatUsd(market.priceUsd)}</span>
			</div>
			<div className="mt-4 grid grid-cols-2 gap-4 text-sm">
				<div>
					<div className="mono-label text-ink-dim">Discount</div>
					<div className="mt-1 text-ink">{formatPercent(market.discountPct)}</div>
				</div>
				<div>
					<div className="mono-label text-ink-dim">Vesting</div>
					<div className="mt-1 text-ink">{formatDuration(market.vestingSeconds)}</div>
				</div>
			</div>
			<div className="mt-3 text-xs text-ink-dim">Current bond price per FROST</div>
		</div>
	);
}
