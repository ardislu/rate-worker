# Rate Worker

A minimal service worker that intercepts and throttles `fetch` requests. Intended to help work around API rate limits in applications where modifying the originating `fetch` requests is difficult or impossible.

## Usage

1. Register `rate-worker.js` and wait for it to be active:

```javascript
await navigator.serviceWorker.register('rate-worker.js');
const worker = await navigator.serviceWorker.ready.then(r => r.active);
```

2. Add throttles by posting messages to the worker (see below for the `ThrottleOptions` type definition):

```javascript
worker.postMessage({
  hostname: ['eth.llamarpc.com'],
  maxConcurrentRequests: 2,
  sleepDuration: 1000
});
```

3. Send `fetch` requests normally:

```javascript
for (let i = 0; i < 10; i++) {
  fetch('https://eth.llamarpc.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: i,
      method: 'eth_blockNumber',
      params: []
    })
  });
}
// The service worker will intercept these fetch requests and release them in batches of 2
// with a 1 second interval in between each batch, avoiding API rate limits!
```

Throttles are stored by the service worker in-memory and will only last for the current session.

## `ThrottleOptions`

Here is the [JSDoc](https://jsdoc.app/) annotation for the `ThrottleOptions` object you must post to the worker (copy this comment somewhere in your code to get autocomplete and tooltips):

```javascript
/**
 * @typedef {Object} ThrottleOptions
 * @property {string|Array<string>} hostname A hostname or array of hostnames that this throttling applies to. If multiple hostnames are provided, all hostnames share the same throttle.
 * @property {(request: Request) => boolean} [shouldThrottle] Function that returns `true` if a given request should be throttled or `false` if not.
 * @property {number} [maxConcurrentRequests=10] The maximum number of requests that are allowed to be inflight at the same time.
 * @property {number} [sleepDuration=1000] The duration (in milliseconds) to wait in between sending each batch of requests.
 * @property {number} [batchInterval=100] The duration (in milliseconds) to wait before sending the first batch of requests.
 */
```

Usage in JavaScript:

```javascript
/** @type {ThrottleOptions} */
const options = {
  // ...
}
```

Usage in TypeScript:

```typescript
const options: ThrottleOptions = {
  // ...
}
```
