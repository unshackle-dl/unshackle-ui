/**
 * The body fields that send a call through a `remote_services` server on the serve, which logs in
 * and resolves titles/tracks/licences there while a download still runs on the serve. client_name
 * labels this app on the remote server's dashboard. Shared by the browser client and the poller.
 */
export const relayFields = (remote?: string): { remote?: string; client_name?: string } =>
	remote ? { remote, client_name: 'unshackle-ui' } : {};
