const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'app.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (process.argv[2] === 'prepare') {
    const run = Number(process.env.GITHUB_RUN_NUMBER);
    const attempt = Number(process.env.GITHUB_RUN_ATTEMPT);
    if (!Number.isSafeInteger(run) || run < 1 || !Number.isSafeInteger(attempt) || attempt < 1 || attempt > 99) throw new Error('Invalid build number');
    config.expo.android.versionCode = 200000 + run * 100 + attempt;
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
} else if (process.argv[2] === 'package') {
    const commit = process.env.GITHUB_SHA;
    if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Missing build commit');
    const versionCode = config.expo.android.versionCode;
    const filename = `fiora-android-${versionCode}.apk`;
    const apk = fs.readFileSync(path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'));
    const output = path.join(root, 'release');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, filename), apk);
    fs.writeFileSync(path.join(output, 'latest.json'), `${JSON.stringify({
        version: config.expo.version, versionCode, commit,
        url: `https://github.com/Ichinose520122/fiora/releases/download/android-latest/${filename}`,
        size: apk.length, md5: crypto.createHash('md5').update(apk).digest('hex'),
        sha256: crypto.createHash('sha256').update(apk).digest('hex'), publishedAt: new Date().toISOString(),
    }, null, 2)}\n`);
} else throw new Error('Usage: node scripts/release.cjs prepare|package');
