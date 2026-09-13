import fs from 'fs';

export default function musicAuthToken(): string {
    const direct = (process.env.MusicAuthToken || '').trim();
    if (direct) {
        return direct.length >= 32 ? direct : '';
    }

    const file = process.env.MusicAuthTokenFile;
    if (!file) {
        return '';
    }

    try {
        const token = fs.readFileSync(file, 'utf8').trim();
        return token.length >= 32 ? token : '';
    } catch (_) {
        return '';
    }
}
