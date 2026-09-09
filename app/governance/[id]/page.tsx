import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProposal, PROPOSAL_STATES } from '@/lib/reads/governance';
import { ProposalActions } from '@/components/dao/proposal-actions';
import { isSignalingProposal, splitDescription } from '@/lib/proposals';
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

function VoteRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
	const pct = total > 0 ? (value / total) * 100 : 0;
	return (
		<div>
			<div className="flex items-center justify-between text-sm">
				<span className="text-ink">{label}</span>
				<span className="text-ink-dim">{formatNumber(value, { compact: true })}</span>
			</div>
			<div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
				<div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
			</div>
		</div>
	);
}

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const p = await getProposal(id);
	if (!p) notFound();

	const { title, body } = splitDescription(p.description);
	const signaling = isSignalingProposal(p);
	const totalVotes = p.forVotes + p.againstVotes + p.abstainVotes;

	return (
		<div className="space-y-8">
			<Link href="/governance" className="mono-label text-ink-dim transition-colors hover:text-cyan">
				← All proposals
			</Link>

			{/* Header */}
			<div className="space-y-4">
				<div className="flex flex-wrap items-center gap-3">
					<span className={`mono-label rounded-full border px-2.5 py-1 ${STATE_STYLE[p.state] ?? 'border-white/15 text-ink-dim'}`}>
						{PROPOSAL_STATES[p.state] ?? 'Unknown'}
					</span>
					<span className="mono-label text-ink-dim">{shortId(p.id)}</span>
					<span className="text-xs text-ink-dim">by {shortAddress(p.proposer)}</span>
				</div>
				<h1 className="text-2xl font-semibold text-ink sm:text-3xl">{title || 'Untitled proposal'}</h1>
			</div>

			{/* Primary action — kept at the top so voting is never buried below the fold */}
			<div className="frosted-glass rounded-xl border border-cyan/20 p-6">
				<ProposalActions p={p} />
			</div>

			{/* Body */}
			<div className="frosted-glass rounded-xl p-6">
				<div className="mono-label text-ink-dim">Details</div>
				{body ? (
					<p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{body}</p>
				) : (
					<p className="mt-3 text-sm text-ink-dim">No additional details were provided.</p>
				)}
			</div>

			{/* Votes */}
			<div className="frosted-glass space-y-4 rounded-xl p-6">
				<div className="flex items-center justify-between">
					<div className="mono-label text-ink-dim">Votes</div>
					<div className="text-xs text-ink-dim">
						{p.state === 0 ? 'Voting not open yet' : `${formatNumber(totalVotes, { compact: true })} PERMA cast`}
					</div>
				</div>
				<VoteRow label="For" value={p.forVotes} total={totalVotes} color="bg-cyan" />
				<VoteRow label="Against" value={p.againstVotes} total={totalVotes} color="bg-magenta" />
				<VoteRow label="Abstain" value={p.abstainVotes} total={totalVotes} color="bg-white/40" />
				<div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-ink-dim">
					<span>Quorum required</span>
					<span>{formatNumber(p.quorum, { compact: true })} PERMA</span>
				</div>
			</div>

			{/* Timeline */}
			<div className="frosted-glass space-y-3 rounded-xl p-6">
				<div className="mono-label text-ink-dim">Timeline</div>
				<div className="flex items-center justify-between text-sm">
					<span className="text-ink-dim">Voting opens</span>
					<span className="text-ink">{new Date(p.voteStart * 1000).toLocaleString()}</span>
				</div>
				<div className="flex items-center justify-between text-sm">
					<span className="text-ink-dim">Voting closes</span>
					<span className="text-ink">{new Date(p.voteEnd * 1000).toLocaleString()}</span>
				</div>
				{p.eta > 0 && (
					<div className="flex items-center justify-between text-sm">
						<span className="text-ink-dim">Executable after</span>
						<span className="text-ink">{new Date(p.eta * 1000).toLocaleString()}</span>
					</div>
				)}
			</div>

			{/* On-chain action */}
			<div className="frosted-glass space-y-3 rounded-xl p-6">
				<div className="mono-label text-ink-dim">On-chain action</div>
				{signaling ? (
					<p className="text-sm text-ink-dim">
						This proposal has no on-chain action — the vote result is the outcome, and the team actions approved
						proposals from the multisig treasury.
					</p>
				) : (
					<div className="space-y-3">
						{p.targets.map((t, i) => (
							<div key={`${t}-${i}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs">
								<div className="flex items-center justify-between">
									<span className="text-ink-dim">Target</span>
									<span className="font-mono text-ink">{t}</span>
								</div>
								<div className="mt-2 flex items-center justify-between">
									<span className="text-ink-dim">Value</span>
									<span className="font-mono text-ink">{p.values[i] ?? '0'} wei</span>
								</div>
								<div className="mt-2">
									<span className="text-ink-dim">Calldata</span>
									<p className="mt-1 break-all font-mono text-ink">{p.calldatas[i] ?? '0x'}</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

		</div>
	);
}
