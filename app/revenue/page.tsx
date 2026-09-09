import { getRevenue, type ProfileSplit } from '@/lib/reads/revenue';
import { PageHeader } from '@/components/dao/page-header';
import { StatCard } from '@/components/dao/stat-card';
import { formatUsd, formatPercent, shortAddress } from '@/lib/format';
import { explorerBase } from '@/lib/thirdweb';

export const dynamic = 'force-dynamic';

const SEGMENTS = [
	{ key: 'operatingBps', label: 'Operating', color: 'bg-ink-dim' },
	{ key: 'devBps', label: 'Dev', color: 'bg-violet' },
	{ key: 'polBps', label: 'POL', color: 'bg-cyan' },
	{ key: 'daoBps', label: 'DAO', color: 'bg-magenta' },
] as const;

function SplitBar({ profile }: { profile: ProfileSplit }) {
	return (
		<div className="frosted-glass rounded-xl p-5">
			<div className="text-lg font-semibold text-ink">{profile.label}</div>
			<div className="mt-4 flex h-3 overflow-hidden rounded-full">
				{SEGMENTS.map((s) => (
					<div key={s.key} className={s.color} style={{ width: `${profile[s.key] / 100}%` }} />
				))}
			</div>
			<div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
				{SEGMENTS.map((s) => (
					<div key={s.key}>
						<div className="flex items-center gap-2">
							<span className={`inline-block h-2 w-2 rounded-full ${s.color}`} />
							<span className="text-ink-dim">{s.label}</span>
						</div>
						<div className="mt-1 font-semibold text-ink">{formatPercent(profile[s.key] / 10_000)}</div>
					</div>
				))}
			</div>
		</div>
	);
}

export default async function RevenuePage() {
	const d = await getRevenue();
	const buckets = [
		{ label: 'Operating', address: d.buckets.operating },
		{ label: 'Dev', address: d.buckets.dev },
		{ label: 'POL Reserve', address: d.buckets.pol },
		{ label: 'DAO Treasury', address: d.buckets.dao },
	];

	return (
		<div className="space-y-10">
			<PageHeader
				eyebrow="FROST Protocol"
				title="Revenue → POL"
				subtitle="Every revenue stream is split into four buckets. The POL share buys protocol-owned liquidity; the DAO share flows to lockers as fees."
			/>

			<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard label="Total Revenue" value={formatUsd(d.totalRevenueUsdc)} sub="cumulative through the splitter" accent="cyan" />
				<StatCard label="Unflushed (sweepable)" value={formatUsd(d.sweepableUsdc)} sub="USDC held for future flushes" />
				<StatCard label="Fees to Lockers (cumulative)" value={formatUsd(d.feesToLockersTotal)} accent="magenta" />
				<StatCard label="Fees Claimed" value={formatUsd(d.feesToLockersClaimed)} />
			</section>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold text-ink">Split Profiles</h2>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{d.profiles.map((p) => (
						<SplitBar key={p.id} profile={p} />
					))}
				</div>
			</section>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold text-ink">Revenue Streams</h2>
				<div className="frosted-glass overflow-x-auto rounded-xl">
					<table className="w-full text-left text-sm">
						<thead className="text-ink-dim">
							<tr className="border-b border-white/10">
								<th className="px-5 py-3 font-medium">Stream</th>
								<th className="px-5 py-3 font-medium">Profile</th>
								<th className="px-5 py-3 font-medium">Status</th>
								<th className="px-5 py-3 text-right font-medium">Accrued</th>
								<th className="px-5 py-3 text-right font-medium">Lifetime</th>
							</tr>
						</thead>
						<tbody>
							{d.streams.map((s) => (
								<tr key={s.id} className="border-b border-white/5 last:border-0">
									<td className="px-5 py-3 font-medium text-ink">{s.label}</td>
									<td className="px-5 py-3 text-ink-dim">{s.profileLabel}</td>
									<td className="px-5 py-3">
										<span className={s.enabled ? 'text-cyan' : 'text-ink-dim'}>{s.enabled ? 'Enabled' : 'Disabled'}</span>
									</td>
									<td className="px-5 py-3 text-right text-ink">{formatUsd(s.accruedUsdc)}</td>
									<td className="px-5 py-3 text-right text-ink-dim">{formatUsd(s.lifetimeUsdc)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div className="frosted-glass rounded-xl p-6">
					<h2 className="text-lg font-semibold text-ink">Bucket Destinations</h2>
					<div className="mt-4 space-y-3">
						{buckets.map((b) => (
							<div key={b.label} className="flex items-center justify-between text-sm">
								<span className="text-ink-dim">{b.label}</span>
								<a
									href={`${explorerBase}/address/${b.address}`}
									target="_blank"
									rel="noreferrer"
									className="font-mono text-cyan hover:underline"
								>
									{shortAddress(b.address)}
								</a>
							</div>
						))}
					</div>
				</div>

				<div className="frosted-glass rounded-xl p-6">
					<h2 className="text-lg font-semibold text-ink">Affiliate Legs</h2>
					<p className="mt-1 text-sm text-ink-dim">Referral share paid up-line, taken from each split before the buckets.</p>
					<div className="mt-4 grid grid-cols-3 gap-4 text-center">
						{[
							{ label: 'Level 1', bps: d.affiliate.n1 },
							{ label: 'Level 2', bps: d.affiliate.n2 },
							{ label: 'Level 3', bps: d.affiliate.n3 },
						].map((l) => (
							<div key={l.label}>
								<div className="text-2xl font-semibold text-violet">{formatPercent(l.bps / 10_000)}</div>
								<div className="mt-1 mono-label text-ink-dim">{l.label}</div>
							</div>
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
