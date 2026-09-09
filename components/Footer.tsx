import { isTestnet } from '@/lib/thirdweb';

export function Footer() {
	return (
		<footer className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
			<div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-ink-dim sm:flex-row">
				<span>FrostyDAO · FROST protocol</span>
				<span className="mono-label text-ink-dim">
					{isTestnet ? 'Base Sepolia · testnet' : 'Base · mainnet'}
				</span>
			</div>
		</footer>
	);
}
