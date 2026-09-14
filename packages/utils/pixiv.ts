/** Only a complete, allowlisted CDN URL is eligible for automatic image sending. */
export function pixivDirectImage(input: string): string | null {
    const value = input.trim();
    if (/\s/.test(value)) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname !== 'i.pximg.net' ||
            url.username || url.password || url.port ||
            !/\.(jpe?g|png|gif|webp)$/i.test(url.pathname)) return null;
        return url.toString();
    } catch (_) {
        return null;
    }
}
