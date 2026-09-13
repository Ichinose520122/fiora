const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// The adapter owns this volume; the chat server mounts it read-only.
function musicToken(env = process.env) {
    let token = env.MusicAuthToken || '';
    if (!token && env.MusicAuthTokenFile) {
        const file = env.MusicAuthTokenFile;
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        try { fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
        token = fs.readFileSync(file, 'utf8').trim();
    }
    if (token && token.length < 32) throw new Error('Music authentication token must contain at least 32 characters');
    return token;
}
module.exports = { musicToken };
