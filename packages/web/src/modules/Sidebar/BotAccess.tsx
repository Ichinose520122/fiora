import React, { useEffect, useRef, useState } from 'react';
import {
    BotAccessConfig,
    BotAccessOptions,
    BotAccessSettings,
    getBotConfig,
    saveBotConfig,
    rotateBotApiKey,
    revokeBotApiKey,
} from '../../service';
import Style from './Admin.less';
import BotStyle from './BotAccess.less';

interface BotAccessProps { revision?: number; }

function BotAccess({ revision = 0 }: BotAccessProps) {
    const [config, setConfig] = useState<BotAccessConfig>();
    const [options, setOptions] = useState<BotAccessOptions>({ users: [], groups: [] });
    const [userId, setUserId] = useState('');
    const [enabled, setEnabled] = useState(false);
    const [groupIds, setGroupIds] = useState<string[]>([]);
    const [allowPrivate, setAllowPrivate] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const lifetime = useRef(0);
    const pending = useRef(false);
    const selectionVersion = useRef(0);
    const accountChanged = !!config && userId !== config.userId;
    const dirty = !!config && (accountChanged || enabled !== config.enabled
        || allowPrivate !== config.allowPrivate
        || groupIds.slice().sort().join(',') !== config.allowedGroupIds.slice().sort().join(','));

    function applyConfig(value: BotAccessConfig) {
        setConfig(value);
        setUserId(value.userId || '');
        setEnabled(value.enabled);
        setGroupIds(value.allowedGroupIds);
        setAllowPrivate(value.allowPrivate);
    }

    function applySettings(value: BotAccessSettings) {
        applyConfig(value.config);
        setOptions(value.options);
    }

    useEffect(() => {
        const version = ++lifetime.current;
        pending.current = true;
        setBusy(true);
        setApiKey('');
        setError('');
        setNotice('');
        async function load() {
            try {
                const value = await getBotConfig();
                if (lifetime.current === version) applySettings(value);
            } catch (reason) {
                if (lifetime.current === version) setError(reason instanceof Error ? reason.message : '读取配置失败，请刷新重试');
            } finally {
                if (lifetime.current === version) { pending.current = false; setBusy(false); }
            }
        }
        void load();
        return () => { lifetime.current += 1; selectionVersion.current += 1; };
    }, [revision]);

    async function run(task: (isCurrent: () => boolean) => Promise<void>) {
        if (pending.current) return;
        const version = lifetime.current;
        pending.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try { await task(() => lifetime.current === version); }
        catch (reason) {
            if (lifetime.current === version) setError(reason instanceof Error ? reason.message : '操作失败，请重试');
        } finally {
            if (lifetime.current === version) { pending.current = false; setBusy(false); }
        }
    }

    async function selectUser(value: string) {
        setUserId(value);
        setApiKey('');
        setError('');
        setNotice('');
        if (value === config?.userId) {
            setEnabled(config.enabled);
            setGroupIds(config.allowedGroupIds);
            setAllowPrivate(config.allowPrivate);
        } else { setEnabled(false); setGroupIds([]); setAllowPrivate(false); }
        const selection = ++selectionVersion.current;
        const version = lifetime.current;
        setOptions((previous) => ({ ...previous, groups: [] }));
        try {
            const result = await getBotConfig(value);
            if (version === lifetime.current && selection === selectionVersion.current) setOptions(result.options);
        } catch (reason) {
            if (version === lifetime.current && selection === selectionVersion.current) setError(reason instanceof Error ? reason.message : '读取账号所属群失败');
        }
    }

    function save() {
        void run(async (isCurrent) => {
            setApiKey('');
            const binding = accountChanged;
            const result = await saveBotConfig(binding
                ? { userId, enabled: false, allowedGroupIds: [], allowPrivate: false }
                : { userId, enabled, allowedGroupIds: groupIds, allowPrivate });
            if (!isCurrent()) return;
            selectionVersion.current += 1;
            applySettings(result);
            setNotice(binding ? '机器人账号已绑定。请设置消息权限、保存配置，再生成 API Key。' : '机器人接入配置已保存');
        });
    }

    function rotate() {
        if (config?.hasApiKey && !window.confirm('轮换 API Key 后，原 API Key 立即失效。继续？')) return;
        void run(async (isCurrent) => {
            setApiKey('');
            const result = await rotateBotApiKey();
            if (!isCurrent()) return;
            applyConfig(result.config);
            setApiKey(result.apiKey);
            setNotice('API Key 已生成，请立即复制保存。');
        });
    }

    function revoke() {
        if (!window.confirm('撤销后，本地机器人将无法继续使用此 API Key 接入。继续？')) return;
        void run(async (isCurrent) => {
            setApiKey('');
            const result = await revokeBotApiKey();
            if (!isCurrent()) return;
            applyConfig(result.config);
            setNotice('API Key 已撤销');
        });
    }

    function copy() {
        void run(async (isCurrent) => {
            if (!navigator.clipboard?.writeText) throw new Error('当前浏览器不支持直接复制，请选中 API Key 手动复制');
            await navigator.clipboard.writeText(apiKey);
            if (isCurrent()) setNotice('API Key 已复制');
        });
    }

    return <div className={BotStyle.content}>
        <div className={Style.card}>
            <div className={Style.cardTitle}><h3>机器人接入</h3><span className={Style.badge}>{config?.enabled && config.hasApiKey ? '已启用' : '未启用'}</span></div>
            <p className={Style.description}>使用专用普通账号连接本地机器人。此处的 API Key 是聊天室接入凭据，模型 API Key 在本地机器人中配置。</p>
            <p className={Style.description}>请先在“用户账号”中创建普通账号，并让该账号加入需要接入的群。管理员账号不能用于机器人接入。</p>
            {error && <p className={BotStyle.error} role="alert">{error}</p>}
            {notice && <p className={BotStyle.notice} role="status">{notice}</p>}
            {!config && busy && <p className={Style.description} role="status">正在读取配置…</p>}
            <fieldset disabled={busy || !config} className={BotStyle.fields}>
                <label className={Style.field}>机器人账号<select value={userId} onChange={(event) => void selectUser(event.target.value)}><option value="">请选择专用普通账号</option>{options.users.map((user) => <option value={user._id} key={user._id}>{user.username}</option>)}</select></label>
                {!options.users.length && config && <p className={Style.description}>暂无可用的普通账号，请先创建账号后刷新状态。</p>}
                {options.users.length >= 500 && <p className={Style.description}>当前最多显示 500 个普通账号。</p>}
                {accountChanged && <p className={BotStyle.notice}>请先绑定所选账号。绑定会清空原账号的消息权限并使原 API Key 失效；绑定后再配置消息权限。</p>}
                <fieldset disabled={!userId || accountChanged} className={BotStyle.fields}>
                    <div className={Style.rule}><div><strong>启用机器人接入</strong><p>保存后生效，接入还需要有效的 API Key。</p></div><button type="button" className={Style.switch} role="switch" aria-label="启用机器人接入" aria-checked={enabled} onClick={() => setEnabled(!enabled)}><span /></button></div>
                    <fieldset className={BotStyle.groups}><legend>允许接入的群</legend>{options.groups.length ? options.groups.map((group) => <label className={BotStyle.checkbox} key={group._id}><input type="checkbox" checked={groupIds.includes(group._id)} onChange={(event) => setGroupIds(event.target.checked ? [...groupIds, group._id] : groupIds.filter((id) => id !== group._id))} />{group.name}</label>) : <p className={Style.description}>该账号暂无可用群，请先加入群后刷新状态。</p>}</fieldset>
                    <label className={BotStyle.checkbox}><input type="checkbox" checked={allowPrivate} onChange={(event) => setAllowPrivate(event.target.checked)} />允许与好友私聊</label>
                    <p className={Style.description}>机器人只能访问已勾选的群；开启私聊后，仅允许与该账号的好友收发私聊消息。</p>
                </fieldset>
                <div className={Style.actions}><button type="button" className={Style.button} disabled={!userId || !dirty} onClick={save}>{accountChanged ? '绑定机器人账号' : '保存接入配置'}</button></div>
            </fieldset>
        </div>
        <div className={Style.card}>
            <div className={Style.cardTitle}><h3>API Key</h3><span className={Style.badge}>{config?.hasApiKey ? '已生成' : '未生成'}</span></div>
            <p className={Style.description}>{config?.hasApiKey ? `当前凭据前缀：${config.apiKeyPrefix}。完整凭据仅在生成时显示。` : '保存机器人账号及消息权限后，生成接入凭据。'}</p>
            {dirty && <p className={Style.description}>请先保存接入配置，再生成或轮换 API Key。</p>}
            <div className={Style.actions}>
                <button type="button" className={Style.button} disabled={busy || !config?.userId || dirty || (!config.allowedGroupIds.length && !config.allowPrivate)} onClick={rotate}>{config?.hasApiKey ? '轮换 API Key' : '生成 API Key'}</button>
                <button type="button" className={Style.dangerButton} disabled={busy || !config?.hasApiKey} onClick={revoke}>撤销 API Key</button>
            </div>
            {apiKey && <div className={Style.result}><label htmlFor="bot-api-key">新 API Key · 仅本次显示</label><textarea id="bot-api-key" className={BotStyle.key} readOnly value={apiKey} spellCheck={false} /><small>请保存在本地机器人配置中。离开此页面或关闭面板后不再显示，请勿公开或发送给他人。</small><button type="button" className={Style.button} disabled={busy} onClick={copy}>复制 API Key</button></div>}
        </div>
    </div>;
}

export default BotAccess;
