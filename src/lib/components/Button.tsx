import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

const variants: Record<Variant, string> = {
	primary:
		'bg-accent-600 text-white hover:bg-accent-700 focus-visible:ring-accent-500 disabled:bg-accent-600/50',
	secondary:
		'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50 focus-visible:ring-accent-500 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700 dark:hover:bg-neutral-700/60',
	danger:
		'bg-red-100 text-red-700 hover:bg-red-200 focus-visible:ring-red-500 disabled:opacity-50 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25'
};

export default function Button({
	variant = 'primary',
	type = 'button',
	className = '',
	children,
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
	return (
		<button
			type={type}
			className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed ${variants[variant]} ${className}`}
			{...rest}
		>
			{children}
		</button>
	);
}
