import { useId, useState } from 'react';
import Button from './Button';
import Icon from './Icon';

/** A job's pending input_prompt (OTP, PIN, device-code confirmation) with its answer box. */
export default function InputPrompt({
	prompt,
	busy,
	onAnswer
}: {
	prompt: string;
	busy: boolean;
	onAnswer: (response: string) => void;
}) {
	const [answer, setAnswer] = useState('');
	const id = useId();
	return (
		<form
			className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10"
			onSubmit={(e) => {
				e.preventDefault();
				onAnswer(answer);
				setAnswer('');
			}}
		>
			<label
				htmlFor={id}
				className="flex items-start gap-2 text-sm font-medium whitespace-pre-wrap text-amber-800 dark:text-amber-200"
			>
				<Icon name="alert" size={16} className="mt-0.5 shrink-0" />
				{prompt}
			</label>
			<div className="mt-2 flex gap-2">
				<input
					id={id}
					value={answer}
					onChange={(e) => setAnswer(e.target.value)}
					autoComplete="one-time-code"
					className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
				/>
				<Button type="submit" disabled={busy}>
					{busy ? <Icon name="loader" spin /> : null}
					Send
				</Button>
			</div>
		</form>
	);
}
