import { contractAt, readUint } from '@/lib/contract';
import { CONTRACTS } from '@/lib/contracts';
import { toUnits } from '@/lib/format';

export interface LockGlobal {
	totalLockedFrost: number;
	totalWeight: number;
	maxLockDays: number;
}

export async function getLockStats(): Promise<LockGlobal> {
	const frost = contractAt(CONTRACTS.frost);
	const locker = contractAt(CONTRACTS.permaLocker);

	const [totalLocked, totalWeight, maxtime] = await Promise.all([
		readUint(frost, 'function balanceOf(address) view returns (uint256)', [CONTRACTS.permaLocker]),
		readUint(locker, 'function totalSupply() view returns (uint256)'),
		readUint(locker, 'function MAXTIME() view returns (uint256)'),
	]);

	return {
		totalLockedFrost: toUnits(totalLocked, 18),
		totalWeight: toUnits(totalWeight, 18),
		maxLockDays: Number(maxtime) / 86400,
	};
}
