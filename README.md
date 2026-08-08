<p align="center">
    <img width="16" height="16" alt="no_encryption" src="https://github.com/user-attachments/assets/6ff88473-0dd2-4bbc-b1ea-c683d5d7a134" /> unshackle-ui
    <br/>
    <sup><em>Web UI for the unshackle REST API</em></sup>
</p>

<p align="center">
  <a href="#setup">Setup</a> &nbsp;·&nbsp;
  <a href="#configuration">Configuration</a> &nbsp;·&nbsp;
  <a href="https://github.com/unshackle-dl/unshackle">unshackle</a>
</p>

<img width="1443" height="1241" alt="image" src="https://github.com/user-attachments/assets/d1e35c73-7114-444d-b6c1-55453d42838e" />

---

A browser client for [unshackle](https://github.com/unshackle-dl/unshackle). Search a service or open a title by ID/URL, pick the tracks, quality, and options you want, then start and monitor downloads, all against a running unshackle API. Built with TanStack Start (Router + Query) + Tailwind.

Most of the app runs in the browser and talks to the unshackle API directly. Title tracking does not: it keeps a sqlite store and a background poller in the Node process that serves the app, so **unshackle-ui needs a Node runtime and is no longer a static site**. See [Running the built app](#running-the-built-app).

## unshackle compatibility

The full UI needs unshackle newer than v5.3.0: commit [`7fdd514`](https://github.com/unshackle-dl/unshackle/commit/7fdd514) (2026-07-01) or later, which adds the job retry/priority/clear, history, config, profiles, and maintenance endpoints. On v5.2.0 through v5.3.0 the core flow (search, browse titles, pick tracks, download, monitor the queue) still works, but the History page, queue actions, profiles, and the maintenance actions in Settings will fail. Run unshackle from `main` until a release is tagged after that commit.

## Setup

```shell
npm install
npm run dev      # http://localhost:5173
```

Point it at a running unshackle API (default `http://localhost:8786`) via the **Settings** page, then start browsing. On the unshackle side, start the API with `unshackle serve --no-key` for local testing, or `unshackle serve --host 0.0.0.0` with an `api_secret` set in `unshackle.yaml` to reach it from another machine.

## Running the built app

```shell
npm run build    # → dist/client (assets) + dist/server/server.js (request handler)
npm start        # http://localhost:3000, PORT to change it
npm run preview  # local check of the same build; not for deployment
```

`dist/server/server.js` exports a fetch handler, not an HTTP listener, and serves no static
files on its own. `server-runner.mjs` (what `npm start` runs) is the small `node:http`
process that serves `dist/client` and passes everything else to that handler. There is no
`index.html` in the build any more, so a static host cannot serve this.

The process needs **`data/` to be writable and to persist across restarts** — that is where
tracked titles live. Point `TRACKING_DB_PATH` somewhere else to move it; in a container,
mount it as a volume or every restart loses what you were tracking.

## Configuration

The API base URL and secret key used **by the browser** are set on the **Settings** page
(persisted in your browser). To bake in defaults, copy `.env.example` to `.env`:

```shell
PUBLIC_UNSHACKLE_API_URL=http://localhost:8786
PUBLIC_UNSHACKLE_API_KEY=    # leave blank when the API runs with --no-key
```

The **server** reads its own settings from the environment at startup, because the tracking
poller cannot see the browser's Settings page. These are read at runtime, not baked into the
build, so one build can be pointed anywhere:

```shell
UNSHACKLE_API_URL=http://localhost:8786
UNSHACKLE_API_KEY=           # sent as X-Secret-Key by the poller
TRACKING_DB_PATH=./data/tracking.db
TRACKING_INTERVAL_MS=21600000  # sweep every 6h
TRACKING_STAGGER_MS=30000      # gap between individual checks in a sweep
TRACKING_WEBHOOK_URL=          # optional summary POST per check cycle
```

The two halves can legitimately disagree — a browser pointed at one API while the server
polls another. Tracked titles are scoped to the `X-Secret-Key` that created them, the same
way unshackle scopes download jobs.

## License

[GPL-3.0](LICENSE).
