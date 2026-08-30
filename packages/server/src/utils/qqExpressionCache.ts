import fs from 'fs';
import path from 'path';
import axios from 'axios';

import config from '@fiora/config/server';
import logger from '@fiora/utils/logger';

interface QFaceAsset {
    type: number;
    path: string;
}

interface QFaceRecord {
    emojiId: string;
    describe: string;
    isHide: boolean;
    assets: QFaceAsset[];
    [key: string]: unknown;
}

export const qqExpressionCacheRoot = path.resolve(
    __dirname,
    '../../public/QQExpression',
);
const LocalManifestName = '_index.json';
const localManifestPath = path.join(
    qqExpressionCacheRoot,
    LocalManifestName,
);

let cachePromise: Promise<void> | null = null;

async function hasCompleteCache() {
    try {
        const stat = await fs.promises.stat(localManifestPath);
        return stat.isFile() && stat.size > 0;
    } catch (error) {
        return false;
    }
}

function isUnicodeEmojiId(id: string) {
    const firstCodePoint = id.codePointAt(0) || 0;
    return firstCodePoint > 0x2000 && id.length <= 12;
}

function getCachedRecords(records: QFaceRecord[]) {
    const maxItems = Math.max(1, config.qqExpressionCache.maxItems);
    return records
        .filter(
            (record) =>
                !record.isHide &&
                !isUnicodeEmojiId(record.emojiId) &&
                Array.isArray(record.assets),
        )
        .map((record) => ({
            ...record,
            assets: record.assets.filter(
                (asset) => asset.type === 0 || asset.type === 2,
            ),
        }))
        .filter((record) => record.assets.length > 0)
        .slice(0, maxItems);
}

function resolveLocalAssetPath(assetPath: string) {
    const normalizedPath = assetPath.replace(/^\.\//, '').replace(/^\/+/, '');
    const pathParts = normalizedPath.split('/');
    if (
        normalizedPath === '' ||
        normalizedPath.includes('\\') ||
        pathParts.includes('..')
    ) {
        throw new Error(`Invalid QQ expression asset path: ${assetPath}`);
    }

    const filePath = path.resolve(qqExpressionCacheRoot, ...pathParts);
    if (!filePath.startsWith(`${qqExpressionCacheRoot}${path.sep}`)) {
        throw new Error(`QQ expression asset path is out of cache: ${assetPath}`);
    }
    return filePath;
}

async function downloadAsset(asset: QFaceAsset) {
    const filePath = resolveLocalAssetPath(asset.path);
    try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isFile() && stat.size > 0) {
            return;
        }
    } catch (error) {
        // File does not exist yet.
    }

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const sourceUrl = new URL(
        asset.path,
        config.qqExpressionCache.assetBaseUrl,
    ).toString();
    const response = await axios.get(sourceUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
    });
    const temporaryPath = `${filePath}.${process.pid}.part`;
    try {
        await fs.promises.writeFile(temporaryPath, response.data);
        await fs.promises.rename(temporaryPath, filePath);
    } catch (error) {
        await fs.promises.unlink(temporaryPath).catch(() => undefined);
        throw error;
    }
}

async function downloadAllAssets(assets: QFaceAsset[]) {
    let nextIndex = 0;
    let completed = 0;
    const concurrency = Math.max(
        1,
        Math.min(config.qqExpressionCache.concurrency, 16),
    );
    const workers = Array.from(
        { length: Math.min(concurrency, assets.length) },
        async () => {
            while (nextIndex < assets.length) {
                const index = nextIndex;
                nextIndex += 1;
                // Each worker intentionally downloads its assigned files in sequence.
                // eslint-disable-next-line no-await-in-loop
                await downloadAsset(assets[index]);
                completed += 1;
                if (completed % 50 === 0 || completed === assets.length) {
                    logger.info(
                        `[QQExpressionCache] ${completed}/${assets.length}`,
                    );
                }
            }
        },
    );
    await Promise.all(workers);
}

async function buildQQExpressionCache() {
    await fs.promises.mkdir(qqExpressionCacheRoot, { recursive: true });
    if (await hasCompleteCache()) {
        logger.info('[QQExpressionCache] local cache is ready');
        return;
    }

    logger.info('[QQExpressionCache] downloading manifest and all assets');
    const response = await axios.get(config.qqExpressionCache.manifestUrl, {
        timeout: 30000,
    });
    if (!Array.isArray(response.data)) {
        throw new Error('QQ expression manifest is invalid');
    }

    const records = getCachedRecords(response.data as QFaceRecord[]);
    const assetMap = new Map<string, QFaceAsset>();
    records.forEach((record) => {
        record.assets.forEach((asset) => assetMap.set(asset.path, asset));
    });
    const assets = Array.from(assetMap.values());
    await downloadAllAssets(assets);

    const temporaryManifestPath = `${localManifestPath}.${process.pid}.part`;
    await fs.promises.writeFile(
        temporaryManifestPath,
        JSON.stringify(records),
        'utf8',
    );
    await fs.promises.rename(temporaryManifestPath, localManifestPath);
    logger.info(
        `[QQExpressionCache] ready: ${records.length} expressions, ${assets.length} assets`,
    );
}

export default function ensureQQExpressionCache() {
    if (!cachePromise) {
        cachePromise = buildQQExpressionCache().catch((error) => {
            cachePromise = null;
            throw error;
        });
    }
    return cachePromise;
}
