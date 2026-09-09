'use client';

import type { ReactNode } from 'react';
import { prepareContractCall } from 'thirdweb';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { contractAt } from '@/lib/contract';
import { CONTRACTS } from '@/lib/contracts';
import { TxButton } from '@/components/dao/tx-button';
import type { ProposalView } from '@/lib/reads/governance';

const gov = contractAt(CONTRACTS.governor);
const ZERO = '0x0000000000000000000000000000000000000000';

function Note({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'cyan' | 'magenta' }) {
	const cls = tone === 'cyan' ? 'text-cyan' : tone === 'magenta' ? 'text-magenta' : 'text-ink-dim';
	return <p className={`text-sm ${cls}`}>{children}</p>;
}

export function ProposalActions({ p }: { p: ProposalView }) {
	const account = useActiveAccount();
	const owner = account?.address ?? ZERO;

	const { data: voted } = useReadContract({
		contract: gov,
		method: 'function hasVoted(uint256 proposalId, address account) view returns (bool)',
		params: [BigInt(p.id), owner],
		queryOptions: { enabled: !!account && p.state === 1 },
	});

	// Informational / terminal states — always say something clear, never render blank.
	if (p.state === 0) return <Note>Voting opens {new Date(p.voteStart * 1000).toLocaleString()}.</Note>;
	if (p.state === 2) return <Note>This proposal was canceled.</Note>;
	if (p.state === 3) return <Note tone="magenta">This proposal was defeated — it did not reach the votes or quorum needed to pass.</Note>;
	if (p.state === 6) return <Note>This proposal expired before it was executed.</Note>;
	if (p.state === 7) return <Note tone="cyan">✓ Executed.</Note>;

	// Active — cast a vote
	if (p.state === 1) {
		if (!account) return <Note>Connect your wallet to vote.</Note>;
		if (voted) return <Note tone="cyan">✓ You have already voted on this proposal.</Note>;
		return (
			<div className="flex gap-3">
				<TxButton
					label="Vote For"
					pendingLabel="Voting…"
					className="flex-1 bg-cyan text-[#05060b] hover:bg-cyan/90"
					prepare={() => prepareContractCall({ contract: gov, method: 'function castVote(uint256,uint8) returns (uint256)', params: [BigInt(p.id), 1] })}
				/>
				<TxButton
					label="Vote Against"
					pendingLabel="Voting…"
					variant="outline"
					className="flex-1 border-white/10 text-ink hover:bg-white/5"
					prepare={() => prepareContractCall({ contract: gov, method: 'function castVote(uint256,uint8) returns (uint256)', params: [BigInt(p.id), 0] })}
				/>
			</div>
		);
	}

	// Succeeded — queue into the timelock
	if (p.state === 4) {
		if (!account) return <Note>This proposal passed. Connect your wallet to queue it into the timelock.</Note>;
		return (
			<TxButton
				label="Queue"
				pendingLabel="Queuing…"
				className="w-full bg-violet text-[#05060b] hover:bg-violet/90"
				prepare={() =>
					prepareContractCall({
						contract: gov,
						method: 'function queue(address[],uint256[],bytes[],bytes32) returns (uint256)',
						params: [
							p.targets as `0x${string}`[],
							p.values.map((v) => BigInt(v)),
							p.calldatas as `0x${string}`[],
							p.descriptionHash as `0x${string}`,
						],
					})
				}
			/>
		);
	}

	// Queued — execute once the timelock delay elapses
	if (p.state === 5) {
		if (!account) return <Note>Queued in the timelock. Connect your wallet to execute once the delay elapses.</Note>;
		const ready = p.eta === 0 || Math.floor(Date.now() / 1000) >= p.eta;
		return (
			<TxButton
				label={ready ? 'Execute' : `Executable ${new Date(p.eta * 1000).toLocaleString()}`}
				pendingLabel="Executing…"
				disabled={!ready}
				className="w-full bg-cyan text-[#05060b] hover:bg-cyan/90"
				prepare={() =>
					prepareContractCall({
						contract: gov,
						method: 'function execute(address[],uint256[],bytes[],bytes32) payable returns (uint256)',
						params: [
							p.targets as `0x${string}`[],
							p.values.map((v) => BigInt(v)),
							p.calldatas as `0x${string}`[],
							p.descriptionHash as `0x${string}`,
						],
					})
				}
			/>
		);
	}

	return null;
}
