import assert from 'node:assert/strict';

// Run through the Hosting emulator. No browser scripts execute or contact Firebase services.
const origin = 'http://127.0.0.1:5000';
const routes = ['/', '/login', '/tabs/tab2', '/course-detail/example'];
let index;
for (const route of routes) {
  const response = await fetch(`${origin}${route}`, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `${route}: Hosting must serve the SPA`);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.match(response.headers.get('cache-control') ?? '', /no-cache/);
  const html = await response.text();
  assert.match(html, /<base href="\/"/);
  if (index === undefined) index = html;
  else assert.equal(html, index, `${route}: deep links must serve the same index`);
}

const assets = [...index.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => match[1]);
assert.ok(assets.some(asset => asset.endsWith('.js')), 'The build must reference JavaScript');
assert.ok(assets.some(asset => asset.endsWith('.css')), 'The build must reference styles');
for (const asset of new Set(assets)) {
  const url = new URL(asset, `${origin}/`);
  assert.equal(url.origin, origin, 'All entry bundles must be local');
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `${asset}: missing bundle`);
  assert.match(response.headers.get('content-type') ?? '', asset.endsWith('.js') ? /javascript/ : /text\/css/);
  assert.match(response.headers.get('cache-control') ?? '', /immutable/);
  assert.ok((await response.arrayBuffer()).byteLength > 0, `${asset}: empty bundle`);
}
console.log(`Hosting verificado: ${routes.length} rutas SPA y ${new Set(assets).size} recursos con caché correcta.`);
