import type { ReactNode } from 'react';

/** A modal dialog over the page; a click on the backdrop closes it. */
export default function Overlay({
	onClose,
	label,
	width = 'max-w-2xl',
	children
}: {
	onClose: () => void;
	label: string;
	width?: string;
	children: ReactNode;
}) {
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={label}
				onClick={(e) => e.stopPropagation()}
				className={`max-h-full w-full ${width} overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900`}
			>
				{children}
			</div>
		</div>
	);
}
