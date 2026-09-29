import HeadwearPicker from './HeadwearPicker';
import React, { useEffect, useRef, useState } from 'react';

import { TagParticleType, TagStylePreset } from '@fiora/utils/tagStyle';
import Style from './Admin.less';
import Dialog from '../../components/Dialog';
import Input from '../../components/Input';
import Message from '../../components/Message';
import UserTag from '../../components/UserTag';
import PixivAccount from './PixivAccount';
import MusicAccount from '../Music/MusicAccount';
import {
    getSealList,
    resetUserPassword,
    sealUser,
    setUserTag,
    sealIp,
    toggleSendMessage,
    toggleNewUserSendMessage,
    getSystemConfig,
    createUser,
} from '../../service';

const sections = [
    { id: 'moderation', title: '发言管理', description: '发言开关与封禁名单', path: 'M4 5h16v11H9l-5 4ZM8 9h8M8 12h5' },
    { id: 'accounts', title: '用户账号', description: '开通账号与密码管理', path: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2' },
    { id: 'appearance', title: '用户装扮', description: '头像头饰与个性标签', path: 'M12 3l2.7 5.5L21 9.4l-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.4l6.3-.9Z' },
    { id: 'platform', title: '平台账号', description: '网易云与 Pixiv 登录', path: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2' },
] as const;
type Section = typeof sections[number]['id'];

type SystemConfig = {
    disableSendMessage: boolean;
    disableNewUserSendMessage: boolean;
};

function getTagColorCount(preset: TagStylePreset) {
    if (preset === 'dualGradient') {
        return 2;
    }
    if (preset === 'tripleGradient') {
        return 3;
    }
    return 0;
}

interface AdminProps {
    visible: boolean;
    onClose: () => void;
}

function Admin(props: AdminProps) {
    const { visible, onClose } = props;
    const [section, setSection] = useState<Section>('moderation');
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const visibilityVersion = useRef(0);
    const [resetResult, setResetResult] = useState<{ username: string; password: string }>();
    const currentSection = sections.find((item) => item.id === section)!;
    async function run(task: () => Promise<unknown>) {
        if (pending.current) return;
        pending.current = true; setBusy(true);
        try { await task(); }
        catch (error) { Message.error(error instanceof Error ? error.message : '操作失败，请重试'); }
        finally { pending.current = false; setBusy(false); }
    }
    const actionButton = (label: string, task: () => Promise<unknown>, danger = false) => <button type="button" disabled={busy} className={danger ? Style.dangerButton : Style.button} onClick={() => void run(task)}>{label}</button>;

    const [tagUsername, setTagUsername] = useState('');
    const [tag, setTag] = useState('');
    const [tagPreset, setTagPreset] = useState<TagStylePreset>('solid');
    const [tagParticle, setTagParticle] = useState<TagParticleType>('none');
    const [tagColors, setTagColors] = useState([
        '#5b8ff9',
        '#f759ab',
        '#ffd666',
    ]);
    const [resetPasswordUsername, setResetPasswordUsername] = useState('');
    const [sealUsername, setSealUsername] = useState('');
    const [sealList, setSealList] = useState<{ users: string[]; ips: string[] }>();
    const [sealIpAddress, setSealIpAddress] = useState('');
    const [systemConfig, setSystemConfig] = useState<SystemConfig>();
    const [newUserId, setNewUserId] = useState('');
    const [newUserStudentId, setNewUserStudentId] = useState('');

    async function handleCreateUser() {
        const user = await createUser(
            newUserId.trim(),
            newUserStudentId.trim(),
        );
        if (user) {
            Message.success(`账号 ${user.username} 创建成功`);
            setNewUserId('');
            setNewUserStudentId('');
        }
    }

    async function handleGetSealList() {
        const sealListRes = await getSealList();
        if (sealListRes) {
            setSealList(sealListRes);
        }
    }
    async function handleGetSystemConfig() {
        const systemConfigRes = await getSystemConfig();
        if (systemConfigRes) {
            setSystemConfig(systemConfigRes);
        }
    }
    useEffect(() => {
        visibilityVersion.current += 1;
        if (visible) {
            handleGetSystemConfig();
            handleGetSealList();
        } else {
            setResetResult(undefined);
            setNewUserStudentId('');
        }
    }, [visible]);

    /**
     * 处理更新用户标签
     */
    async function handleSetTag() {
        const colorCount = getTagColorCount(tagPreset);
        const isSuccess = await setUserTag(tagUsername, tag.trim(), {
            preset: tagPreset,
            particle: tagParticle,
            colors: tagColors.slice(0, colorCount),
        });
        if (isSuccess) {
            Message.success('用户标签已更新');
            setTagUsername('');
            setTag('');
        }
    }

    /**
     * 处理重置用户密码操作
     */
    async function handleResetPassword() {
        const version = visibilityVersion.current;
        const target = resetPasswordUsername.trim();
        setResetResult(undefined);
        const res = await resetUserPassword(target);
        if (version !== visibilityVersion.current) return;
        if (res) {
            setResetResult({ username: target, password: res.newPassword });
            Message.success('密码已重置，新密码显示在下方');
            setResetPasswordUsername('');
        }
    }
    /**
     * 处理封禁用户操作
     */
    async function handleSeal() {
        const isSuccess = await sealUser(sealUsername);
        if (isSuccess) {
            Message.success('封禁用户成功');
            setSealUsername('');
            handleGetSealList();
        }
    }

    async function handleSealIp() {
        const isSuccess = await sealIp(sealIpAddress);
        if (isSuccess) {
            Message.success('封禁ip成功');
            setSealIpAddress('');
            handleGetSealList();
        }
    }

    async function handleDisableSendMessage() {
        const isSuccess = await toggleSendMessage(false);
        if (isSuccess) {
            Message.success('开启禁言成功');
            handleGetSystemConfig();
        }
    }
    async function handleEnableSendMessage() {
        const isSuccess = await toggleSendMessage(true);
        if (isSuccess) {
            Message.success('关闭禁言成功');
            handleGetSystemConfig();
        }
    }

    async function handleDisableSNewUserendMessage() {
        const isSuccess = await toggleNewUserSendMessage(false);
        if (isSuccess) {
            Message.success('开启新用户禁言成功');
            handleGetSystemConfig();
        }
    }
    async function handleEnableNewUserSendMessage() {
        const isSuccess = await toggleNewUserSendMessage(true);
        if (isSuccess) {
            Message.success('关闭新用户禁言成功');
            handleGetSystemConfig();
        }
    }

    return <Dialog className={Style.admin} visible={visible} title="管理员控制台" onClose={onClose}>
        <div className={Style.layout}>
            <nav className={Style.navigation} aria-label="管理功能">
                {sections.map((item) => <button type="button" key={item.id} className={Style.navItem} aria-current={section === item.id ? 'page' : undefined} aria-controls={'admin-panel-' + item.id} onClick={() => setSection(item.id)}>
                    <svg aria-hidden="true" viewBox="0 0 24 24"><path d={item.path} /></svg><span>{item.title}</span>
                </button>)}
            </nav>
            <div className={Style.workspace}>
                <header className={Style.pageHeader}><p>{currentSection.description}</p><button type="button" className={Style.refresh} disabled={busy} onClick={() => void run(() => Promise.all([handleGetSystemConfig(), handleGetSealList()]))}>
                    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5M5.6 7A8 8 0 0 1 20 12M4 12a8 8 0 0 0 14.4 5" /></svg>{busy ? '处理中…' : '刷新状态'}
                </button></header>
                <fieldset className={Style.fields} disabled={busy}>
                    <section className={Style.panel} id="admin-panel-moderation" aria-label="发言管理" hidden={section !== 'moderation'}>
                        <div className={Style.card}><div className={Style.cardTitle}><h3>发言规则</h3><span className={Style.badge}>{systemConfig ? '全站生效' : '正在读取'}</span></div>
                            <div className={Style.rule}><div><strong>全站禁言</strong><p>暂停聊天室内的用户发言</p></div><button type="button" className={Style.switch} role="switch" aria-label="全站禁言" aria-checked={!!systemConfig?.disableSendMessage} disabled={busy || !systemConfig} onClick={() => void run(systemConfig?.disableSendMessage ? handleEnableSendMessage : handleDisableSendMessage)}><span /></button></div>
                            <div className={Style.rule}><div><strong>新用户禁言</strong><p>限制新注册用户的发言</p></div><button type="button" className={Style.switch} role="switch" aria-label="新用户禁言" aria-checked={!!systemConfig?.disableNewUserSendMessage} disabled={busy || !systemConfig} onClick={() => void run(systemConfig?.disableNewUserSendMessage ? handleEnableNewUserSendMessage : handleDisableSNewUserendMessage)}><span /></button></div>
                        </div>
                        <div className={Style.twoColumns}>
                            <div className={Style.card}><div className={Style.cardTitle}><h3>封禁用户</h3><span className={Style.badge}>{sealList ? sealList.users.length + ' 位' : '—'}</span></div><p className={Style.description}>当前封禁时长为 10 分钟。</p>
                                <label className={Style.field}>用户名<Input value={sealUsername} onChange={setSealUsername} placeholder="输入完整用户名" /></label>
                                <div className={Style.actions}>{actionButton('封禁用户', handleSeal, true)}</div>
                                <div className={Style.list} aria-label="已封禁用户">{sealList?.users.map((name) => <span className={Style.chip} key={name}>{name}</span>)}{!sealList ? <p className={Style.empty}>尚未获取名单，请刷新状态</p> : !sealList.users.length && <p className={Style.empty}>暂无被封禁的用户</p>}</div>
                            </div>
                            <div className={Style.card}><div className={Style.cardTitle}><h3>封禁 IP</h3><span className={Style.badge}>{sealList ? sealList.ips.length + ' 个' : '—'}</span></div><p className={Style.description}>当前封禁时长为 6 小时，影响同 IP 用户。</p>
                                <label className={Style.field}>IP 地址<Input value={sealIpAddress} onChange={setSealIpAddress} placeholder="例如 192.0.2.1" /></label>
                                <div className={Style.actions}>{actionButton('封禁 IP', handleSealIp, true)}</div>
                                <div className={Style.list} aria-label="已封禁 IP">{sealList?.ips.map((ip) => <span className={Style.chip} key={ip}>{ip}</span>)}{!sealList ? <p className={Style.empty}>尚未获取名单，请刷新状态</p> : !sealList.ips.length && <p className={Style.empty}>暂无被封禁的 IP</p>}</div>
                            </div>
                        </div>
                    </section>
                    <section className={Style.panel} id="admin-panel-accounts" aria-label="用户账号" hidden={section !== 'accounts'}>
                        <div className={Style.twoColumns}>
                            <div className={Style.card}><h3>创建小洛克账号</h3><p className={Style.description}>使用洛克王国 ID 开通聊天室账号。</p>
                                <label className={Style.field}>洛克王国 ID<Input value={newUserId} onChange={setNewUserId} placeholder="洛克王国 ID" /></label>
                                <label className={Style.field}>学号 · 初始密码<Input type="password" value={newUserStudentId} onChange={setNewUserStudentId} placeholder="填写学号" onEnter={() => void run(handleCreateUser)} /></label>
                                <div className={Style.actions}>{actionButton('创建账号', handleCreateUser)}</div>
                            </div>
                            <div className={Style.card}><h3>重置用户密码</h3><p className={Style.description}>生成新密码，重置后原密码将失效。</p>
                                <label className={Style.field}>用户名<Input value={resetPasswordUsername} onChange={setResetPasswordUsername} placeholder="要重置密码的用户名" /></label>
                                <div className={Style.actions}>{actionButton('重置密码', handleResetPassword)}</div>
                                {resetResult && <div className={Style.result} role="status"><span>{resetResult.username} 的新密码</span><code>{resetResult.password}</code><small>请通知用户登录后修改密码。关闭面板后不保留显示。</small></div>}
                            </div>
                        </div>
                    </section>
                    <section className={Style.panel} id="admin-panel-appearance" aria-label="用户装扮" hidden={section !== 'appearance'}>
                        <div className={Style.card}>{visible && <HeadwearPicker admin />}</div>
                        <div className={Style.card}><h3>个性标签</h3><p className={Style.description}>为用户搭配文字、渐变与小粒子。</p>
                            <div className={Style.twoColumns}>
                                <label className={Style.field}>用户名<Input value={tagUsername} onChange={setTagUsername} placeholder="要更新标签的用户名" /></label>
                                <label className={Style.field}>标签文字<Input value={tag} onChange={setTag} placeholder="写一点特别的" /></label>
                                <label className={Style.field}>配色样式<select value={tagPreset} onChange={(event) => setTagPreset(event.target.value as TagStylePreset)}><option value="solid">经典纯色</option><option value="dualGradient">双色渐变</option><option value="tripleGradient">三色流光</option><option value="monochrome">黑白曜影</option></select></label>
                                <label className={Style.field}>粒子装饰<select value={tagParticle} onChange={(event) => setTagParticle(event.target.value as TagParticleType)}><option value="none">无粒子</option><option value="star">空心五角星</option><option value="heart">爱心粒子</option></select></label>
                            </div>
                            {!!getTagColorCount(tagPreset) && <div className={Style.colorRow}><span>渐变颜色</span>{tagColors.slice(0, getTagColorCount(tagPreset)).map((color, index) => <input key={index} aria-label={'渐变颜色 ' + (index + 1)} className={Style.colorInput} type="color" value={color} onChange={(event) => setTagColors(tagColors.map((value, i) => i === index ? event.target.value : value))} />)}</div>}
                            <div className={Style.tagPreview}><span>实时预览</span><UserTag text={tag.trim() || '炫彩标签'} tagStyle={{ preset: tagPreset, particle: tagParticle, colors: tagColors.slice(0, getTagColorCount(tagPreset)) }} fallbackColor="#5b8ff9" /></div>
                            <div className={Style.actions}>{actionButton('保存用户标签', handleSetTag)}</div>
                        </div>
                    </section>
                    <section className={Style.panel} id="admin-panel-platform" aria-label="平台账号" hidden={section !== 'platform'}>
                        <div className={Style.card}><div className={Style.cardTitle}><h3>网易云音乐</h3><span className={Style.badge}>一起听歌</span></div><div className={Style.accountContent}>{visible && <MusicAccount />}</div></div>
                        <div className={Style.card}><div className={Style.accountContent}>{visible && <PixivAccount />}</div></div>
                    </section>
                </fieldset>
            </div>
        </div>
    </Dialog>;
}

export default Admin;
