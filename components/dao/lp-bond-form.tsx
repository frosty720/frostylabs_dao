'use client';

import { useCallback, useEffect, useState } from 'react';
import { prepareContractCall, readContract } from 'thirdweb';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { contractAt } from '@/lib/contract';
import { CONTRACTS } from '@/lib/contracts';
import { TxButton } from '@/components/dao/tx-button';
import { Button } from '@/components/ui/button';
import { formatUsd, toUnits } from '@/lib/format';
import type { LpBondDetail } from '@/lib/reads/bonds';

const pm = contractAt(CONTRACTS.positionManager);

interface EligiblePosition {
	tokenId: bigint;
	valueUsd: number;
}

export function LpBondForm({ detail }: { detail: LpBondDetail }) {
	const account = useActiveAccount();
	const [positions, setPositions] = useState<EligiblePosition[]>([]);
	const [selected, setSelected] = useState<bigint | null>(null);
	const [scanning, setScanning] = useState(false);

	// Enumerate the wallet's Uniswap V3 positions, keep the ones this market actually accepts.
	// validatePosition is the authoritative check (pair, fee, tick range, min liquidity, not
	// already bonded, non-zero oracle value) and also returns the USD value we display.
	const scan = useCallback(async () => {
		if (!account) {
			setPositions([]);
			setSelected(null);
			return;
		}
		setScanning(true);
		try {
			const market = contractAt(detail.address);
			const balance = (await readContract({
				contract: pm,
				method: 'function balanceOf(address owner) view returns (uint256)',
				params: [account.address],
			})) as bigint;

			const found: EligiblePosition[] = [];
			for (let i = 0n; i < balance; i++) {
				const tokenId = (await readContract({
					contract: pm,
					method: 'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
					params: [account.address, i],
				})) as bigint;

				const pos = (await readContract({
					contract: pm,
					method:
						'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 f0, uint256 f1, uint128 owed0, uint128 owed1)',
					params: [tokenId],
				})) as readonly unknown[];

				// Cheap pre-filter before the per-position validatePosition round-trip.
				const t0 = String(pos[2]).toLowerCase();
				const t1 = String(pos[3]).toLowerCase();
				const fee = Number(pos[4]);
				const liquidity = pos[7] as bigint;
				if (t0 !== detail.token0 || t1 !== detail.token1 || fee !== detail.fee || liquidity <= 0n) continue;

				const res = (await readContract({
					contract: market,
					method: 'function validatePosition(uint256 tokenId) view returns (bool isValid, uint128 liquidity, uint256 value)',
					params: [tokenId],
				})) as readonly [boolean, bigint, bigint];
				if (!res[0]) continue;

				found.push({ tokenId, valueUsd: toUnits(res[2], 18) });
			}

			setPositions(found);
			setSelected((prev) => (prev != null && found.some((p) => p.tokenId === prev) ? prev : found[0]?.tokenId ?? null));
		} finally {
			setScanning(false);
		}
	}, [account, detail.address, detail.token0, detail.token1, detail.fee]);

	useEffect(() => {
		void scan();
	}, [scan]);

	// Approval status of the currently-selected position.
	const { data: approved, refetch } = useReadContract({
		contract: pm,
		method: 'function getApproved(uint256 tokenId) view returns (address)',
		params: [selected ?? 0n],
		queryOptions: { enabled: !!account && selected != null },
	});
	const needsApproval = !approved || approved.toLowerCase() !== detail.address.toLowerCase();

	if (!account) {
		return (
			<div className="space-y-4">
				<p className="text-sm text-ink-dim">
					Bond a {detail.pairLabel} Uniswap V3 position for a discounted, vesting FROST payout. The position becomes
					protocol-owned.
				</p>
				<Button disabled className="w-full bg-violet text-[#05060b]">
					Connect wallet
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<label className="mono-label text-ink-dim">Your {detail.pairLabel} positions</label>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => void scan()}
					disabled={scanning}
					className="h-auto p-0 text-xs text-ink-dim hover:text-ink"
				>
					{scanning ? 'Scanning…' : 'Refresh'}
				</Button>
			</div>

			{positions.length === 0 ? (
				<p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-ink-dim">
					{scanning
						? 'Scanning your wallet…'
						: `No eligible ${detail.pairLabel} positions in this wallet. Add liquidity to the ${detail.pairLabel} pool, then Refresh.`}
				</p>
			) : (
				<div className="space-y-2">
					{positions.map((p) => {
						const isSel = selected === p.tokenId;
						return (
							<button
								key={p.tokenId.toString()}
								type="button"
								onClick={() => setSelected(p.tokenId)}
								className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${
									isSel
										? 'border-violet/60 bg-violet/10 text-ink'
										: 'border-white/10 bg-white/[0.03] text-ink-dim hover:border-white/20'
								}`}
							>
								<span className="font-mono">Position #{p.tokenId.toString()}</span>
								<span className={isSel ? 'text-violet' : 'text-ink-dim'}>≈ {formatUsd(p.valueUsd)}</span>
							</button>
						);
					})}
				</div>
			)}

			<p className="text-xs text-ink-dim">
				The market values the position via the oracle and issues a vesting FROST bond. The position becomes
				protocol-owned.
			</p>

			{needsApproval ? (
				<TxButton
					label="Approve position"
					pendingLabel="Approving…"
					disabled={selected == null}
					className="w-full bg-violet text-[#05060b] hover:bg-violet/90"
					prepare={() =>
						prepareContractCall({
							contract: pm,
							method: 'function approve(address to, uint256 tokenId)',
							params: [detail.address, selected as bigint],
						})
					}
					onDone={() => void refetch()}
				/>
			) : (
				<TxButton
					label="Bond position"
					pendingLabel="Bonding…"
					disabled={selected == null}
					className="w-full bg-violet text-[#05060b] hover:bg-violet/90"
					prepare={() =>
						prepareContractCall({
							contract: contractAt(detail.address),
							method: 'function purchaseBond(uint256 tokenId) returns (uint256)',
							params: [selected as bigint],
						})
					}
					onDone={() => void scan()}
				/>
			)}
		</div>
	);
}
