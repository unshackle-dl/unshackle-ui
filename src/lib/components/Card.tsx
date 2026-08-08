import type { ReactNode } from 'react';

export default function Card({
	className = '',
	children
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			className={`rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-800/50 ${className}`}
		>
			{children}
		</div>
	);
}
