// Only public, same-origin image GETs enter the bounded runtime cache.
module.exports = {
    clientsClaim: true,
    skipWaiting: true,
    cleanupOutdatedCaches: true,
    runtimeCaching: [{
        urlPattern: ({ request, url, sameOrigin }) => sameOrigin
            && request.destination === 'image'
            && /^\/(ImageMessage|Avatar|GroupAvatar|BackgroundImage|QQExpression|avatar|images)\//.test(url.pathname),
        handler: 'CacheFirst',
        method: 'GET',
        options: {
            cacheName: 'fiora-images-v1',
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true },
        },
    }],
};
