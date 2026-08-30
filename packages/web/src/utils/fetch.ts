import Message from '../components/Message';
import socket from '../socket';

import { SEAL_TEXT, SEAL_USER_TIMEOUT } from '../../../utils/const';

/** 用户是否被封禁 */
let isSeal = false;
const RequestTimeout = 30000;
const DisconnectedText = '连接已断开, 正在尝试重连';
const RequestTimeoutText = '请求超时, 请检查网络后重试';

export default function fetch<T = any>(
    event: string,
    data = {},
    { toast = true } = {},
): Promise<[string | null, T | null]> {
    if (isSeal) {
        Message.error(SEAL_TEXT);
        return Promise.resolve([SEAL_TEXT, null]);
    }
    if (!socket.connected) {
        socket.connect();
        if (toast) {
            Message.error(DisconnectedText);
        }
        return Promise.resolve([DisconnectedText, null]);
    }
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result: [string | null, T | null]) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };
        const timer = window.setTimeout(() => {
            if (toast) {
                Message.error(RequestTimeoutText);
            }
            finish([RequestTimeoutText, null]);
        }, RequestTimeout);

        socket.emit(event, data, (res: any) => {
            if (settled) {
                return;
            }
            window.clearTimeout(timer);
            if (typeof res === 'string') {
                if (toast) {
                    Message.error(res);
                }
                /**
                 * 服务端返回封禁状态后, 本地存储该状态
                 * 用户再触发接口请求时, 直接拒绝
                 */
                if (res === SEAL_TEXT) {
                    isSeal = true;
                    // 用户封禁和ip封禁时效不同, 这里用的短时间
                    setTimeout(() => {
                        isSeal = false;
                    }, SEAL_USER_TIMEOUT);
                }
                finish([res, null]);
            } else {
                finish([null, res]);
            }
        });
    });
}
