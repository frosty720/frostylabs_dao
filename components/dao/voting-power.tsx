'use client';

import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { contractAt } from '@/lib/contract';
import { CONTRACTS } from '@/lib/contracts';
import { toUnits, formatNumber } from '@/lib/format';

const votes = contractAt(CONTRACTS.permaLockerVotes);
const ZERO = '0x0000000000000000000000000000000000000000';

export function VotingPower() {
	const account = useActiveAccount();
	const { data } = useReadContract({
		contract: votes,
		method: 'function getVotes(address account) view returns (uint256)',
		params: [account?.address ?? ZERO],
		queryOptions: { enabled: !!account },
	});

	const power = toUnits(data ?? 0n, 18);

	return (
		<div className="frosted-glass flex flex-col gap-3 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<div className="mono-label text-ink-dim">Your voting power</div>
				<div className="mt-1 text-2xl font-semibold text-ink">
					{account ? `${formatNumber(power, { compact: true })} PERMA` : '—'}
				</div>
			</div>
			<p className="max-w-sm text-xs text-ink-dim sm:text-right">
				{account
					? 'PERMA is soulbound and permanently self-delegated — no delegation step needed. Votes count at each proposal’s snapshot.'
					: 'Connect your wallet to see your voting power.'}
			</p>
		</div>
	);
}
