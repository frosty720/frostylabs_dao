import { CONTRACTS } from '@/lib/contracts';

export type ProposalAction = {
	target: `0x${string}`;
	value: string; // native value in wei, decimal string (form-friendly)
	calldata: `0x${string}`;
};

// `votingDelay()` selector on the Governor. It is a zero-arg *view*: calling it changes
// nothing and cannot revert, which is exactly what a signaling no-op needs.
export const SIGNALING_NOOP_CALLDATA = '0x3932abb1' as const;

/**
 * The no-op action attached to a signaling ("vote only") proposal.
 *
 * OpenZeppelin's Governor requires every proposal to carry at least one action, but
 * FrostyDAO governance is *signaling-only*: the Timelock holds no role on any protocol
 * contract — mint, treasury, oracle, and bond settings all stay under the founder
 * multisig — so a proposal cannot move funds or change protocol state. To satisfy the
 * ≥1-action rule without granting the Timelock any power, we attach one harmless call:
 * the Governor reading its own `votingDelay()`. Being a view, it is safe to execute, has
 * no side effect, and never reverts, so a passed signal can still queue + execute cleanly
 * through the timelock. The vote result itself is the outcome; the team actions approved
 * signals from the multisig.
 */
export function buildSignalingAction(): ProposalAction {
	return { target: CONTRACTS.governor, value: '0', calldata: SIGNALING_NOOP_CALLDATA };
}

/** True when `p` carries exactly the signaling no-op (governor.votingDelay()). */
export function isSignalingProposal(p: { targets: string[]; calldatas: string[] }): boolean {
	return (
		p.targets.length === 1 &&
		p.calldatas.length === 1 &&
		p.targets[0].toLowerCase() === CONTRACTS.governor.toLowerCase() &&
		p.calldatas[0].toLowerCase() === SIGNALING_NOOP_CALLDATA
	);
}

/**
 * Compose the on-chain description from a title + optional details. The first line is the
 * title (rendered as the proposal heading); the remainder is the body. The full string is
 * hashed into the proposal id, so it must be unique across proposals.
 */
export function composeSignalingDescription(title: string, body: string): string {
	const t = title.trim();
	const b = body.trim();
	return b ? `${t}\n\n${b}` : t;
}

/** Split a stored description back into { title, body } for display. */
export function splitDescription(description: string): { title: string; body: string } {
	const idx = description.indexOf('\n');
	if (idx === -1) return { title: description.trim(), body: '' };
	return { title: description.slice(0, idx).trim(), body: description.slice(idx + 1).trim() };
}
