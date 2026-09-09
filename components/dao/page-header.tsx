export function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
	return (
		<header>
			<div className="mono-label text-cyan">{eyebrow}</div>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
				<span className="aurora-text">{title}</span>
			</h1>
			{subtitle ? <p className="mt-3 max-w-2xl text-ink-dim">{subtitle}</p> : null}
		</header>
	);
}
