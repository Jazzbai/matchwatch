/**
 * Internal DNS override for server-side object-storage calls.
 *
 * Our object-storage host (e.g. cdn.matchwatch.us) resolves publicly to the
 * edge server's PUBLIC IP. The API server cannot route to that public IP from
 * inside the LAN (public IPs are edge-only; internal traffic must use the
 * private 10.0.1.x addresses). Browser presigned upload/download URLs are
 * unaffected — the browser resolves the host normally. Only THIS process's own
 * server-side S3 calls (e.g. DeleteObjects, HeadBucket) need to reach the
 * store, so we point just that one hostname at its private LAN IP here.
 *
 * Config: S3_INTERNAL_HOST_MAP="host:ip"  (e.g. "cdn.matchwatch.us:10.0.1.13").
 * No-op when the variable is unset, so it is safe in every other environment.
 */
import dns from 'node:dns';

const map = process.env.S3_INTERNAL_HOST_MAP?.trim();
if (map) {
    const idx = map.lastIndexOf(':');
    const host = idx > 0 ? map.slice(0, idx) : '';
    const ip = idx > 0 ? map.slice(idx + 1) : '';

    if (host && ip) {
        const original = dns.lookup;
        (dns as any).lookup = function patchedLookup(hostname: string, options: any, callback?: any) {
            if (hostname !== host) {
                return (original as any)(hostname, options, callback);
            }
            const cb = typeof options === 'function' ? options : callback;
            if (options && typeof options === 'object' && options.all) {
                return cb(null, [{ address: ip, family: 4 }]);
            }
            return cb(null, ip, 4);
        };
        // eslint-disable-next-line no-console
        console.log(`[internalDns] resolving ${host} -> ${ip} for server-side calls`);
    }
}
