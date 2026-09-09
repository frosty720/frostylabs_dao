import { getBondMarkets } from '@/lib/reads/bonds';
import { LEGACY_BOND_MARKETS } from '@/lib/contracts';
import { PageHeader } from '@/components/dao/page-header';
import { BondBuyForm } from '@/components/dao/bond-buy-form';
import { LpBondForm } from '@/components/dao/lp-bond-form';
import { MyBonds } from '@/components/dao/my-bonds';
import { formatUsd, formatPercent, formatDuration } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BondsPage() {
	const { erc20s, lps } = await getBondMarkets();

	return (
		<div className="space-y-10">
			<PageHeader
				eyebrow="FROST Protocol"
				title="Bond Markets"
				subtitle="Buy FROST at a discount by bonding a token or an LP position. Payout vests linearly — redeem as it unlocks."
			/>

			<section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{erc20s.map((erc20) => (
					<div key={erc20.address} className="frosted-glass rounded-xl p-6">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold text-ink">{erc20.label}</h2>
							<span className="mono-label text-cyan">{formatUsd(erc20.priceUsd)}</span>
						</div>
						<div className="mt-4 grid grid-cols-2 gap-4 text-sm">
							<div>
								<div className="mono-label text-ink-dim">Discount</div>
								<div className="mt-1 text-ink">{formatPercent(erc20.discountBps / 10_000)}</div>
							</div>
							<div>
								<div className="mono-label text-ink-dim">Vesting</div>
								<div className="mt-1 text-ink">{formatDuration(erc20.vestingSeconds)}</div>
							</div>
						</div>
						<div className="mt-6">
							<BondBuyForm detail={erc20} />
						</div>
					</div>
				))}

				{lps.map((lp) => (
					<div key={lp.address} className="frosted-glass rounded-xl p-6">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold text-ink">{lp.label}</h2>
							<span className="mono-label text-violet">{formatUsd(lp.priceUsd)}</span>
						</div>
						<div className="mt-4 grid grid-cols-2 gap-4 text-sm">
							<div>
								<div className="mono-label text-ink-dim">Discount</div>
								<div className="mt-1 text-ink">{formatPercent(lp.discountBps / 10_000)}</div>
							</div>
							<div>
								<div className="mono-label text-ink-dim">Vesting</div>
								<div className="mt-1 text-ink">{formatDuration(lp.vestingSeconds)}</div>
							</div>
						</div>
						<div className="mt-6">
							<LpBondForm detail={lp} />
						</div>
					</div>
				))}
			</section>

			<section>
				<MyBonds
					markets={[
						...erc20s.map((e) => ({ address: e.address, label: e.label })),
						...lps.map((l) => ({ address: l.address, label: `${l.pairLabel} LP` })),
						...LEGACY_BOND_MARKETS,
					]}
				/>
			</section>
		</div>
	);
}
