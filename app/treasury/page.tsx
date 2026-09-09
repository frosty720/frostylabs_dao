import { getTreasury } from '@/lib/reads/treasury';
import { PageHeader } from '@/components/dao/page-header';
import { StatCard } from '@/components/dao/stat-card';
import { formatUsd, formatNumber, formatPercent } from '@/lib/format';
import { explorerBase } from '@/lib/thirdweb';
import { CONTRACTS } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

export default async function TreasuryPage() {
	const d = await getTreasury();
	const hasPosition = d.positionId !== '0';

	return (
		<div className="space-y-10">
			<PageHeader
				eyebrow="FROST Protocol"
				title="Protocol-Owned Liquidity"
				subtitle="The POL vault turns protocol revenue into a permanent Uniswap V3 position — liquidity the protocol owns and never rents."
			/>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold text-ink">POL Vault</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<StatCard
						label="LP Position Value"
						value={formatUsd(d.lpSpotValueUsd, { compact: true })}
						sub={hasPosition ? `oracle mark ${formatUsd(d.lpValueUsd)} · position #${d.positionId}` : 'no position yet'}
						accent="cyan"
						info="Spot value of the Uniswap V3 position the vault owns, at the live pool price. The oracle mark below is the deliberately conservative solvency number the protocol trusts: the FROST leg counts as $0, the USDC leg is valued at a governance-set floor price, and a 10% haircut is applied on top."
					/>
					<StatCard
						label="Idle USDC"
						value={formatUsd(d.polUsdc)}
						sub="awaiting deploy"
						info="USDC held by the vault that has not been paired into the position yet — revenue and bond proceeds waiting on the next liquidity deploy."
					/>
					<StatCard
						label="Idle FROST"
						value={`${formatNumber(d.polFrost, { compact: true })} FROST`}
						info="FROST the vault holds outside the position — mostly leftover the current pool ratio could not pair; it is picked up by the next deploy."
					/>
					<StatCard
						label="Total USDC Deployed"
						value={formatUsd(d.totalUsdcDeployed, { compact: true })}
						accent="violet"
						info="Lifetime USDC the vault has put to work building liquidity — half market-buys FROST, half pairs with it. This is the vault's cost basis, not its current value."
					/>
					<StatCard
						label="Total FROST Bought"
						value={`${formatNumber(d.totalFrostBought, { compact: true })} FROST`}
						accent="magenta"
						info="Lifetime FROST the vault has market-bought from the pool as the other half of each liquidity deploy — permanent buy pressure funded by revenue and bonds."
					/>
					<StatCard
						label="Fee Distribution"
						value={formatPercent(d.distributeBps / 10_000)}
						sub="rest compounds into POL"
						info="Share of each fee harvest earmarked for PERMA lockers; the remainder is compounded back into the position, deepening protocol-owned liquidity."
					/>
					<StatCard
						label="Uncollected Fees"
						value={formatUsd(d.uncollectedUsd)}
						sub={
							hasPosition
								? `${formatNumber(d.uncollectedUsdc, { maximumFractionDigits: 4 })} USDC + ${formatNumber(d.uncollectedFrost, { maximumFractionDigits: 4 })} FROST awaiting harvest`
								: 'no position yet'
						}
						accent="cyan"
						info="Trading fees the position has earned that no harvest has collected yet — measured live by simulating the collect, so it is exact as of this page load."
					/>
					<StatCard
						label="Lifetime Fees Earned"
						value={formatUsd(d.lifetimeFeesUsd)}
						sub={`${formatNumber(d.lifetimeFeesUsdc, { maximumFractionDigits: 4 })} USDC + ${formatNumber(d.lifetimeFeesFrost, { maximumFractionDigits: 4 })} FROST collected all-time`}
						accent="violet"
						info="Every trading fee the position has collected across all harvests, with the FROST leg valued at the current price. Harvested fees are never sold — they compound into the position."
					/>
				</div>
			</section>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold text-ink">FROST / USDC Pool</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label="Pool TVL"
						value={formatUsd(d.poolTvlUsd, { compact: true })}
						accent="cyan"
						info="Total value of ALL liquidity in the FROST/USDC pool from every provider combined, at the spot price — not just the protocol's own share (that is the LP Position Value above)."
					/>
					<StatCard
						label="FROST Price"
						value={formatUsd(d.livePriceUsd)}
						info="Live spot price of FROST implied by the pool right now. Note the protocol never prices bonds or rewards off this number — those use debt-based pricing."
					/>
					<StatCard
						label="USDC Reserve"
						value={formatUsd(d.poolUsdc, { compact: true })}
						info="USDC actually held by the pool contract — the stable side of the market's depth."
					/>
					<StatCard
						label="FROST Reserve"
						value={`${formatNumber(d.poolFrost, { compact: true })} FROST`}
						info="FROST actually held by the pool contract — the token side of the market's depth."
					/>
				</div>
				<div className="frosted-glass rounded-xl p-5 text-sm">
					<div className="flex items-center justify-between">
						<span className="text-ink-dim">Pool contract</span>
						<a
							href={`${explorerBase}/address/${CONTRACTS.pool}`}
							target="_blank"
							rel="noreferrer"
							className="font-mono text-cyan hover:underline"
						>
							{CONTRACTS.pool.slice(0, 10)}…{CONTRACTS.pool.slice(-6)}
						</a>
					</div>
				</div>
			</section>
		</div>
	);
}
