import { getOverview } from '@/lib/reads/overview';
import { StatCard } from '@/components/dao/stat-card';
import { BondMarketCard } from '@/components/dao/bond-market-card';
import { formatUsd, formatNumber, formatPercent } from '@/lib/format';

// Always current-state: read the chain on every request.
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
	const d = await getOverview();

	return (
		<div className="space-y-10">
			<header>
				<div className="mono-label text-cyan">FROST Protocol</div>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
					<span className="aurora-text">Protocol Overview</span>
				</h1>
				<p className="mt-3 max-w-2xl text-ink-dim">
					Live protocol state — token price, protocol-owned liquidity, locking and bond markets.
					Read straight from the contracts on Base Sepolia.
				</p>
			</header>

			<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard
					label="FROST Price"
					value={formatUsd(d.livePriceUsd)}
					sub={d.stale ? 'pool price unavailable' : `reference ${formatUsd(d.refPriceUsd)}`}
					accent="cyan"
				/>
				<StatCard label="Market Cap" value={formatUsd(d.marketCapUsd, { compact: true })} accent="violet" />
				<StatCard label="Total Supply" value={`${formatNumber(d.totalSupply, { compact: true })} FROST`} />
				<StatCard
					label="Total Locked"
					value={`${formatNumber(d.totalLockedFrost, { compact: true })} FROST`}
					sub={`${formatPercent(d.lockedPct)} of supply`}
					accent="magenta"
				/>
				<StatCard
					label="Voting Power"
					value={`${formatNumber(d.votingWeight, { compact: true })}`}
					sub="decayed lock weight"
				/>
				<StatCard
					label="Protocol-Owned Liquidity"
					value={formatUsd(d.polValueUsd, { compact: true })}
					sub={`${formatUsd(d.polLpValueUsd, { compact: true })} deployed · ${formatNumber(d.polUsdc, { compact: true })} USDC + ${formatNumber(d.polFrost, { compact: true })} FROST idle`}
					accent="cyan"
				/>
			</section>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold text-ink">Bond Markets</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{d.bondMarkets.map((m) => (
						<BondMarketCard key={m.label} market={m} />
					))}
				</div>
			</section>
		</div>
	);
}
