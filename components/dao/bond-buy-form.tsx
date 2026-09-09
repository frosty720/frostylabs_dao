'use client';

import { useState } from 'react';
import { prepareContractCall, toUnits } from 'thirdweb';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { contractAt } from '@/lib/contract';
import { TxButton } from '@/components/dao/tx-button';
import { Input } from '@/components/ui/input';
import { formatNumber, formatUsd } from '@/lib/format';
import type { Erc20BondDetail } from '@/lib/reads/bonds';

const ZERO = '0x0000000000000000000000000000000000000000';

export function BondBuyForm({ detail }: { detail: Erc20BondDetail }) {
	const account = useActiveAccount();
	const [amount, setAmount] = useState('');

	const principal = contractAt(detail.principalToken);
	const market = contractAt(detail.address);
	const sym = detail.principalSymbol;

	const parsed = Number(amount);
	const valid = isFinite(parsed) && parsed > 0;
	const amountRaw = valid ? toUnits(amount, detail.principalDecimals) : 0n;

	// FROST out = USD / price * (1 + discount)
	const quoteFrost = valid && detail.priceUsd > 0 ? (parsed / detail.priceUsd) * (1 + detail.discountBps / 10_000) : 0;
	const belowMin = valid && parsed < detail.minPurchase;

	const { data: allowance, refetch: refetchAllowance } = useReadContract({
		contract: principal,
		method: 'function allowance(address owner, address spender) view returns (uint256)',
		params: [account?.address ?? ZERO, detail.address as `0x${string}`],
		queryOptions: { enabled: !!account },
	});

	const needsApproval = !allowance || allowance < amountRaw;

	return (
		<div className="space-y-4">
			<div>
				<label className="mono-label text-ink-dim">Amount ({sym})</label>
				<Input
					inputMode="decimal"
					placeholder={`min ${formatNumber(detail.minPurchase, { maximumFractionDigits: 6 })} ${sym}`}
					value={amount}
					onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
					className="mt-2 border-white/10 bg-white/5 text-ink placeholder:text-ink-dim/60"
				/>
			</div>

			<div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
				<div className="flex items-center justify-between">
					<span className="text-ink-dim">You receive</span>
					<span className="font-semibold text-cyan">{formatNumber(quoteFrost, { maximumFractionDigits: 2 })} FROST</span>
				</div>
				<div className="mt-1 flex items-center justify-between text-xs text-ink-dim">
					<span>Bond price</span>
					<span>{formatUsd(detail.priceUsd)} · vests over {Math.round(detail.vestingSeconds / 86400)}d</span>
				</div>
			</div>

			{belowMin ? (
				<p className="text-xs text-magenta">Minimum purchase is {formatNumber(detail.minPurchase, { maximumFractionDigits: 6 })} {sym}.</p>
			) : null}

			{needsApproval ? (
				<TxButton
					label={`Approve ${valid ? formatNumber(parsed) : ''} ${sym}`.replace(/\s+/g, ' ').trim()}
					pendingLabel="Approving…"
					disabled={!valid || belowMin}
					className="w-full bg-cyan text-[#05060b] hover:bg-cyan/90"
					prepare={() =>
						prepareContractCall({
							contract: principal,
							method: 'function approve(address spender, uint256 value) returns (bool)',
							params: [detail.address as `0x${string}`, amountRaw],
						})
					}
					onDone={() => refetchAllowance()}
				/>
			) : (
				<TxButton
					label="Buy bond"
					pendingLabel="Buying…"
					disabled={!valid || belowMin}
					className="w-full bg-cyan text-[#05060b] hover:bg-cyan/90"
					prepare={() =>
						prepareContractCall({
							contract: market,
							method: 'function purchaseBond(uint256 amount) returns (uint256)',
							params: [amountRaw],
						})
					}
					onDone={() => setAmount('')}
				/>
			)}
		</div>
	);
}
