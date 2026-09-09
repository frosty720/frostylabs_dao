import type { ThirdwebContract } from 'thirdweb';
import { contractAt, readUint, readAddress, readAny } from '@/lib/contract';
import { CONTRACTS } from '@/lib/contracts';
import { toUnits } from '@/lib/format';

export interface ProfileSplit {
	id: number;
	label: string;
	operatingBps: number;
	devBps: number;
	polBps: number;
	daoBps: number;
}

export interface StreamRow {
	id: number;
	label: string;
	profileLabel: string;
	enabled: boolean;
	accruedUsdc: number; // sitting in the splitter, not yet flushed
	lifetimeUsdc: number; // cumulative revenue ever routed through this stream
}

export interface RevenueData {
	profiles: ProfileSplit[];
	streams: StreamRow[];
	buckets: { operating: string; dev: string; pol: string; dao: string };
	affiliate: { n1: number; n2: number; n3: number };
	sweepableUsdc: number;
	totalRevenueUsdc: number; // cumulative revenue through the splitter
	feesToLockersTotal: number;
	feesToLockersClaimed: number;
}

const PROFILES = [
	{ id: 0, label: 'LLM streams' },
	{ id: 1, label: 'Clean streams' },
];
const STREAMS = [
	{ id: 1, label: 'Subscription' },
	{ id: 2, label: 'Deploy' },
	{ id: 3, label: 'Architect' },
	{ id: 4, label: 'x402' },
	{ id: 5, label: 'First-party' },
];

async function readObj(contract: ThirdwebContract, method: string, params: unknown[], keys: string[]): Promise<Record<string, unknown> | null> {
	const raw = await readAny<unknown>(contract, method, params, null);
	if (raw == null) return null;
	if (Array.isArray(raw)) return keys.reduce<Record<string, unknown>>((o, k, i) => ((o[k] = raw[i]), o), {});
	return raw as Record<string, unknown>;
}

export async function getRevenue(): Promise<RevenueData> {
	const splitter = contractAt(CONTRACTS.splitter);
	const feeDist = contractAt(CONTRACTS.feeDistributor);

	const profiles = await Promise.all(
		PROFILES.map(async (p) => {
			const o = await readObj(
				splitter,
				'function profiles(uint8) view returns (uint16 operatingBps, uint16 devBps, uint16 polBps, uint16 daoBps)',
				[p.id],
				['operatingBps', 'devBps', 'polBps', 'daoBps'],
			);
			return {
				id: p.id,
				label: p.label,
				operatingBps: Number(o?.operatingBps ?? 0),
				devBps: Number(o?.devBps ?? 0),
				polBps: Number(o?.polBps ?? 0),
				daoBps: Number(o?.daoBps ?? 0),
			} satisfies ProfileSplit;
		}),
	);

	const streams = await Promise.all(
		STREAMS.map(async (s) => {
			const stream = await readObj(
				splitter,
				'function streams(uint8) view returns (bool enabled, uint8 profile, uint96 flushThreshold)',
				[s.id],
				['enabled', 'profile', 'flushThreshold'],
			);
			const acc = await readObj(
				splitter,
				'function accrued(uint8) view returns (uint256 operating, uint256 dev, uint256 pol, uint256 dao)',
				[s.id],
				['operating', 'dev', 'pol', 'dao'],
			);
			const total =
				(acc?.operating as bigint ?? 0n) + (acc?.dev as bigint ?? 0n) + (acc?.pol as bigint ?? 0n) + (acc?.dao as bigint ?? 0n);
			const lifetime = await readUint(splitter, 'function streamRevenue(uint8) view returns (uint256)', [s.id]);
			const profileId = Number(stream?.profile ?? 0);
			return {
				id: s.id,
				label: s.label,
				profileLabel: PROFILES.find((p) => p.id === profileId)?.label ?? `#${profileId}`,
				enabled: Boolean(stream?.enabled),
				accruedUsdc: toUnits(total, 6),
				lifetimeUsdc: toUnits(lifetime, 6),
			} satisfies StreamRow;
		}),
	);

	const [operating, dev, pol, dao, n1, n2, n3, sweepable, totalRevenue, credited, claimed] = await Promise.all([
		readAddress(splitter, 'function operatingWallet() view returns (address)'),
		readAddress(splitter, 'function devWallet() view returns (address)'),
		readAddress(splitter, 'function polReserve() view returns (address)'),
		readAddress(splitter, 'function daoTreasury() view returns (address)'),
		readUint(splitter, 'function n1Bps() view returns (uint16)'),
		readUint(splitter, 'function n2Bps() view returns (uint16)'),
		readUint(splitter, 'function n3Bps() view returns (uint16)'),
		readUint(splitter, 'function sweepable() view returns (uint256)'),
		readUint(splitter, 'function totalRevenue() view returns (uint256)'),
		readUint(feeDist, 'function totalCredited(address) view returns (uint256)', [CONTRACTS.usdc]),
		readUint(feeDist, 'function totalClaimed(address) view returns (uint256)', [CONTRACTS.usdc]),
	]);

	return {
		profiles,
		streams,
		buckets: { operating, dev, pol, dao },
		affiliate: { n1: Number(n1), n2: Number(n2), n3: Number(n3) },
		sweepableUsdc: toUnits(sweepable, 6),
		totalRevenueUsdc: toUnits(totalRevenue, 6),
		feesToLockersTotal: toUnits(credited, 6),
		feesToLockersClaimed: toUnits(claimed, 6),
	};
}
