/**
 * A login notice the serve relays from a remote server's log lines (see JobPromptModal): the
 * link to open and the code to enter, picked out of the text, and the lines themselves, split at
 * each "+ " step however the remote joined them.
 */
export function parseNotice(text: string): { url?: string; code?: string; steps: string[] } {
	return {
		url: text.match(/https?:\/\/[^\s)]+/)?.[0],
		// the colon matters: "pair code login..." is a step, not a code
		code: text.match(/code:\s*([A-Z0-9][A-Z0-9-]{3,})/i)?.[1],
		steps: text
			.split(/\n|\s+(?=\+ )/)
			.map((line) => line.replace(/^\s*\+\s*/, '').trim())
			.filter(Boolean)
	};
}
