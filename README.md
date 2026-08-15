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

---

A browser client for [unshackle](https://github.com/unshackle-dl/unshackle). Search a service or open a title by ID/URL, pick tracks and options, then start and monitor downloads. Built with TanStack Start + Tailwind.

<img width="1258" height="1006" alt="image" src="https://github.com/user-attachments/assets/28d71fdd-e8dc-4786-a114-b76e268e1129" />

## Setup

```shell
npm install
npm run dev      # http://localhost:5173
```

Point it at a running unshackle API on the **Settings** page. On the unshackle side, `unshackle serve --no-key` for local testing.

> [!NOTE]
> Needs unshackle from `main` (newer than v5.3.0). Older builds work for search and downloads, but History, queue actions, profiles, and maintenance will fail.

## Running the built app

```shell
npm run build
npm start        # http://localhost:3000, PORT to change it
```

Title tracking runs a sqlite store and poller inside the Node server, so this needs a **Node runtime, not a static host**, and `data/` must be writable and persist across restarts.

## Configuration

The browser gets its API URL and key from the **Settings** page. Defaults can be baked in via `.env` (see `.env.example`).

The server keeps its own settings, since the tracking poller cannot read the browser's:

```shell
UNSHACKLE_API_URL=http://localhost:8786
UNSHACKLE_API_KEY=           # sent as X-Secret-Key by the poller
TRACKING_DB_PATH=./data/tracking.db
TRACKING_INTERVAL_MS=21600000  # default check interval, 6h
TRACKING_STAGGER_MS=30000      # gap between checks in a sweep
TRACKING_WEBHOOK_URL=          # optional summary POST per check cycle
```

Everything except `TRACKING_DB_PATH` is also editable live from the Tracking page's Settings dialog, which wins over the env vars. Tracked titles are scoped to the `X-Secret-Key` that created them.

`TRACKING_WEBHOOK_URL` gets one JSON POST per cycle that found something — a twelve-episode drop is one notification, not twelve.

## License

[GPL-3.0](LICENSE).
