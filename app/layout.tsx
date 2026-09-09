import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

const spaceGrotesk = Space_Grotesk({ variable: '--font-display', subsets: ['latin'], weight: ['400', '500', '700'] });
const jetbrainsMono = JetBrains_Mono({ variable: '--font-mono-accent', subsets: ['latin'], weight: ['400', '500'] });

export const metadata: Metadata = {
	title: 'FrostyDAO — FROST Protocol',
	description:
		'Protocol dashboard and governance for the FROST token — revenue, protocol-owned liquidity, bond markets, locking and on-chain voting.',
	icons: { icon: '/frostylogo.png', apple: '/frostylogo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark" suppressHydrationWarning>
			<body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
				<Providers>
					<div className="relative flex min-h-screen flex-col aurora-bg">
						<div className="grid-overlay pointer-events-none absolute inset-0" />
						{/* Testnet notice — remove at mainnet launch */}
						<div className="relative z-10 border-b border-amber-400/25 bg-amber-400/10 px-4 py-2 text-center">
							<span className="mono-label text-amber-300">
								⚠ Testnet demo — all protocol data reads Base Sepolia. Mainnet $FROST TGE Coming Soon.
							</span>
						</div>
						<Navigation />
						<main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
							{children}
						</main>
						<Footer />
					</div>
					<Toaster theme="dark" position="bottom-right" richColors />
				</Providers>
			</body>
		</html>
	);
}
