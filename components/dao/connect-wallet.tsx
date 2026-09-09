'use client';

import { ConnectButton, darkTheme } from 'thirdweb/react';
import { client, chain, wallets } from '@/lib/thirdweb';

// Aurora-tinted variant of thirdweb's dark theme so the connect UI matches the app.
const theme = darkTheme({
	colors: {
		modalBg: '#0b0f17',
		accentText: '#22d3ee',
		accentButtonBg: '#22d3ee',
		accentButtonText: '#05060b',
		primaryButtonBg: '#22d3ee',
		primaryButtonText: '#05060b',
		borderColor: 'rgba(255,255,255,0.10)',
	},
});

export function ConnectWallet() {
	return (
		<ConnectButton
			client={client}
			chain={chain}
			wallets={wallets}
			theme={theme}
			connectButton={{ label: 'Connect' }}
			connectModal={{ size: 'compact', showThirdwebBranding: false }}
		/>
	);
}
