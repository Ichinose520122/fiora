import { isValidUserTag, USER_TAG_MAX_LENGTH } from '../const';

describe('isValidUserTag', () => {
    test('accepts mixed text, spaces, symbols and emoji', () => {
        expect(isValidUserTag('黑白炫彩 VIP ☆ ♥ 🚀')).toBe(true);
    });

    test('counts unicode code points instead of UTF-16 units', () => {
        expect(isValidUserTag('🚀'.repeat(USER_TAG_MAX_LENGTH))).toBe(true);
        expect(isValidUserTag('🚀'.repeat(USER_TAG_MAX_LENGTH + 1))).toBe(
            false,
        );
    });

    test('rejects empty text and control characters', () => {
        expect(isValidUserTag('   ')).toBe(false);
        expect(isValidUserTag('标签\n换行')).toBe(false);
    });
});
