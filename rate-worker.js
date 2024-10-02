/**
 * @typedef {Object} ThrottleOptions
 * @property {string|Array<string>} hostname A hostname or array of hostnames that this throttling applies to. If multiple hostnames are provided, all hostnames share the same throttle.
 * @property {(request: Request) => boolean} [shouldThrottle] Function that returns `true` if a given request should be throttled or `false` if not.
 * @property {number} [maxConcurrentRequests=10] The maximum number of requests that are allowed to be inflight at the same time.
 * @property {number} [sleepDuration=1000] The duration (in milliseconds) to wait in between sending each batch of requests.
 * @property {number} [batchInterval=100] The duration (in milliseconds) to wait before sending the first batch of requests.
 */

const throttles = [];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function clearPending(throttle) {
  if (throttle.running) { // Only allow one instance of clearPending() to run at a time per throttle
    return;
  }
  throttle.running = true;
  while (true) {
    for (let i = 0; i < throttle.inflight.length; i++) {
      if (!throttle.inflight[i]) {
        throttle.inflight[i] = true;
        const { request, resolve, reject } = throttle.pending.shift();
        (async () => {
          await fetch(request).then(resolve).catch(reject);
          throttle.inflight[i] = false;
        })();
        if (throttle.pending.length === 0) { // This check needs to be nested in here because .shift mutates the length
          throttle.running = false;
          return;
        }
      }
    }
    await sleep(throttle.sleepDuration);
  }
}

async function delayedFetch(request, throttle) {
  const { promise, resolve, reject } = Promise.withResolvers();
  throttle.pending.push({ request, resolve, reject });
  setTimeout(() => clearPending(throttle), throttle.batchInterval); // Use a short first sleep to gather initial requests, otherwise the first request will start immediately and then invoke the longer sleepDuration
  return promise;
}

addEventListener('message', e => {
  const inputs = Array.isArray(e.data) ? e.data : [e.data];
  for (const throttle of inputs) {
    // Set defaults and clean up user input
    throttle.hostname = Array.isArray(throttle.hostname) ? throttle.hostname : [throttle.hostname];
    throttle.shouldThrottle ??= (request) => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
    throttle.maxConcurrentRequests ??= 10;
    throttle.sleepDuration ??= 1000;
    throttle.batchInterval ??= 100;

    // Set parameters for clearPending
    throttle.pending = [];
    throttle.inflight = Array(throttle.maxConcurrentRequests).fill(false);
    throttle.running = false;

    throttles.push(throttle);
  }
});

addEventListener('fetch', e => {
  for (const throttle of throttles) {
    if (throttle.hostname.includes(new URL(e.request.url).hostname) && throttle.shouldThrottle(e.request)) {
      e.respondWith(delayedFetch(e.request, throttle));
      break; // If multiple throttles apply to a request, only the first throttle has an effect
    }
  }
});

addEventListener('install', skipWaiting); // Immediately override any pre-existing service worker
addEventListener('activate', () => clients.claim()); // Immediately intercept fetch requests after first registration without page reload
