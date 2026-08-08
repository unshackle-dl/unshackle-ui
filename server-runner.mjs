// Production entry: `node server-runner.mjs` (npm start).
//
// The build emits dist/client (static assets, no index.html any more) and
// dist/server/server.js, which exports `{ fetch }` — a handler, not a listener, and one
// that 404s every static asset. This is the ~50 lines that make it a real HTTP server:
// serve dist/client first, fall through to the handler for everything else. The handler
// SSRs unknown paths itself, so it is also the deep-link fallback; there is no index.html
// to fall back to.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const CLIENT = resolve(import.meta.dirname, 'dist/client');
const app = (await import('./dist/server/server.js')).default;
const port = Number(process.env.PORT) || 3000;

const TYPES = {
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.html': 'text/html; charset=utf-8',
	'.json': 'application/json',
	'.map': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.txt': 'text/plain; charset=utf-8',
	'.webmanifest': 'application/manifest+json'
};

// Returns true once it has taken over the response.
function serveStatic(pathname, res) {
	const file = resolve(CLIENT, `.${decodeURIComponent(pathname)}`);
	if (file !== CLIENT && !file.startsWith(CLIENT + sep)) return false; // path traversal
	let stat;
	try {
		stat = statSync(file);
	} catch {
		return false;
	}
	if (!stat.isFile()) return false;
	res.writeHead(200, {
		'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
		'Content-Length': stat.size,
		// Everything under /assets carries a content hash in its name; the rest may change.
		'Cache-Control': pathname.startsWith('/assets/')
			? 'public, max-age=31536000, immutable'
			: 'public, max-age=0, must-revalidate'
	});
	createReadStream(file).pipe(res);
	return true;
}

createServer(async (req, res) => {
	try {
		const url = new URL(req.url, `http://${req.headers.host ?? `localhost:${port}`}`);
		if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(url.pathname, res)) return;

		const headers = new Headers();
		for (let i = 0; i < req.rawHeaders.length; i += 2)
			headers.append(req.rawHeaders[i], req.rawHeaders[i + 1]);
		const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
		const response = await app.fetch(
			new Request(url, {
				method: req.method,
				headers,
				body: hasBody ? Readable.toWeb(req) : undefined,
				duplex: 'half'
			})
		);

		const out = Object.fromEntries(response.headers);
		const cookies = response.headers.getSetCookie?.() ?? [];
		if (cookies.length > 1) (delete out['set-cookie'], (out['Set-Cookie'] = cookies));
		res.writeHead(response.status, out);
		if (response.body) await pipeline(Readable.fromWeb(response.body), res);
		else res.end();
	} catch (e) {
		console.error('[server-runner]', e);
		if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
		res.end('Internal Server Error');
	}
}).listen(port, () => console.log(`[server-runner] listening on http://localhost:${port}`));
