# Scheduled downloads

The title page can save a one-time download with the exact request built by the regular Download button. Open **Schedules** in the sidebar to pause, resume, or delete it.

The app stores schedules in its SQLite database and checks for due work every five seconds while `UNSHACKLE_API_URL` is configured. A schedule runs at most once; a failed submission is recorded as failed and completed. Times are stored as epoch milliseconds. If the server is unavailable at the due time, the schedule remains pending and runs when the scheduler is available again.

Schedule creation, updates, and deletion require JSON requests from the same origin. Schedules are scoped to the caller's `X-Secret-Key`, and the download is submitted upstream with that same key so upstream ownership and permission checks continue to apply.

Recurring downloads are intentionally not supported here. For automatically downloading newly listed episodes, use the tracking feature, which already detects unseen episodes.
