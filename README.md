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

A thin browser client for [unshackle](https://github.com/unshackle-dl/unshackle). Search a service or open a title by ID/URL, pick the tracks, quality, and options you want, then start and monitor downloads, all against a running unshackle API. Built with SvelteKit + Tailwind; it ships as static files and talks to the API directly from the browser.

## Setup

```shell
npm install
npm run dev      # http://localhost:5173
```

Point it at a running unshackle API (default `http://localhost:8786`) via the **Settings** page, then start browsing. On the unshackle side, start the API with `unshackle serve --no-key` for local testing, or `unshackle serve --host 0.0.0.0` with an `api_secret` set in `unshackle.yaml` to reach it from another machine.

```shell
npm run build    # static site → build/
npm run preview  # serve the production build
```

## Configuration

The API base URL and secret key are set on the **Settings** page (persisted in your browser). To bake in defaults, copy `.env.example` to `.env`:

```shell
PUBLIC_UNSHACKLE_API_URL=http://localhost:8786
PUBLIC_UNSHACKLE_API_KEY=    # leave blank when the API runs with --no-key
```

## License

[GPL-3.0](LICENSE).
