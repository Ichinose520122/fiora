import ip from 'ip';

const { env } = process;

export default {
    /** 服务端host, 默认为本机ip地址(可能会是局域网地址) */
    host: env.Host || ip.address(),

    // service port
    port: env.Port ? parseInt(env.Port, 10) : 9200,

    maxHttpBufferSize: env.MaxHttpBufferSize
        ? parseInt(env.MaxHttpBufferSize, 10)
        : 32 * 1024 * 1024,

    // mongodb address
    database: env.Database || 'mongodb://localhost:27017/fiora',

    redis: {
        host: env.RedisHost || 'localhost',
        port: env.RedisPort ? parseInt(env.RedisPort, 10) : 6379,
    },

    /** QQ 表情源与本地全量缓存参数 */
    qqExpressionCache: {
        manifestUrl:
            env.QQExpressionSourceManifestUrl ||
            'https://koishi.js.org/QFace/assets/qq_emoji/_index.json',
        assetBaseUrl:
            env.QQExpressionSourceAssetBaseUrl ||
            'https://koishi.js.org/QFace/',
        maxItems: env.QQExpressionMaxItems
            ? parseInt(env.QQExpressionMaxItems, 10)
            : 240,
        concurrency: env.QQExpressionCacheConcurrency
            ? parseInt(env.QQExpressionCacheConcurrency, 10)
            : 8,
    },

    // jwt encryption secret
    jwtSecret: env.JwtSecret || 'jwtSecret',

    // Maximize the number of groups
    maxGroupsCount: env.MaxGroupCount ? parseInt(env.MaxGroupCount, 10) : 3,

    allowOrigin: env.AllowOrigin ? env.AllowOrigin.split(',') : null,

    /**
     * Only trust forwarded client IP headers when every request reaches Fiora
     * through a reverse proxy that overwrites those headers.
     */
    trustProxyHeaders: env.TrustProxyHeaders === 'true',

    // token expires time
    tokenExpiresTime: env.TokenExpiresTime
        ? parseInt(env.TokenExpiresTime, 10)
        : 1000 * 60 * 60 * 24 * 30,

    // administrator user id
    administrator: env.Administrator ? env.Administrator.split(',') : [],

    /** 禁用注册功能 */
    disableRegister: env.DisableRegister
        ? env.DisableRegister === 'true'
        : false,

    /** 全站通用注册邀请码 */
    inviteCode: env.InviteCode || '',

    /** disable user create new group */
    disableCreateGroup: env.DisableCreateGroup
        ? env.DisableCreateGroup === 'true'
        : false,

    /** Aliyun OSS */
    aliyunOSS: {
        enable: env.ALIYUN_OSS ? env.ALIYUN_OSS === 'true' : false,
        accessKeyId: env.ACCESS_KEY_ID || '',
        accessKeySecret: env.ACCESS_KEY_SECRET || '',
        roleArn: env.ROLE_ARN || '',
        region: env.REGION || '',
        bucket: env.BUCKET || '',
        endpoint: env.ENDPOINT || '',
    },
};
