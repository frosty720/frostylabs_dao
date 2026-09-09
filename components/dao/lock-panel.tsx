'use client';

import { useState } from 'react';
import { prepareContractCall, toUnits } from 'thirdweb';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { contractAt } from '@/lib/contract';
import { CONTRACTS } from '@/lib/contracts';
import { TxButton } from '@/components/dao/tx-button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/dao/stat-card';
import { toUnits as scale, formatNumber, formatPercent } from '@/lib/format';

const frost = contractAt(CONTRACTS.frost);
const locker = contractAt(CONTRACTS.permaLocker);
const votes = contractAt(CONTRACTS.permaLockerVotes);
const ZERO = '0x0000000000000000000000000000000000000000';

const WEEK = 604_800;
const MAXTIME = 1460 * 86_400; // 4 * 365 days
const DURATIONS = [
	{ label: '3 months', seconds: 90 * 86_400 },
	{ label: '6 months', seconds: 182 * 86_400 },
	{ label: '1 year', seconds: 365 * 86_400 },
	{ label: '2 years', seconds: 730 * 86_400 },
	{ label: 'Max (~4y)', seconds: MAXTIME - WEEK },
];

export function LockPanel() {
	const account = useActiveAccount();
	const owner = account?.address ?? ZERO;
	const [amount, setAmount] = useState('');
	const [durIdx, setDurIdx] = useState(2);

	const enabled = { queryOptions: { enabled: !!account } } as const;
	const { data: frostBal } = useReadContract({ contract: frost, method: 'function balanceOf(address) view returns (uint256)', params: [owner], ...enabled });
	const { data: allowance, refetch: refetchAllowance } = useReadContract({ contract: frost, method: 'function allowance(address,address) view returns (uint256)', params: [owner, CONTRACTS.permaLocker], ...enabled });
	const { data: lockedAmount, refetch: refetchLocked } = useReadContract({ contract: locker, method: 'function lockedAmountOf(address) view returns (uint256)', params: [owner], ...enabled });
	const { data: lockEnd, refetch: refetchEnd } = useReadContract({ contract: locker, method: 'function lockEndOf(address) view returns (uint256)', params: [owner], ...enabled });
	const { data: weight, refetch: refetchWeight } = useReadContract({ contract: locker, method: 'function balanceOf(address) view returns (uint256)', params: [owner], ...enabled });
	const { data: votingPower, refetch: refetchVotes } = useReadContract({ contract: votes, method: 'function getVotes(address) view returns (uint256)', params: [owner], ...enabled });

	function refreshAll() {
		refetchAllowance();
		refetchLocked();
		refetchEnd();
		refetchWeight();
		refetchVotes();
	}

	const parsed = Number(amount);
	const valid = isFinite(parsed) && parsed > 0;
	const amountRaw = valid ? toUnits(amount, 18) : 0n;
	const needsApproval = !allowance || allowance < amountRaw;

	const rawLocked = scale(lockedAmount ?? 0n, 18);
	const perma = scale(weight ?? 0n, 18);
	const ivotes = scale(votingPower ?? 0n, 18);
	// Resilient: show the position if EITHER the locked-amount OR the PERMA-balance read
	// resolves, so one flaky RPC read can't blank the whole panel.
	const hasLock = rawLocked > 0 || perma > 0;
	const endTs = Number(lockEnd ?? 0n);
	const nowTs = Math.floor(Date.now() / 1000);
	const expired = hasLock && endTs > 0 && endTs <= nowTs;

	// createLock weight preview: amount * (alignedEnd - now) / MAXTIME
	const durSeconds = DURATIONS[durIdx].seconds;
	const alignedEnd = Math.floor((nowTs + durSeconds) / WEEK) * WEEK;
	const previewWeight = valid ? parsed * ((alignedEnd - nowTs) / MAXTIME) : 0;

	if (!account) {
		return <p className="text-sm text-ink-dim">Connect your wallet to lock FROST and vote.</p>;
	}

	return (
		<div className="space-y-6">
			{hasLock ? (
				<div className="space-y-3">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<StatCard label="Your PERMA" value={`${formatNumber(perma, { compact: true })}`} sub="soulbound · your vote weight" accent="cyan" />
						<StatCard label="Locked FROST" value={`${formatNumber(rawLocked, { compact: true })}`} accent="magenta" />
						<StatCard label={expired ? 'Status' : 'Unlocks'} value={expired ? 'Unlocked' : new Date(endTs * 1000).toLocaleDateString()} sub={expired ? 'withdrawable' : `${formatNumber(ivotes, { compact: true })} IVotes`} />
					</div>
					<p className="text-xs text-ink-dim">
						PERMA is your soulbound lock receipt for {account.address.slice(0, 6)}…{account.address.slice(-4)} — it can&apos;t be
						transferred, and its weight decays toward zero as the unlock date nears.
					</p>
				</div>
			) : null}

			<div className="frosted-glass rounded-xl p-6">
				{expired ? (
					<div className="space-y-4">
						<h3 className="text-lg font-semibold text-ink">Withdraw</h3>
						<p className="text-sm text-ink-dim">Your lock has expired. Withdraw the full position.</p>
						<TxButton
							label={`Withdraw ${formatNumber(rawLocked, { compact: true })} FROST`}
							pendingLabel="Withdrawing…"
							className="w-full bg-cyan text-[#05060b] hover:bg-cyan/90"
							prepare={() => prepareContractCall({ contract: locker, method: 'function withdraw()', params: [] })}
							onDone={refreshAll}
						/>
					</div>
				) : (
					<div className="space-y-4">
						<h3 className="text-lg font-semibold text-ink">{hasLock ? 'Add to your lock' : 'Create a lock'}</h3>
						<div>
							<label className="mono-label text-ink-dim">Amount (FROST)</label>
							<Input
								inputMode="decimal"
								placeholder={`balance ${formatNumber(scale(frostBal ?? 0n, 18), { maximumFractionDigits: 2 })}`}
								value={amount}
								onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
								className="mt-2 border-white/10 bg-white/5 text-ink placeholder:text-ink-dim/60"
							/>
						</div>

						{!hasLock ? (
							<div>
								<label className="mono-label text-ink-dim">Lock duration</label>
								<div className="mt-2 flex flex-wrap gap-2">
									{DURATIONS.map((d, i) => (
										<button
											key={d.label}
											type="button"
											onClick={() => setDurIdx(i)}
											className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
												i === durIdx ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-white/10 text-ink-dim hover:text-ink'
											}`}
										>
											{d.label}
										</button>
									))}
								</div>
							</div>
						) : null}

						<div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-ink-dim">{hasLock ? 'New total weight (approx)' : 'Est. vote weight'}</span>
								<span className="font-semibold text-cyan">
									{formatNumber(hasLock ? scale(weight ?? 0n, 18) + parsed * ((endTs - nowTs) / MAXTIME) : previewWeight, { maximumFractionDigits: 0 })}
								</span>
							</div>
							{!hasLock ? (
								<div className="mt-1 flex items-center justify-between text-xs text-ink-dim">
									<span>Decay factor</span>
									<span>{formatPercent((alignedEnd - nowTs) / MAXTIME)} of amount</span>
								</div>
							) : null}
						</div>

						{needsApproval ? (
							<TxButton
								label="Approve FROST"
								pendingLabel="Approving…"
								disabled={!valid}
								className="w-full bg-cyan text-[#05060b] hover:bg-cyan/90"
								prepare={() => prepareContractCall({ contract: frost, method: 'function approve(address,uint256) returns (bool)', params: [CONTRACTS.permaLocker, amountRaw] })}
								onDone={() => refetchAllowance()}
							/>
						) : hasLock ? (
							<TxButton
								label="Add to lock"
								pendingLabel="Adding…"
								disabled={!valid}
								className="w-full bg-cyan text-[#05060b] hover:bg-cyan/90"
								prepare={() => prepareContractCall({ contract: locker, method: 'function increaseAmount(uint256)', params: [amountRaw] })}
								onDone={() => { setAmount(''); refreshAll(); }}
							/>
						) : (
							<TxButton
								label="Create lock"
								pendingLabel="Locking…"
								disabled={!valid}
								className="w-full bg-cyan text-[#05060b] hover:bg-cyan/90"
								prepare={() => prepareContractCall({ contract: locker, method: 'function createLock(uint256,uint256)', params: [amountRaw, BigInt(nowTs + durSeconds)] })}
								onDone={() => { setAmount(''); refreshAll(); }}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
