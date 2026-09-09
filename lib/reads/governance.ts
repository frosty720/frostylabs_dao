import { getContractEvents, prepareEvent } from 'thirdweb';
import { getRpcClient, eth_blockNumber } from 'thirdweb/rpc';
import { keccak256, stringToBytes } from 'thirdweb/utils';
import { contractAt, readUint, readAny, safe } from '@/lib/contract';
import { client, chain } from '@/lib/thirdweb';
import { CONTRACTS } from '@/lib/contracts';
import { toUnits } from '@/lib/format';

// publicnode caps eth_getLogs at 50k blocks per call.
const CHUNK = 50_000n;
const FROM_BLOCK = BigInt(process.env.NEXT_PUBLIC_GOV_FROM_BLOCK ?? '45400000');

const proposalCreated = prepareEvent({
	signature:
		'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
});

export const PROPOSAL_STATES = [
	'Pending',
	'Active',
	'Canceled',
	'Defeated',
	'Succeeded',
	'Queued',
	'Expired',
	'Executed',
] as const;

export interface ProposalView {
	id: string; // decimal string (bigint-safe for client props)
	proposer: string;
	description: string;
	targets: string[];
	values: string[]; // decimal strings
	calldatas: string[];
	descriptionHash: string;
	state: number;
	forVotes: number;
	againstVotes: number;
	abstainVotes: number;
	quorum: number;
	voteStart: number;
	voteEnd: number;
	eta: number;
}

export async function getProposals(): Promise<ProposalView[]> {
	const gov = contractAt(CONTRACTS.governor);
	const rpc = getRpcClient({ client, chain });
	const latest = await safe(eth_blockNumber(rpc), FROM_BLOCK);

	// Proposals come from two sources, merged and de-duped by id — neither is complete alone:
	//  1. thirdweb Insight (useIndexer:true) has the full history, but it lags the chain head by
	//     up to a few minutes, so a just-created proposal is briefly absent.
	//  2. a direct RPC scan (useIndexer:false) of the recent tail has the newest proposals
	//     immediately. The public node only serves logs for a recent window (it can't see a
	//     multi-day-old proposal), so it can't replace the indexer for history — hence both.
	const indexed = safe(
		getContractEvents({ contract: gov, events: [proposalCreated], fromBlock: FROM_BLOCK, useIndexer: true }),
		[] as Awaited<ReturnType<typeof getContractEvents>>,
	);

	// Fresh tail via RPC, chunked to respect the public node's 50k-block getLogs cap. The tail
	// only has to be wide enough to cover the indexer's lag; older proposals come from Insight.
	const TAIL = 100_000n;
	const tailFrom = latest > FROM_BLOCK + TAIL ? latest - TAIL : FROM_BLOCK;
	const tailScans: Promise<Awaited<ReturnType<typeof getContractEvents>>>[] = [];
	for (let from = tailFrom; from <= latest; from += CHUNK) {
		const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
		tailScans.push(
			safe(
				getContractEvents({ contract: gov, events: [proposalCreated], fromBlock: from, toBlock: to, useIndexer: false }),
				[] as Awaited<ReturnType<typeof getContractEvents>>,
			),
		);
	}

	const [indexedEvents, ...tailChunks] = await Promise.all([indexed, ...tailScans]);
	const byId = new Map<string, (typeof indexedEvents)[number]>();
	for (const e of [...indexedEvents, ...tailChunks.flat()]) {
		byId.set((e.args as { proposalId: bigint }).proposalId.toString(), e);
	}
	const events = [...byId.values()];

	const proposals = await Promise.all(
		events.map(async (e) => {
			const args = e.args as {
				proposalId: bigint;
				proposer: string;
				targets: readonly string[];
				values: readonly bigint[];
				calldatas: readonly string[];
				voteStart: bigint;
				voteEnd: bigint;
				description: string;
			};
			const id = args.proposalId;

			const [state, votes, eta] = await Promise.all([
				readUint(gov, 'function state(uint256) view returns (uint8)', [id]),
				readAny<unknown>(
					gov,
					'function proposalVotes(uint256) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)',
					[id],
					[0n, 0n, 0n],
				),
				readUint(gov, 'function proposalEta(uint256) view returns (uint256)', [id]),
			]);

			// quorum(snapshot) reverts while the snapshot is still in the future (Pending) — guard it.
			const quorum = Number(state) === 0 ? 0n : await readUint(gov, 'function quorum(uint256) view returns (uint256)', [args.voteStart]);

			const [against, forV, abstain] = Array.isArray(votes)
				? (votes as bigint[])
				: [
						(votes as { againstVotes: bigint }).againstVotes,
						(votes as { forVotes: bigint }).forVotes,
						(votes as { abstainVotes: bigint }).abstainVotes,
					];

			return {
				id: id.toString(),
				proposer: args.proposer,
				description: args.description,
				targets: [...args.targets],
				values: args.values.map((v) => v.toString()),
				calldatas: [...args.calldatas],
				descriptionHash: keccak256(stringToBytes(args.description)),
				state: Number(state),
				forVotes: toUnits(forV ?? 0n, 18),
				againstVotes: toUnits(against ?? 0n, 18),
				abstainVotes: toUnits(abstain ?? 0n, 18),
				quorum: toUnits(quorum, 18),
				voteStart: Number(args.voteStart),
				voteEnd: Number(args.voteEnd),
				eta: Number(eta),
			} satisfies ProposalView;
		}),
	);

	return proposals.sort((a, b) => b.voteStart - a.voteStart);
}

/** Single proposal by id, or null if it isn't found in the event range. */
export async function getProposal(id: string): Promise<ProposalView | null> {
	const proposals = await getProposals();
	return proposals.find((p) => p.id === id) ?? null;
}
