import { toggleTheme, useTheme } from '$lib/stores/theme';
import Icon from './Icon';

export default function ThemeToggle() {
	const theme = useTheme();
	return (
		<button
			onClick={toggleTheme}
			className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
			title="Toggle theme"
			aria-label="Toggle theme"
		>
			<Icon name={theme === 'dark' ? 'sun' : 'moon'} />
		</button>
	);
}
