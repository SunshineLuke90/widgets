const CACHE_NAME = 'fire-wms-v2'

self.addEventListener('install', (event) => {
    // activate immediately
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})

function canonicalizeWmsUrl(rawUrl) {
    try {
        const u = new URL(rawUrl)
        // keep origin + pathname, sort search params for a canonical key
        // drop ephemeral cache-busting params (e.g. _ts) and any param starting with '_'
        const params = Array.from(u.searchParams.entries()).filter(([k]) => !k.startsWith('_'))
        params.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
        const qp = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
        return `${u.origin}${u.pathname}?${qp}`
    } catch (e) {
        return rawUrl
    }
}

// Intercept WMS GetMap requests for the widget's service and serve cached responses when available
self.addEventListener('fetch', (event) => {
    const url = event.request.url
    // Only handle GET requests and WMS GetMap calls
    if (event.request.method !== 'GET') return
    if (url.indexOf('/api/ogc/imagery/wms') === -1 && url.indexOf('/geoserver/observations/weather_radar/ows') === -1 && url.indexOf('geoserver/conus/conus_bref_qcd/ows') === -1) return
    // simple heuristic to match GetMap calls
    if (url.toLowerCase().indexOf('request=getmap') === -1) return

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME)
        const key = canonicalizeWmsUrl(url)
        // try to match canonical key first
        const cached = await cache.match(key)
        if (cached) {
            // console log for debugging
            console.debug('SW: serving cached WMS frame for', key)
            return cached
        }
        try {
            // fetch original request; allow network to fail if CORS prevents body access
            const resp = await fetch(event.request)
            // clone and store if ok — store under canonical key so param ordering won't matter
            if (resp) {
                try {
                    // clone may fail for opaque responses in some browsers, guard it
                    await cache.put(key, resp.clone())
                } catch (putErr) {
                    // fallback: attempt to cache under the original request
                    try { await cache.put(event.request, resp.clone()) } catch (e) { /* ignore */ }
                }
            }
            return resp
        } catch (e) {
            // fallback to cached or a 503 response
            const fallback = await cache.match(key) || await cache.match(event.request)
            if (fallback) return fallback
            return new Response('Service unavailable', { status: 503 })
        }
    })())
})