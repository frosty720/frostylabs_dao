import { getLockStats } from '@/lib/reads/lock';
import { PageHeader } from '@/components/dao/page-header';
import { StatCard } from '@/components/dao/stat-card';
import { LockPanel } from '@/components/dao/lock-panel';
import { FeeClaimCard } from '@/components/dao/fee-claim-card';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LockPage() {
	const s = await getLockStats();

	return (
		<div className="space-y-10">
			<PageHeader
				eyebrow="FROST Protocol"
				title="Lock & Vote"
				subtitle="Lock FROST to earn governance weight and a share of protocol fees. Weight decays with time remaining — a longer lock counts for more."
			/>

			<section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<StatCard label="Total Locked" value={`${formatNumber(s.totalLockedFrost, { compact: true })} FROST`} accent="magenta" />
				<StatCard label="Total PERMA" value={formatNumber(s.totalWeight, { compact: true })} sub="across all lockers · soulbound" accent="cyan" />
			</section>

			<section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<LockPanel />
				<FeeClaimCard />
			</section>
		</div>
	);
}
