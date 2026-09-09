import { cn } from '@/lib/utils';

interface StatCardProps {
	label: string;
	value: string;
	sub?: string;
	/** Plain-language explanation shown in a hover/focus tooltip behind an ⓘ icon. */
	info?: string;
	accent?: 'cyan' | 'violet' | 'magenta' | 'ink';
	className?: string;
}

const ACCENT: Record<NonNullable<StatCardProps['accent']>, string> = {
	cyan: 'text-cyan',
	violet: 'text-violet',
	magenta: 'text-magenta',
	ink: 'text-ink',
};

export function StatCard({ label, value, sub, info, accent = 'ink', className }: StatCardProps) {
	return (
		// backdrop-blur makes every card a stacking context, so a later sibling would paint
		// over this card's open tooltip — lift the hovered/focused card above its siblings.
		<div className={cn('frosted-glass relative rounded-xl p-5 hover:z-30 focus-within:z-30', className)}>
			{info ? (
				// CSS-only tooltip: hover on pointer devices, focus (tab or tap) elsewhere.
				<span tabIndex={0} className="group absolute right-4 top-4 cursor-help outline-none" aria-label={info}>
					<svg
						viewBox="0 0 16 16"
						className="h-4 w-4 text-ink-dim/50 transition-colors group-hover:text-ink-dim group-focus:text-ink-dim"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.25"
						aria-hidden="true"
					>
						<circle cx="8" cy="8" r="6.75" />
						<path d="M8 7.5v3.75" strokeLinecap="round" />
						<circle cx="8" cy="4.75" r="0.75" fill="currentColor" stroke="none" />
					</svg>
					<span className="pointer-events-none invisible absolute right-0 top-6 z-20 w-64 rounded-lg border border-white/10 bg-popover p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-ink-dim opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100">
						{info}
					</span>
				</span>
			) : null}
			<div className="mono-label text-ink-dim">{label}</div>
			<div className={cn('mt-3 text-2xl font-semibold tracking-tight sm:text-3xl', ACCENT[accent])}>
				{value}
			</div>
			{sub ? <div className="mt-1 text-sm text-ink-dim">{sub}</div> : null}
		</div>
	);
}
