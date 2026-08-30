import { MB } from '../utils/const';

export default {
    server:
        process.env.Server ||
        (process.env.NODE_ENV === 'development' ? '//localhost:9200' : '/'),

    maxImageSize: process.env.MaxImageSize
        ? parseInt(process.env.MaxImageSize, 10)
        : MB * 15,
    maxBackgroundImageSize: process.env.MaxBackgroundImageSize
        ? parseInt(process.env.MaxBackgroundImageSize, 10)
        : MB * 15,
    maxAvatarSize: process.env.MaxAvatarSize
        ? parseInt(process.env.MaxAvatarSize, 10)
        : MB * 5,
    maxFileSize: process.env.MaxFileSize
        ? parseInt(process.env.MaxFileSize, 10)
        : MB * 50,

    // client default system setting
    defaultTheme: process.env.DefaultTheme || 'cool',
    sound: process.env.Sound || 'default',
    tagColorMode: process.env.TagColorMode || 'fixedColor',

    /**
     * QQ 表情资源。测试环境默认读取 QFace 原站，正式环境建议替换为自有 R2 域名。
     * R2 中保持 _index.json 内的 assets/qq_emoji/... 目录结构即可。
     */
    qqExpression: {
        manifestUrl:
            process.env.QQExpressionManifestUrl ||
            'https://koishi.js.org/QFace/assets/qq_emoji/_index.json',
        assetBaseUrl:
            process.env.QQExpressionAssetBaseUrl ||
            'https://koishi.js.org/QFace/',
        maxItems: process.env.QQExpressionMaxItems
            ? parseInt(process.env.QQExpressionMaxItems, 10)
            : 240,
    },

    /**
     * 前端监控: https://yueying.effirst.com/index
     * 值为监控应用id, 为空则不启用监控
     */
    frontendMonitorAppId: process.env.FrontendMonitorAppId || '',

    // 禁止用户撤回消息, 不包括管理员, 管理员始终能撤回任何消息
    // 默认是禁止的
    disableDeleteMessage: process.env.DisableDeleteMessage
        ? process.env.DisableDeleteMessage === 'true'
        : false,
};
