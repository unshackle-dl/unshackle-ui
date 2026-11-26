import { useMemo } from 'react';
import { encode } from 'uqr';

/** The text of a login QR code drawn as one, dark on white in either theme so a phone camera reads it. */
export default function QrCode({ text }: { text: string }) {
	const code = useMemo(() => {
		try {
			const { data } = encode(text, { border: 2 });
			const path = data
				.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
				.join('');
			return { size: data.length, path };
		} catch {
			return null; // longer than a QR code holds; the prompt or notice beside it still shows
		}
	}, [text]);
	if (!code) return null;
	return (
		<svg
			viewBox={`0 0 ${code.size} ${code.size}`}
			role="img"
			aria-label="QR code to scan with your phone"
			shapeRendering="crispEdges"
			className="mt-4 size-48 rounded-lg bg-white"
		>
			<path d={code.path} fill="#000" />
		</svg>
	);
}
