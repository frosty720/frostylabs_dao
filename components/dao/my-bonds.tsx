'use client';

import { useCallback, useEffect, useState } from 'react';
import { prepareContractCall, readContract } from 'thirdweb';
import { useActiveAccount } from 'thirdweb/react';
import { contractAt } from '@/lib/contract';
import { ERC20_BOND_MARKETS, LP_BOND_MARKETS } from '@/lib/contracts';
import { TxButton } from '@/components/dao/tx-button';
import { Button } from '@/components/ui/button';
import { toUnits, formatNumber, formatPercent } from '@/lib/format';

interface BondRow {
	marketAddress: string;
	marketLabel: string;
	bondId: bigint;
	payout: number;
	claimed: number;
	pending: number;
	canClaim: boolean;
	active: boolean;
}

export function MyBonds({ markets: marketsProp }: { markets?: { address: string; label: string }[] }) {
	const account = useActiveAccount();
	const [rows, setRows] = useState<BondRow[]>([]);
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		if (!account) {
			setRows([]);
			return;
		}
		// Every ERC-20 and LP bond market. The parent passes resolved labels; fall back to the
		// configured market lists if none were provided.
		const markets =
			marketsProp ??
			[
				...ERC20_BOND_MARKETS.map((a) => ({ address: a, label: 'Bond' })),
				...LP_BOND_MARKETS.map((a) => ({ address: a, label: 'LP Bond' })),
			];
		setLoading(true);
		try {
			const collected: BondRow[] = [];
			for (const m of markets) {
				const c = contractAt(m.address);
				const ids = (await readContract({
					contract: c,
					method: 'function getBondsByOwner(address owner) view returns (uint256[])',
					params: [account.address],
				})) as readonly bigint[];
				for (const bondId of ids) {
					const bond = (await readContract({
						contract: c,
						method:
							'function getBond(uint256 bondId) view returns ((address owner, uint256 payoutAmount, uint256 payoutClaimed, uint256 principalPaid, uint256 purchaseTime, uint256 vestingTerm, bool active))',
						params: [bondId],
					})) as { payoutAmount: bigint; payoutClaimed: bigint; active: boolean };
					const [canClaim, pending] = (await readContract({
						contract: c,
						method: 'function pendingPayoutFor(uint256 bondId) view returns (bool canClaim, uint256 pendingAmount)',
						params: [bondId],
					})) as readonly [boolean, bigint];
					collected.push({
						marketAddress: m.address,
						marketLabel: m.label,
						bondId,
						payout: toUnits(bond.payoutAmount, 18),
						claimed: toUnits(bond.payoutClaimed, 18),
						pending: toUnits(pending, 18),
						canClaim,
						active: bond.active,
					});
				}
			}
			setRows(collected);
		} finally {
			setLoading(false);
		}
	}, [account, marketsProp]);

	useEffect(() => {
		void load();
	}, [load]);

	if (!account) {
		return <p className="text-sm text-ink-dim">Connect your wallet to see your bonds.</p>;
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold text-ink">Your Bonds</h3>
				<Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="text-ink-dim hover:text-ink">
					{loading ? 'Loading…' : 'Refresh'}
				</Button>
			</div>

			{rows.length === 0 ? (
				<p className="text-sm text-ink-dim">{loading ? 'Loading…' : 'No bonds yet.'}</p>
			) : (
				(() => {
					// A bond with nothing left to pay out is history, not an action item — render it
					// as a compact row instead of a card with a dead Redeem button.
					const open = rows.filter((r) => r.payout - r.claimed > 1e-6);
					const spent = rows.filter((r) => r.payout - r.claimed <= 1e-6);
					return (
						<div className="space-y-5">
							{open.length > 0 ? (
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									{open.map((r) => {
										const vestedPct = r.payout > 0 ? (r.claimed + r.pending) / r.payout : 0;
										return (
											<div key={`${r.marketAddress}-${r.bondId}`} className="frosted-glass rounded-xl p-4">
												<div className="flex items-center justify-between">
													<span className="mono-label text-ink-dim">
														{r.marketLabel} #{r.bondId.toString()}
													</span>
													<span className="text-xs text-ink-dim">{formatPercent(vestedPct)} vested</span>
												</div>
												<div className="mt-3 text-xl font-semibold text-ink">
													{formatNumber(r.payout, { maximumFractionDigits: 2 })}{' '}
													<span className="text-sm text-ink-dim">FROST</span>
												</div>
												<div className="mt-1 text-sm text-ink-dim">
													claimed {formatNumber(r.claimed, { maximumFractionDigits: 2 })} · claimable{' '}
													<span className="text-cyan">{formatNumber(r.pending, { maximumFractionDigits: 2 })}</span>
												</div>
												<div className="mt-3">
													<TxButton
														label="Redeem"
														pendingLabel="Redeeming…"
														disabled={!r.canClaim || r.pending <= 0}
														variant="outline"
														className="w-full border-white/10 text-ink hover:bg-white/5"
														prepare={() =>
															prepareContractCall({
																contract: contractAt(r.marketAddress),
																method: 'function redeemBond(uint256 bondId) returns (uint256)',
																params: [r.bondId],
															})
														}
														onDone={() => void load()}
													/>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<p className="text-sm text-ink-dim">No open bonds.</p>
							)}
							{spent.length > 0 ? (
								<div>
									<div className="mono-label mb-2 text-ink-dim/70">Fully claimed</div>
									<div className="frosted-glass divide-y divide-white/5 rounded-xl">
										{spent.map((r) => (
											<div
												key={`${r.marketAddress}-${r.bondId}`}
												className="flex items-center justify-between px-4 py-2.5 text-sm"
											>
												<span className="mono-label text-ink-dim">
													{r.marketLabel} #{r.bondId.toString()}
												</span>
												<span className="text-ink-dim">
													{formatNumber(r.payout, { maximumFractionDigits: 2 })} FROST claimed
												</span>
											</div>
										))}
									</div>
								</div>
							) : null}
						</div>
					);
				})()
			)}
		</div>
	);
}
