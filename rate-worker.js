const params = new URLSearchParams(location.search);
const limitedHostnames = params.get('limitedHostnames')?.split(',') ?? []; // Required to pass at least one hostname otherwise worker will not do anything
const limitedMethods = params.get('limitedMethods')?.split(',') ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']; // Excluding HEAD, CONNECT, OPTIONS, TRACE
const maxConcurrentRequests = Number(params.get('maxConcurrentRequests')) ?? 10;
const sleepDuration = Number(params.get('sleepDuration')) ?? 1000;
const batchInterval = Number(params.get('batchInterval')) ?? 100;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const pending = [];
const inflight = Array(maxConcurrentRequests).fill(false);
let running = false;
async function clearPending() {
  if (running) { // Only allow one instance of clearPending() to run at a time
    return;
  }
  running = true;
  while (true) {
    for (let i = 0; i < inflight.length; i++) {
      if (!inflight[i]) {
        inflight[i] = true;
        const { request, resolve } = pending.shift();
        (async () => {
          await fetch(request).then(resolve);
          inflight[i] = false;
        })();
        if (pending.length === 0) { // This check needs to be nested in here because .shift mutates the length
          running = false;
          return;
        }
      }
    }
    await sleep(sleepDuration);
  }
}

async function delayedFetch(request) {
  const { promise, resolve } = Promise.withResolvers();
  pending.push({ request, resolve });
  setTimeout(clearPending, batchInterval); // Use a short first sleep to gather initial requests, otherwise the first request will start immediately and then invoke the longer sleepDuration
  return promise;
}

addEventListener('fetch', e => {
  if (limitedHostnames.includes(new URL(e.request.url).hostname) && limitedMethods.includes(e.request.method)) {
    e.respondWith(delayedFetch(e.request));
  }
});

addEventListener('install', skipWaiting); // Immediately override any pre-existing service worker
addEventListener('activate', () => clients.claim()); // Immediately intercept fetch requests after first registration without page reload
