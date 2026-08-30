import fs from 'fs';
import path from 'path';
import axios from 'axios';
import assert, { AssertionError } from 'assert';
import RegexEscape from 'regex-escape';
import OSS, { STS } from 'ali-oss';

import config from '@fiora/config/server';
import logger from '@fiora/utils/logger';
import User from '@fiora/database/mongoose/models/user';
import Group from '@fiora/database/mongoose/models/group';

import Socket from '@fiora/database/mongoose/models/socket';
import {
    getAllSealIp,
    getAllSealUser,
    getSealIpKey,
    getSealUserKey,
    DisableSendMessageKey,
    DisableNewUserSendMessageKey,
    Redis,
} from '@fiora/database/redis/initRedis';

/** 百度语言合成token */
let baiduToken = '';
/** 最后一次获取token的时间 */
let lastBaiduTokenTime = Date.now();

const AllowedUploadDirectories = new Set([
    'Avatar',
    'BackgroundImage',
    'FileMessage',
    'GroupAvatar',
    'ImageMessage',
]);

function resolveLocalUploadPath(fileNameValue: unknown) {
    assert.equal(typeof fileNameValue, 'string', '文件名格式错误');

    const parts = (fileNameValue as string).split('/');
    assert.equal(parts.length, 2, '文件名格式错误');

    const [directory, fileName] = parts;
    assert(AllowedUploadDirectories.has(directory), '不允许上传到该目录');
    assert(
        /^[0-9a-f]{24}_[0-9]+(?:\.[0-9a-z]{1,16})?$/i.test(fileName),
        '文件名格式错误',
    );

    const publicRoot = path.resolve(__dirname, '../../public');
    const directoryPath = path.resolve(publicRoot, directory);
    const filePath = path.resolve(directoryPath, fileName);
    assert(
        filePath.startsWith(`${publicRoot}${path.sep}`),
        '文件路径超出允许范围',
    );

    return {
        directory,
        directoryPath,
        fileName,
        filePath,
    };
}

/**
 * 搜索用户和群组
 * @param ctx Context
 */
export async function search(ctx: Context<{ keywords: string }>) {
    const keywords = ctx.data.keywords?.trim() || '';
    if (keywords === '') {
        return {
            users: [],
            groups: [],
        };
    }

    const escapedKeywords = RegexEscape(keywords);
    const users = await User.find(
        { username: { $regex: escapedKeywords } },
        { avatar: 1, username: 1 },
    );
    const groups = await Group.find(
        { name: { $regex: escapedKeywords } },
        { avatar: 1, name: 1, members: 1 },
    );

    return {
        users,
        groups: groups.map((group) => ({
            _id: group._id,
            avatar: group.avatar,
            name: group.name,
            members: group.members.length,
        })),
    };
}

/**
 * 搜索表情包, 爬其它站资源
 * @param ctx Context
 */
type SogouImage = {
    locImageLink?: string;
    picUrl?: string;
    thumbUrl?: string;
    width?: number | string;
    height?: number | string;
    picWidth?: number | string;
    picHeight?: number | string;
};

function normalizeImageUrl(url: string) {
    if (url.startsWith('//')) {
        return `https:${url}`;
    }
    if (url.startsWith('http://')) {
        return `https://${url.slice('http://'.length)}`;
    }
    return url;
}

export function parseSogouImageItems(items: SogouImage[], limit: number) {
    const result: { image: string; width: number; height: number }[] = [];
    const urls = new Set<string>();
    items.forEach((item) => {
        const rawUrl = item.picUrl || item.thumbUrl || item.locImageLink || '';
        const image = normalizeImageUrl(rawUrl);
        if (!image.startsWith('https://') || urls.has(image)) {
            return;
        }
        urls.add(image);
        result.push({
            image,
            width: Number(item.width || item.picWidth) || 120,
            height: Number(item.height || item.picHeight) || 120,
        });
    });
    return result.slice(0, limit);
}

function getSogouItems(data: any): SogouImage[] {
    if (Array.isArray(data?.data?.items)) {
        return data.data.items;
    }
    if (Array.isArray(data?.data)) {
        return data.data;
    }
    if (Array.isArray(data?.items)) {
        return data.items;
    }
    if (Array.isArray(data?.searchList?.searchList)) {
        return data.searchList.searchList;
    }
    return [];
}

export async function searchExpression(
    ctx: Context<{ keywords: string; limit?: number }>,
) {
    const keywords = ctx.data.keywords?.trim() || '';
    const requestedLimit = Number(ctx.data.limit) || 60;
    const limit = Math.max(1, Math.min(requestedLimit, 60));
    if (keywords === '') {
        return [];
    }
    assert(keywords.length <= 20, '搜索关键词过长');

    try {
        const response = await axios.get(
            'https://pic.sogou.com/napi/pc/searchList',
            {
                params: {
                    mode: 20,
                    start: 0,
                    xml_len: 60,
                    query: `${keywords} 表情`,
                },
                timeout: 8000,
                headers: {
                    accept: 'application/json, text/plain, */*',
                    'accept-language': 'zh-CN,zh;q=0.9',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
                },
            },
        );
        const result = parseSogouImageItems(
            getSogouItems(response.data),
            limit,
        );
        if (result.length > 0) {
            return result;
        }
    } catch (err) {
        logger.warn('[searchExpression:napi]', (err as Error).message);
    }

    try {
        const response = await axios.get('https://pic.sogou.com/pics', {
            params: {
                query: `${keywords} 表情`,
                start: 0,
            },
            timeout: 8000,
            headers: {
                'accept-language': 'zh-CN,zh;q=0.9',
                'user-agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
            },
        });
        const match = String(response.data).match(
            /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/,
        );
        if (match) {
            const result = parseSogouImageItems(
                getSogouItems(JSON.parse(match[1])),
                limit,
            );
            if (result.length > 0) {
                return result;
            }
        }
    } catch (err) {
        logger.warn('[searchExpression:html]', (err as Error).message);
    }

    assert(false, '在线表情搜索暂时不可用，请稍后重试');
    return [];
}

/**
 * 获取百度语言合成token
 */
export async function getBaiduToken() {
    if (baiduToken && Date.now() < lastBaiduTokenTime) {
        return { token: baiduToken };
    }

    const res = await axios.get(
        'https://openapi.baidu.com/oauth/2.0/token?grant_type=client_credentials&client_id=pw152BzvaSZVwrUf3Z2OHXM6&client_secret=fa273cc704b080e85ad61719abbf7794',
    );
    assert(res.status === 200, '请求百度token失败');

    baiduToken = res.data.access_token;
    lastBaiduTokenTime =
        Date.now() + (res.data.expires_in - 60 * 60 * 24) * 1000;
    return { token: baiduToken };
}

/**
 * 封禁用户, 需要管理员权限
 * @param ctx Context
 */
export async function sealUser(ctx: Context<{ username: string }>) {
    const { username } = ctx.data;
    assert(username !== '', 'username不能为空');

    const user = await User.findOne({ username });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    const userId = user._id.toString();
    const isSealUser = await Redis.has(getSealUserKey(userId));
    assert(!isSealUser, '用户已在封禁名单');

    await Redis.set(getSealUserKey(userId), userId, Redis.Minute * 10);

    return {
        msg: 'ok',
    };
}

/**
 * 获取封禁列表, 包含用户封禁和ip封禁, 需要管理员权限
 */
export async function getSealList() {
    const sealUserList = await getAllSealUser();
    const sealIpList = await getAllSealIp();
    const users = await User.find({ _id: { $in: sealUserList } });

    const result = {
        users: users.map((user) => user.username),
        ips: sealIpList,
    };
    return result;
}

const CantSealLocalIp = '不能封禁内网ip';
const CantSealSelf = '闲的没事封自己干啥';
const IpInSealList = 'ip已在封禁名单';

/**
 * 封禁 ip 地址, 需要管理员权限
 */
export async function sealIp(ctx: Context<{ ip: string }>) {
    const { ip } = ctx.data;
    assert(ip !== '::1' && ip !== '127.0.0.1', CantSealLocalIp);
    assert(ip !== ctx.socket.ip, CantSealSelf);

    const isSealIp = await Redis.has(getSealIpKey(ip));
    assert(!isSealIp, IpInSealList);

    await Redis.set(getSealIpKey(ip), ip, Redis.Hour * 6);

    return {
        msg: 'ok',
    };
}

/**
 * 封禁指定用户的所有在线 ip 地址, 需要管理员权限
 */
export async function sealUserOnlineIp(ctx: Context<{ userId: string }>) {
    const { userId } = ctx.data;

    const user = await User.findOne({ _id: userId });
    assert(user, '用户不存在');
    const sockets = await Socket.find({ user: userId });
    const ipList = [
        ...sockets.map((socket) => socket.ip),
        user.lastLoginIp,
    ].filter(
        (ip) =>
            ip !== '' &&
            ip !== '::1' &&
            ip !== '127.0.0.1' &&
            ip !== ctx.socket.ip,
    );

    // 如果全部 ip 都已经封禁过了, 则直接提示
    const isSealIpList = await Promise.all(
        ipList.map((ip) => Redis.has(getSealIpKey(ip))),
    );
    assert(!isSealIpList.every((isSealIp) => isSealIp), IpInSealList);

    await Promise.all(
        ipList.map(async (ip) => {
            await Redis.set(getSealIpKey(ip), ip, Redis.Hour * 6);
        }),
    );

    return {
        msg: 'ok',
    };
}

type STSResult = {
    enable: boolean;
    AccessKeyId: string;
    AccessKeySecret: string;
    bucket: string;
    region: string;
    SecurityToken: string;
    endpoint: string;
};

// eslint-disable-next-line consistent-return
export async function getSTS(): Promise<STSResult> {
    if (!config.aliyunOSS.enable) {
        // @ts-ignore
        return {
            enable: false,
        };
    }

    const sts = new STS({
        accessKeyId: config.aliyunOSS.accessKeyId,
        accessKeySecret: config.aliyunOSS.accessKeySecret,
    });
    try {
        const result = await sts.assumeRole(
            config.aliyunOSS.roleArn,
            undefined,
            undefined,
            'fiora-uploader',
        );
        // @ts-ignore
        return {
            enable: true,
            region: config.aliyunOSS.region,
            bucket: config.aliyunOSS.bucket,
            endpoint: config.aliyunOSS.endpoint,
            ...result.credentials,
        };
    } catch (err) {
        const typedErr = err as Error;
        assert.fail(`获取 STS 失败 - ${typedErr.message}`);
    }
}

export async function uploadFile(
    ctx: Context<{ fileName: string; file: any; isBase64?: boolean }>,
) {
    try {
        if (config.aliyunOSS.enable) {
            const sts = await getSTS();
            const client = new OSS({
                accessKeyId: sts.AccessKeyId,
                accessKeySecret: sts.AccessKeySecret,
                bucket: sts.bucket,
                region: sts.region,
                stsToken: sts.SecurityToken,
            });
            const result = await client.put(
                ctx.data.fileName,
                ctx.data.isBase64
                    ? Buffer.from(ctx.data.file, 'base64')
                    : ctx.data.file,
            );
            if (result.res.status === 200) {
                return {
                    url: `//${config.aliyunOSS.endpoint}/${result.name}`,
                };
            }
            throw Error('上传阿里云OSS失败');
        }

        const { directory, directoryPath, fileName, filePath } =
            resolveLocalUploadPath(ctx.data.fileName);
        await fs.promises.mkdir(directoryPath, { recursive: true });
        await fs.promises.writeFile(filePath, ctx.data.file);
        return {
            url: `/${directory}/${fileName}`,
        };
    } catch (err) {
        const typedErr = err as Error;
        logger.error('[uploadFile]', typedErr.message);
        return `上传文件失败:${typedErr.message}`;
    }
}

export async function toggleSendMessage(ctx: Context<{ enable: boolean }>) {
    const { enable } = ctx.data;
    await Redis.set(DisableSendMessageKey, (!enable).toString());
    return {
        msg: 'ok',
    };
}

export async function toggleNewUserSendMessage(
    ctx: Context<{ enable: boolean }>,
) {
    const { enable } = ctx.data;
    await Redis.set(DisableNewUserSendMessageKey, (!enable).toString());
    return {
        msg: 'ok',
    };
}

export async function getSystemConfig() {
    return {
        disableSendMessage: (await Redis.get(DisableSendMessageKey)) === 'true',
        disableNewUserSendMessage:
            (await Redis.get(DisableNewUserSendMessageKey)) === 'true',
    };
}
