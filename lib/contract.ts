import { getContract, readContract, type ThirdwebContract } from 'thirdweb';
import { client, chain } from '@/lib/thirdweb';

export const contractAt = (address: string): ThirdwebContract => getContract({ client, chain, address });

// One flaky read must not blank a whole page — fall back per call.
export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
	try {
		return await p;
	} catch {
		return fallback;
	}
}

// thirdweb's readContract infers types from a *literal* method string. These narrowed
// wrappers let us read getters dynamically without the inference collapsing to `never`.
const readTyped = readContract as unknown as (opts: {
	contract: ThirdwebContract;
	method: string;
	params: unknown[];
}) => Promise<unknown>;

export function readUint(contract: ThirdwebContract, method: string, params: unknown[] = []): Promise<bigint> {
	return safe(readTyped({ contract, method, params }) as Promise<bigint>, 0n);
}

export function readAddress(contract: ThirdwebContract, method: string, params: unknown[] = []): Promise<string> {
	return safe(readTyped({ contract, method, params }) as Promise<string>, '0x0000000000000000000000000000000000000000');
}

export function readAny<T>(contract: ThirdwebContract, method: string, params: unknown[], fallback: T): Promise<T> {
	return safe(readTyped({ contract, method, params }) as Promise<T>, fallback);
}
