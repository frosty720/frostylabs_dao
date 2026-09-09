import { createThirdwebClient } from 'thirdweb';
import { defineChain } from 'thirdweb/chains';
import { createWallet, inAppWallet } from 'thirdweb/wallets';

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
	console.warn('NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set — reads use the public RPC, wallet connect needs a real id.');
}

export const client = createThirdwebClient({
	clientId: clientId || '87654321876543218765432187654321', // dev/build fallback
});

// 84532 = Base Sepolia (testnet, current). 8453 = Base mainnet. Flip via env when we go live.
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);

// A public RPC per chain so read-only pages work without a thirdweb client id.
const DEFAULT_RPC: Record<number, string> = {
	84532: 'https://base-sepolia-rpc.publicnode.com',
	8453: 'https://base-rpc.publicnode.com',
};
const rpc = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC[CHAIN_ID];

export const chain = defineChain(rpc ? { id: CHAIN_ID, rpc } : CHAIN_ID);

export const isTestnet = CHAIN_ID === 84532;
export const explorerBase = isTestnet ? 'https://sepolia.basescan.org' : 'https://basescan.org';

export const wallets = [
	createWallet('io.metamask'),
	createWallet('com.coinbase.wallet'),
	createWallet('me.rainbow'),
	createWallet('io.rabby'),
	inAppWallet({ auth: { options: ['google', 'email', 'passkey'] } }),
];
