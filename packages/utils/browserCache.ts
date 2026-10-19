export const ImageCacheSeconds = 30 * 24 * 60 * 60;
export const ImmutableCacheControl = 'public, max-age=31536000, immutable';

/** Upload names contain an owner ID and timestamp; replacing an image gets a new URL. */
export function imageCacheControl(relativePath: string): string | undefined {
    if (!/^(Avatar|BackgroundImage|GroupAvatar|ImageMessage)\//.test(relativePath)) {
        return undefined;
    }
    if (/^[^/]+\/[a-f0-9]{24}_[0-9]+(?:\.(png|jpe?g|gif|webp|bmp|avif|ico))?$/i.test(relativePath)) {
        return ImmutableCacheControl;
    }
    if (/^ImageMessage\/pixiv-[0-9]+-p[0-9]+-[a-f0-9]{24}\.(png|jpe?g|gif|webp)$/i.test(relativePath)) {
        return ImmutableCacheControl;
    }
    return /\.(png|jpe?g|gif|webp|bmp|avif|ico)$/i.test(relativePath)
        ? `public, max-age=${ImageCacheSeconds}`
        : undefined;
}

export function staticCacheControl(relativePath: string): string | undefined {
    const resource = relativePath.replace(/\.(gz|br)$/i, '');
    if (/\.html$|(?:^|\/)(?:service-worker\.js|workbox-[^/]+\.js)$/i.test(resource)) {
        return 'no-cache';
    }
    const image = imageCacheControl(resource);
    if (image) return image;
    if (/\.[a-f0-9]{8,64}\.(js|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|eot|ttf|otf|mp3)$/i.test(resource)) {
        return ImmutableCacheControl;
    }
    return /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(resource)
        ? `public, max-age=${ImageCacheSeconds}`
        : undefined;
}
