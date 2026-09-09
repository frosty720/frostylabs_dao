import Link from 'next/link';
import { getProposals, PROPOSAL_STATES, type ProposalView } from '@/lib/reads/governance';
import { PageHeader } from '@/components/dao/page-header';
import { ProposalActions } from '@/components/dao/proposal-actions';
import { VotingPower } from '@/components/dao/voting-power';
import { ProposeForm } from '@/components/dao/propose-form';
import { splitDescription } from '@/lib/proposals';
import { formatNumber, shortAddress } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATE_STYLE: Record<number, string> = {
	0: 'border-white/15 text-ink-dim', // Pending
	1: 'border-cyan/40 text-cyan', // Active
	2: 'border-white/15 text-ink-dim', // Canceled
	3: 'border-magenta/40 text-magenta', // Defeated
	4: 'border-violet/40 text-violet', // Succeeded
	5: 'border-violet/40 text-violet', // Queued
	6: 'border-white/15 text-ink-dim', // Expired
	7: 'border-cyan/40 text-cyan', // Executed
};

function shortId(id: string) {
	return `#${id.slice(0, 6)}…${id.slice(-4)}`;
}

function ProposalCard({ p }: { p: ProposalView }) {
	const totalVotes = p.forVotes + p.againstVotes + p.abstainVotes;
	const forPct = totalVotes > 0 ? (p.forVotes / totalVotes) * 100 : 0;
	const { title, body } = splitDescription(p.description);

	return (
		<div className="frosted-glass rounded-xl p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className={`mono-label rounded-full border px-2.5 py-1 ${STATE_STYLE[p.state] ?? 'border-white/15 text-ink-dim'}`}>
						{PROPOSAL_STATES[p.state] ?? 'Unknown'}
					</span>
					<span className="mono-label text-ink-dim">{shortId(p.id)}</span>
				</div>
				<span className="text-xs text-ink-dim">by {shortAddress(p.proposer)}</span>
			</div>

			<Link href={`/governance/${p.id}`} className="group mt-4 block">
				<h3 className="text-lg font-semibold text-ink transition-colors group-hover:text-cyan">
					{title || 'Untitled proposal'}
				</h3>
				{body && <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm text-ink-dim">{body}</p>}
				<span className="mono-label mt-2 inline-block text-ink-dim transition-colors group-hover:text-cyan">
					Open proposal →
				</span>
			</Link>

			{p.state === 0 ? (
				<p className="mt-2 text-sm text-ink-dim">Voting opens {new Date(p.voteStart * 1000).toLocaleString()}</p>
			) : (
				<div className="mt-4">
					<div className="flex items-center justify-between text-sm">
						<span className="text-cyan">For {formatNumber(p.forVotes, { compact: true })}</span>
						<span className="text-magenta">Against {formatNumber(p.againstVotes, { compact: true })}</span>
					</div>
					<div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
						<div className="h-full bg-cyan" style={{ width: `${forPct}%` }} />
					</div>
					<div className="mt-2 flex items-center justify-between text-xs text-ink-dim">
						<span>Quorum {formatNumber(p.quorum, { compact: true })}</span>
						<span>Voting closes {new Date(p.voteEnd * 1000).toLocaleDateString()}</span>
					</div>
				</div>
			)}

			<div className="mt-5">
				<ProposalActions p={p} />
			</div>
		</div>
	);
}

export default async function GovernancePage() {
	const proposals = await getProposals();

	return (
		<div className="space-y-10">
			<PageHeader
				eyebrow="FROST Protocol"
				title="Governance"
				subtitle="Lockers govern the protocol. Vote on proposals, then queue and execute them through the timelock once they pass."
			/>

			<VotingPower />

			<ProposeForm />

			{proposals.length === 0 ? (
				<div className="frosted-glass rounded-xl p-8 text-center text-ink-dim">No proposals yet.</div>
			) : (
				<section className="space-y-4">
					{proposals.map((p) => (
						<ProposalCard key={p.id} p={p} />
					))}
				</section>
			)}
		</div>
	);
}
