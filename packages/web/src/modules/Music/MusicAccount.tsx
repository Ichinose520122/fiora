import React, { useEffect, useState } from 'react';
import fetch from '../../utils/fetch';
import Style from './Music.less';

type Account = { canManage: boolean; configured: boolean; loggedIn: boolean; nickname?: string; unverified?: boolean };
export default function MusicAccount() {
    const [account, setAccount] = useState<Account | null>(null);
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('86');
    const [captcha, setCaptcha] = useState('');
    const [busy, setBusy] = useState(false);
    const [until, setUntil] = useState(0);
    const [now, setNow] = useState(Date.now());
    const [notice, setNotice] = useState('');
    const remaining = Math.max(0, Math.ceil((until - now) / 1000));
    useEffect(() => {
        let mounted = true;
        fetch<Account>('musicAccountStatus', {}, { toast: false }).then(([error, value]) => {
            if (mounted) { setAccount(value); if (error) setNotice(error); }
        });
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => { mounted = false; clearInterval(timer); };
    }, []);
    async function sendCode() {
        if (busy || remaining) return;
        if (!/^\d{1,4}$/.test(countryCode) || !/^\d{5,15}$/.test(phone) || (countryCode === '86' && !/^1\d{10}$/.test(phone))) {
            setNotice('请输入正确的区号和手机号'); return;
        }
        setBusy(true); setNotice('');
        const [error, result] = await fetch<{ retryAfter: number }>('musicSendCode', { phone, countryCode }, { toast: false });
        setBusy(false);
        setUntil(Date.now() + (result?.retryAfter || 60) * 1000); setNow(Date.now());
        setNotice(error || '验证码已发送，请查看手机短信');
    }
    async function login(event: React.FormEvent) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setNotice('');
        const [error, result] = await fetch<{ nickname: string }>('musicLogin', { phone, countryCode, captcha }, { toast: false });
        setBusy(false);
        if (result) {
            setCaptcha(''); setPhone('');
            setAccount({ canManage: true, configured: true, loggedIn: true, nickname: result.nickname });
            setNotice('网易云登录成功，后续点歌将使用此账号');
        } else setNotice(error || '登录未完成，请重试');
    }
    async function logout() {
        if (busy) return;
        setBusy(true);
        const [error, result] = await fetch('musicLogout', {}, { toast: false });
        setBusy(false);
        if (result) { setAccount({ canManage: true, configured: true, loggedIn: false }); setNotice('已退出服务器的网易云账号'); }
        else setNotice(error || '退出失败，请重试');
    }
    return <div className={Style.account}>
        <p className={Style.hint}>登录网易云音乐，为服务器点歌使用。你的聊天室账号不受影响。</p>
        {!account && !notice && <p>正在读取登录状态…</p>}
        {account && !account.canManage && <p>服务器音乐账号由站点管理员管理。你可以照常搜索和点歌。</p>}
        {account?.canManage && !account.configured && <p>登录服务尚未配置，请先完成音乐适配器部署。</p>}
        {account?.canManage && account.configured && <>
            <p>{account.loggedIn ? `已登录：${account.nickname || '网易云账号'}` : account.unverified ? '暂时无法确认登录状态，可以重新登录' : '尚未登录网易云'}</p>
            {account.loggedIn ? <button type="button" disabled={busy} onClick={logout}>退出网易云账号</button> :
                <form onSubmit={login} className={Style.accountForm}>
                    <div className={Style.phoneRow}>
                        <label>区号<input aria-label="国家区号" inputMode="numeric" pattern="[0-9]{1,4}" maxLength={4} required value={countryCode} onChange={(event) => setCountryCode(event.target.value)} /></label>
                        <label>手机号<input aria-label="网易云手机号" type="tel" autoComplete="tel-national" pattern="[0-9]{5,15}" maxLength={15} required value={phone} onChange={(event) => setPhone(event.target.value.trim())} /></label>
                    </div>
                    <label>短信验证码<div className={Style.codeRow}>
                        <input aria-label="网易云短信验证码" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,8}" maxLength={8} required value={captcha} onChange={(event) => setCaptcha(event.target.value.trim())} />
                        <button type="button" disabled={busy || remaining > 0} onClick={sendCode}>{remaining ? `${remaining} 秒后重发` : '发送验证码'}</button>
                    </div></label>
                    <button type="submit" disabled={busy}>{busy ? '处理中…' : '登录网易云'}</button>
                </form>}
            <p className={Style.hint}>使用已注册的网易云账号。验证码仅用于此次登录；如平台要求额外验证，请在官方客户端完成后重试。</p>
        </>}
        {notice && <p className={Style.notice} role="status">{notice}</p>}
    </div>;
}
