import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const base = new URL('https://editor.example/cut/');
const read = path => readFileSync(new URL(path, root), 'utf8');

function loadWorker() {
  const handlers = new Map();
  const cached = new Map();
  const network = [];
  const context = vm.createContext({
    URL, Promise,
    self: {
      location: new URL('sw.js', base),
      addEventListener: (type, handler) => handlers.set(type, handler),
      skipWaiting: async () => {},
      clients: {claim: async () => {}}
    },
    caches: {
      open: async () => ({addAll: async resources => {
        for (const path of resources) cached.set(new URL(path, base).href, {path});
      }}),
      match: async request => cached.get(request.url),
      keys: async () => [],
      delete: async () => true
    },
    fetch: async request => {
      network.push(request.url);
      throw Error('Offline');
    }
  });
  vm.runInContext(read('sw.js') + '\nglobalThis.precache = RESOURCES;', context);
  return {handlers, cached, network, resources: Array.from(context.precache)};
}

function shellDependencies() {
  const html = read('index.html');
  const paths = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["'](\.[^"']+)["']/g)]
    .map(match => new URL(match[1], base).href);
  const visited = new Set();
  while (paths.length) {
    const href = paths.pop();
    if (visited.has(href)) continue;
    visited.add(href);
    if (!href.endsWith('.mjs')) continue;
    const path = href.slice(base.href.length);
    for (const match of read(path).matchAll(/\b(?:import|export)\s+(?:[^;]*?\bfrom\s*)?["'](\.[^"']+)["']/g)) {
      paths.push(new URL(match[1], href).href);
    }
  }
  return visited;
}

test('the feature lab button has its module and stylesheet loaded', () => {
  const html = read('index.html');
  assert.ok(/<script\b[^>]*src=["']\.\/feature-lab\.mjs["']/.test(html), 'Feature lab module is not loaded');
  assert.ok(/<link\b[^>]*href=["']\.\/feature-lab\.css["']/.test(html), 'Feature lab stylesheet is not loaded');
});

test('all local editor entrypoints and transitive module imports are available offline', async () => {
  const worker = loadWorker();
  let install;
  worker.handlers.get('install')({waitUntil: promise => { install = promise; }});
  await install;
  const required = shellDependencies();
  // These have previously been omitted while still being required by the UI.
  required.add(new URL('stock-fast.mjs', base).href);
  required.add(new URL('feature-lab.mjs', base).href);
  required.add(new URL('feature-lab-core.mjs', base).href);
  required.add(new URL('feature-lab-catalog.mjs', base).href);
  required.add(new URL('feature-lab.css', base).href);
  for (const href of required) {
    assert.ok(worker.cached.has(href), 'Missing offline asset: ' + href.slice(base.href.length));
    let response;
    worker.handlers.get('fetch')({
      request: {url: href, method: 'GET'},
      respondWith: promise => { response = promise; }
    });
    assert.ok(await response, 'No offline response for ' + href);
  }
  assert.equal(worker.network.length, 0);
});

test('every precache entry exists and external search requests bypass the shell cache', () => {
  const worker = loadWorker();
  for (const path of worker.resources) {
    assert.doesNotThrow(() => readFileSync(new URL(path.endsWith('/') ? path + 'index.html' : path, root)));
  }
  for (const request of [
    {url: 'https://pixabay.com/api/?q=nature', method: 'GET'},
    {url: new URL('../other-page', base).href, method: 'GET'},
    {url: new URL('index.html', base).href, method: 'POST'}
  ]) {
    let intercepted = false;
    worker.handlers.get('fetch')({request, respondWith: () => { intercepted = true; }});
    assert.equal(intercepted, false);
  }
});
