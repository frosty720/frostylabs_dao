'use client';

import { useState } from 'react';
import { prepareContractCall } from 'thirdweb';
import { useActiveAccount } from 'thirdweb/react';
import { contractAt } from '@/lib/contract';
import { CONTRACTS } from '@/lib/contracts';
import { TxButton } from '@/components/dao/tx-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildSignalingAction, composeSignalingDescription } from '@/lib/proposals';

const gov = contractAt(CONTRACTS.governor);

export function ProposeForm() {
	const account = useActiveAccount();
	const [title, setTitle] = useState('');
	const [details, setDetails] = useState('');

	const valid = title.trim().length >= 4;

	const fieldCls =
		'mt-2 border-white/10 bg-white/5 text-ink placeholder:text-ink-dim/60 focus-visible:border-cyan/40';

	return (
		<div className="frosted-glass space-y-4 rounded-xl p-6">
			<div>
				<h3 className="text-lg font-semibold text-ink">Create a proposal</h3>
				<p className="mt-1 text-sm text-ink-dim">
					Put a question or direction to the community. Lockers vote with their PERMA.
				</p>
			</div>

			<div>
				<label className="mono-label text-ink-dim">Title</label>
				<Input
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="e.g. Prioritize a SushiSwap bond next quarter"
					maxLength={120}
					className={fieldCls}
				/>
			</div>

			<div>
				<label className="mono-label text-ink-dim">
					Details <span className="text-ink-dim/60">(optional)</span>
				</label>
				<textarea
					value={details}
					onChange={(e) => setDetails(e.target.value)}
					placeholder="Explain the rationale, add links, and say what a 'For' vote commits the community to."
					rows={5}
					className={`${fieldCls} block w-full rounded-md px-3 py-2 text-sm outline-none`}
				/>
			</div>

			<div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-ink-dim">
				<span className="mono-label text-cyan">How proposals work</span>
				<p className="mt-1.5">
					The community votes to show support or direction. Approved proposals are actioned by the team from
					the multisig — treasury, minting, and bond settings stay under multisig control while governance is
					young. Direct on-chain execution of protocol changes opens up as the DAO decentralizes. Your vote is
					recorded on-chain either way.
				</p>
			</div>

			{!account ? (
				<Button disabled className="w-full bg-cyan text-[#05060b]">
					Connect wallet
				</Button>
			) : (
				<TxButton
					label="Submit proposal"
					pendingLabel="Submitting…"
					disabled={!valid}
					className="w-full bg-cyan text-[#05060b] hover:bg-cyan/90"
					prepare={() => {
						const action = buildSignalingAction();
						const description = composeSignalingDescription(title, details);
						return prepareContractCall({
							contract: gov,
							method:
								'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
							params: [[action.target], [BigInt(action.value)], [action.calldata], description],
						});
					}}
					onDone={() => {
						setTitle('');
						setDetails('');
					}}
				/>
			)}
		</div>
	);
}
