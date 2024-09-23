# Rate Worker

A minimal service worker that intercepts and throttles `fetch` requests. Intended to help work around API rate limits in applications where modifying the originating `fetch` requests is difficult or impossible.
