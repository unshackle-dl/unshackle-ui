import assert from 'node:assert/strict';
import { test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { encode } from 'uqr';
import QrCode from './components/QrCode';

test('draws one square per dark module of the code', () => {
	const text = 'https://login.example/scan?code=EXAMPLE';
	const { data } = encode(text, { border: 2 });
	const html = renderToStaticMarkup(<QrCode text={text} />);
	assert.match(html, new RegExp(`viewBox="0 0 ${data.length} ${data.length}"`));
	assert.equal(html.match(/h1v1h-1z/g)?.length, data.flat().filter(Boolean).length);
});

test('draws nothing for text longer than a QR code holds', () => {
	assert.equal(renderToStaticMarkup(<QrCode text={'x'.repeat(8000)} />), '');
});
