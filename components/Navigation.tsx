'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ConnectWallet } from '@/components/dao/connect-wallet';

const LINKS = [
	{ href: '/', label: 'Overview' },
	{ href: '/revenue', label: 'Revenue' },
	{ href: '/treasury', label: 'Treasury' },
	{ href: '/bonds', label: 'Bonds' },
	{ href: '/lock', label: 'Lock' },
	{ href: '/governance', label: 'Governance' },
];

export function Navigation() {
	const pathname = usePathname();
	return (
		<header className="sticky top-0 z-40 border-b border-white/10 bg-[#05060b]/70 backdrop-blur-xl">
			<div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<Link href="/" className="flex items-center gap-2.5">
					<Image src="/frostylogo.png" alt="FrostyDAO logo" width={36} height={36} className="rounded-lg" />
					<span className="font-display text-lg font-semibold tracking-tight aurora-text">FrostyDAO</span>
				</Link>

				<nav className="hidden items-center gap-6 text-sm md:flex">
					{LINKS.map((l) => {
						const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
						return (
							<Link
								key={l.href}
								href={l.href}
								className={cn(
									'transition-colors hover:text-ink',
									active ? 'text-ink' : 'text-ink-dim',
								)}
							>
								{l.label}
							</Link>
						);
					})}
				</nav>

				<ConnectWallet />
			</div>
		</header>
	);
}
