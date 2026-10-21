/**
 * The proxy search params a Browse offer link hands the title page.
 *
 * `choice` is the page's Proxy field: '' is auto (a geofenced service gets a proxy in the
 * browse country, where the offer is listed), 'none' sends no proxy, and anything else
 * (`us`, `nordvpn:us`, a URI) goes to every service as is. The serve resolves it with its
 * own providers and forwards it to a remote server. Auto overlaps the serve's own geofence
 * proxy on purpose: it picks the browse country, where the offer is listed, not the fence's first.
 */
export function proxySearch(
	choice: string,
	country: string,
	geofenced: boolean
): { proxy?: string; no_proxy?: true } {
	const c = choice.trim();
	if (c.toLowerCase() === 'none') return { no_proxy: true };
	if (c) return { proxy: c };
	return geofenced ? { proxy: country.toLowerCase() } : {};
}
