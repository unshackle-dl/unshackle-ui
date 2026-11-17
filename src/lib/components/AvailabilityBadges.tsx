import type { Title } from '../api/types';
import Badge from './Badge';

export default function AvailabilityBadges({ title }: { title: Title }) {
	const availability = title.availability;
	return (
		<>
			{availability?.paid === true && (
				<Badge tone="amber">
					Paid
					{availability.access === 'granted'
						? ' · Access confirmed'
						: availability.access !== 'denied'
							? ' · Access unknown'
							: ''}
				</Badge>
			)}
			{availability?.access === 'denied' && <Badge tone="red">No account access</Badge>}
		</>
	);
}
