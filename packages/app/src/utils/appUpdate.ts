export const releasePage = 'https://github.com/Ichinose520122/fiora/releases/tag/android-latest';
const downloadRoot = 'https://github.com/Ichinose520122/fiora/releases/download/android-latest/';
export type AppRelease = { version: string; versionCode: number; url: string; size: number; md5: string; sha256: string; commit: string; publishedAt: string };
export function parseRelease(value: unknown): AppRelease {
    const item = value as AppRelease;
    if (!item || !Number.isSafeInteger(item.versionCode) || item.versionCode < 1 || item.versionCode > 2100000000
        || typeof item.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(item.version)
        || item.url !== `${downloadRoot}fiora-android-${item.versionCode}.apk`
        || !Number.isSafeInteger(item.size) || item.size < 1000000 || item.size > 200 * 1024 * 1024
        || !/^[a-f0-9]{32}$/.test(item.md5) || !/^[a-f0-9]{64}$/.test(item.sha256)
        || !/^[a-f0-9]{40}$/.test(item.commit) || !Number.isFinite(Date.parse(item.publishedAt))) {
        throw new Error('更新信息不完整，请稍后重试');
    }
    return item;
}
export async function checkAppUpdate(signal: AbortSignal) {
    const response = await fetch(`${downloadRoot}latest.json?t=${Date.now()}`, { signal });
    if (!response.ok) throw new Error(response.status === 404 ? '新版尚未发布，请稍后检查' : '暂时无法连接 GitHub');
    return parseRelease(await response.json());
}
