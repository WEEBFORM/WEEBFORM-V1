import NodeCache from 'node-cache';

class CacheManager {
    constructor(defaultTTL = 600) {
        this.defaultTTL = defaultTTL;
        this.caches = {};
    }

    getCache(name, ttl = this.defaultTTL) {
        if (!this.caches[name]) {
            this.caches[name] = new NodeCache({ stdTTL: ttl });
        }
        return this.caches[name];
    }

    get(cacheName, key) {
        const cache = this.getCache(cacheName);
        return cache.get(key);
    }

    set(cacheName, key, value, ttl = this.defaultTTL) {
        const cache = this.getCache(cacheName, ttl);
        cache.set(key, value, ttl);
    }

    del(cacheName, key) {
        const cache = this.getCache(cacheName);
        cache.del(key);
    }

    flush(cacheName) {
        const cache = this.getCache(cacheName);
        cache.flushAll();
    }
}

export default CacheManager;