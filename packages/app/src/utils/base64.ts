// Works on Hermes without relying on Node Buffer or browser atob globals.
export function decodeBase64(input: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const text = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    if (text.length % 4 === 1) throw new Error('Invalid base64');
    const bytes = new Uint8Array(Math.floor(text.length * 6 / 8));
    let bits = 0; let value = 0; let offset = 0;
    for (let i = 0; i < text.length; i += 1) {
        const digit = alphabet.indexOf(text[i]);
        if (digit < 0) throw new Error('Invalid base64');
        value = (value << 6) | digit; bits += 6;
        if (bits >= 8) { bits -= 8; bytes[offset++] = (value >> bits) & 255; }
    }
    return bytes;
}
