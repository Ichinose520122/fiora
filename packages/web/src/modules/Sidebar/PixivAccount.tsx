import React, { useEffect, useRef, useState } from 'react';
import fetch from '../../utils/fetch';
import Message from '../../components/Message';
import Common from './Common.less';
import Style from './PixivAccount.less';

type Status = { configured: boolean; verifiedAt: number };

export default function PixivAccount() {
    const [status, setStatus] = useState<Status | null>(null);
    const [session, setSession] = useState('');
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        fetch<Status>('pixivAccountStatus').then(([error, data]) => {
            if (!error && data && mounted.current) setStatus(data);
        });
        return () => { mounted.current = false; };
    }, []);

    async function act(event: string) {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        const payload = event === 'pixivAccountLogin' ? { session } : {};
        setSession('');
        try {
            const [error, data] = await fetch<Status>(event, payload);
            if (error || !data || !mounted.current) return;
            if (event === 'pixivAccountVerify') {
                Message.success('Pixiv 登录状态有效');
            } else {
                setStatus(data);
                Message.success(event === 'pixivAccountLogin' ? 'Pixiv 账号已连接' : '已移除服务器保存的登录状态');
            }
        } finally {
            pending.current = false;
            if (mounted.current) setBusy(false);
        }
    }

    return (
        <div className={Common.block}>
            <p className={Common.title}>Pixiv 账号</p>
            <div className={Style.account}>
                <p>{status ? (status.configured ? '已保存登录状态（可点击验证检查是否过期）' : '未连接：使用公开访问') : '正在读取账号状态…'}</p>
                <p>站点共用此账号获取作品，仅管理员可管理。登录后也只能获取该账号有权查看的作品。</p>
                <details>
                    <summary>如何获取登录凭据</summary>
                    <p>在浏览器登录 <a href="https://www.pixiv.net/" target="_blank" rel="noopener noreferrer">Pixiv 官网</a>，
                        按 F12，进入 Application（应用）→ Cookies → https://www.pixiv.net，
                        复制 PHPSESSID 的 Value（值）到下方。Firefox 可在“存储”面板查找。</p>
                    <p>请通过 HTTPS 使用本面板。凭据等同登录状态，不要发到聊天或 GitHub。保存后不会回显，失效时重新导入。</p>
                </details>
                <input
                    type="password"
                    aria-label="Pixiv PHPSESSID"
                    autoComplete="new-password"
                    placeholder="PHPSESSID 的值"
                    value={session}
                    onChange={(event) => setSession(event.target.value)}
                    maxLength={1024}
                    disabled={busy}
                />
                <div className={Style.actions}>
                    <button type="button" disabled={busy || !session.trim()} onClick={() => act('pixivAccountLogin')}>
                        {busy ? '处理中…' : '验证并保存'}
                    </button>
                    <button type="button" disabled={busy || !status?.configured} onClick={() => act('pixivAccountVerify')}>验证已保存状态</button>
                    <button type="button" disabled={busy || !status?.configured} onClick={() => act('pixivAccountLogout')}>移除登录</button>
                </div>
            </div>
        </div>
    );
}
