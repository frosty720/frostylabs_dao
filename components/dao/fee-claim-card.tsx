'use client';

import { prepareContractCall } from 'thirdweb';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { contractAt } from '@/lib/contract';
import { CONTRACTS } from '@/lib/contracts';
import { TxButton } from '@/components/dao/tx-button';
import { toUnits, formatUsd } from '@/lib/format';

const feeDist = contractAt(CONTRACTS.feeDistributor);
const locker = contractAt(CONTRACTS.permaLocker);
const ZERO = '0x0000000000000000000000000000000000000000';
const WEEK = 604800n;

export function FeeClaimCard() {
	const account = useActiveAccount();
	const owner = account?.address ?? ZERO;

	const { data: claimable, refetch } = useReadContract({
		contract: feeDist,
		method: 'function claimable(address token, address account) view returns (uint256)',
		params: [CONTRACTS.usdc, owner],
		queryOptions: { enabled: !!account },
	});

	// Rewards notified for the current weekly epoch only become claimable once the week closes.
	// Surface the caller's share of this epoch's credit + when it unlocks, so a $0 claimable
	// doesn't read as "no rewards".
	const { data: epoch } = useReadContract({
		contract: feeDist,
		method: 'function currentEpoch() view returns (uint256)',
		params: [],
	});
	const epochReady = epoch !== undefined;
	const { data: creditedThisEpoch } = useReadContract({
		contract: feeDist,
		method: 'function tokensPerEpoch(address token, uint256 epoch) view returns (uint256)',
		params: [CONTRACTS.usdc, epoch ?? 0n],
		queryOptions: { enabled: epochReady },
	});
	const { data: weightAt } = useReadContract({
		contract: locker,
		method: 'function balanceOfAt(address account, uint256 timestamp) view returns (uint256)',
		params: [owner, epoch ?? 0n],
		queryOptions: { enabled: epochReady && !!account },
	});
	const { data: supplyAt } = useReadContract({
		contract: locker,
		method: 'function totalSupplyAt(uint256 timestamp) view returns (uint256)',
		params: [epoch ?? 0n],
		queryOptions: { enabled: epochReady },
	});

	const owed = toUnits(claimable ?? 0n, 6);
	const pendingRaw =
		creditedThisEpoch && weightAt && supplyAt && supplyAt > 0n ? (creditedThisEpoch * weightAt) / supplyAt : 0n;
	const pending = toUnits(pendingRaw, 6);
	const unlockDate = epoch !== undefined ? new Date(Number(epoch + WEEK) * 1000).toLocaleDateString() : null;

	return (
		<div className="frosted-glass rounded-xl p-6">
			<h3 className="text-lg font-semibold text-ink">Fee Distribution</h3>
			<p className="mt-1 text-sm text-ink-dim">Lockers earn a share of protocol revenue (USDC), streamed per epoch.</p>
			<div className="mt-4 flex items-end justify-between gap-4">
				<div>
					<div className="mono-label text-ink-dim">Claimable</div>
					<div className="mt-1 text-2xl font-semibold text-cyan">{formatUsd(owed)}</div>
				</div>
				{account ? (
					<TxButton
						label="Claim USDC"
						pendingLabel="Claiming…"
						disabled={owed <= 0}
						variant="outline"
						className="border-white/10 text-ink hover:bg-white/5"
						prepare={() =>
							prepareContractCall({
								contract: feeDist,
								method: 'function claim(address token) returns (uint256)',
								params: [CONTRACTS.usdc],
							})
						}
						onDone={() => refetch()}
					/>
				) : (
					<span className="text-sm text-ink-dim">Connect wallet</span>
				)}
			</div>
			{account && pending > 0 ? (
				<p className="mt-4 border-t border-white/10 pt-3 text-xs text-ink-dim">
					≈ <span className="text-ink">{formatUsd(pending)}</span> accruing this epoch — claimable after{' '}
					<span className="text-ink">{unlockDate}</span>.
				</p>
			) : null}
		</div>
	);
}
