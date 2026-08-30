/** 封禁后提示文案 */
export const SEAL_TEXT = '你已经被关进小黑屋中, 请反思后再试';

/** 封禁用户释放时间 */
export const SEAL_USER_TIMEOUT = 1000 * 60 * 10; // 10分钟

/** 封禁ip释放时间 */
export const SEAL_IP_TIMEOUT = 1000 * 60 * 60 * 6; // 6小时

/** 透明图 */
export const TRANSPARENT_IMAGE =
    'data:image/png;base64,R0lGODlhFAAUAIAAAP///wAAACH5BAEAAAAALAAAAAAUABQAAAIRhI+py+0Po5y02ouz3rz7rxUAOw==';

/** 加密salt位数 */
export const SALT_ROUNDS = 10;

export const MB = 1024 * 1024;

export const NAME_REGEXP = /^([0-9a-zA-Z]{1,2}|[\u4e00-\u9eff]|[\u3040-\u309Fー]|[\u30A0-\u30FF]){1,8}$/;

export const GROUP_NAME_REGEXP = /^([0-9a-zA-Z]{1,2}|[\u4e00-\u9eff]|[\u3040-\u309Fー]|[\u30A0-\u30FF]){1,16}$/;

/** 用户标签使用独立规则, 不受用户名字符集限制 */
export const USER_TAG_MAX_LENGTH = 32;

export function isValidUserTag(tag: string) {
    if (typeof tag !== 'string') {
        return false;
    }
    const normalizedTag = tag.trim();
    const characters = Array.from(normalizedTag);
    return (
        normalizedTag.length > 0 &&
        characters.length <= USER_TAG_MAX_LENGTH &&
        !characters.some((character) => {
            const characterCode = character.charCodeAt(0);
            return characterCode <= 31 || characterCode === 127;
        })
    );
}
