import React, { useEffect, useState } from 'react';

import { css } from 'linaria';
import { TagParticleType, TagStylePreset } from '@fiora/utils/tagStyle';
import Style from './Admin.less';
import Common from './Common.less';
import Dialog from '../../components/Dialog';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Message from '../../components/Message';
import UserTag from '../../components/UserTag';
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

const styles = {
    button: css`
        min-width: 100px;
        height: 36px;
        margin-right: 12px;
        padding: 0 10px;
    `,
};

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
    const [sealList, setSealList] = useState({ users: [], ips: [] });
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
        if (visible) {
            handleGetSystemConfig();
            handleGetSealList();
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
            Message.success('更新用户标签成功, 请刷新页面更新数据');
            setTagUsername('');
            setTag('');
        }
    }

    /**
     * 处理重置用户密码操作
     */
    async function handleResetPassword() {
        const res = await resetUserPassword(resetPasswordUsername);
        if (res) {
            Message.success(`已将该用户的密码重置为:${res.newPassword}`);
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

    return (
        <Dialog
            className={Style.admin}
            visible={visible}
            title="管理员控制台"
            onClose={onClose}
        >
            <div className={Common.container}>
                <div className={Common.block}>
                    <p className={Common.title}>创建小洛克账号</p>
                    <div className={Style.inputBlock}>
                        <Input
                            className={`${Style.input} ${Style.tagUsernameInput}`}
                            value={newUserId}
                            onChange={setNewUserId}
                            placeholder="洛克王国 ID"
                        />
                        <Input
                            className={`${Style.input} ${Style.tagInput}`}
                            type="password"
                            value={newUserStudentId}
                            onChange={setNewUserStudentId}
                            placeholder="学号"
                            onEnter={handleCreateUser}
                        />
                        <Button
                            className={Style.button}
                            onClick={handleCreateUser}
                        >
                            创建账号
                        </Button>
                    </div>
                </div>
                <div className={Common.block}>
                    {!systemConfig?.disableSendMessage ? (
                        <Button
                            className={styles.button}
                            type="danger"
                            onClick={handleDisableSendMessage}
                        >
                            开启禁言
                        </Button>
                    ) : (
                        <Button
                            className={styles.button}
                            onClick={handleEnableSendMessage}
                        >
                            关闭禁言
                        </Button>
                    )}
                    {!systemConfig?.disableNewUserSendMessage ? (
                        <Button
                            className={styles.button}
                            type="danger"
                            onClick={handleDisableSNewUserendMessage}
                        >
                            开启新用户禁言
                        </Button>
                    ) : (
                        <Button
                            className={styles.button}
                            onClick={handleEnableNewUserSendMessage}
                        >
                            关闭新用户禁言
                        </Button>
                    )}
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>更新用户标签</p>
                    <div className={Style.inputBlock}>
                        <Input
                            className={`${Style.input} ${Style.tagUsernameInput}`}
                            value={tagUsername}
                            onChange={setTagUsername}
                            placeholder="要更新标签的用户名"
                        />
                        <Input
                            className={`${Style.input} ${Style.tagInput}`}
                            value={tag}
                            onChange={setTag}
                            placeholder="标签内容"
                        />
                        <select
                            className={Style.tagSelect}
                            value={tagPreset}
                            onChange={(event) =>
                                setTagPreset(
                                    event.target.value as TagStylePreset,
                                )
                            }
                        >
                            <option value="solid">经典纯色</option>
                            <option value="dualGradient">双色渐变</option>
                            <option value="tripleGradient">三色流光</option>
                            <option value="monochrome">黑白曜影</option>
                        </select>
                        <select
                            className={Style.tagSelect}
                            value={tagParticle}
                            onChange={(event) =>
                                setTagParticle(
                                    event.target.value as TagParticleType,
                                )
                            }
                        >
                            <option value="none">无粒子</option>
                            <option value="star">空心五角星</option>
                            <option value="heart">爱心粒子</option>
                        </select>
                        {(tagPreset === 'dualGradient' ||
                            tagPreset === 'tripleGradient') &&
                            tagColors
                                .slice(
                                    0,
                                    tagPreset === 'dualGradient' ? 2 : 3,
                                )
                                .map((color, index) => (
                                    <input
                                        // eslint-disable-next-line react/no-array-index-key
                                        key={index}
                                        className={Style.tagColorInput}
                                        type="color"
                                        value={color}
                                        onChange={(event) => {
                                            const newColors = [...tagColors];
                                            newColors[index] =
                                                event.target.value;
                                            setTagColors(newColors);
                                        }}
                                    />
                                ))}
                        <Button className={Style.button} onClick={handleSetTag}>
                            确定
                        </Button>
                    </div>
                    <div className={Style.tagPreview}>
                        <span>效果预览：</span>
                        <UserTag
                            text={tag.trim() || '炫彩标签'}
                            tagStyle={{
                                preset: tagPreset,
                                particle: tagParticle,
                                colors: tagColors.slice(
                                    0,
                                    getTagColorCount(tagPreset),
                                ),
                            }}
                            fallbackColor="#5b8ff9"
                        />
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>重置用户密码</p>
                    <div className={Style.inputBlock}>
                        <Input
                            className={Style.input}
                            value={resetPasswordUsername}
                            onChange={setResetPasswordUsername}
                            placeholder="要重置密码的用户名"
                        />
                        <Button
                            className={Style.button}
                            onClick={handleResetPassword}
                        >
                            确定
                        </Button>
                    </div>
                </div>

                <div className={Common.block}>
                    <p className={Common.title}>封禁用户</p>
                    <div className={Style.inputBlock}>
                        <Input
                            className={Style.input}
                            value={sealUsername}
                            onChange={setSealUsername}
                            placeholder="要封禁的用户名"
                        />
                        <Button className={Style.button} onClick={handleSeal}>
                            确定
                        </Button>
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>封禁用户列表</p>
                    <div className={Style.sealList}>
                        {sealList.users.map((username) => (
                            <span className={Style.sealUsername} key={username}>
                                {username}
                            </span>
                        ))}
                    </div>
                </div>

                <div className={Common.block}>
                    <p className={Common.title}>封禁ip</p>
                    <div className={Style.inputBlock}>
                        <Input
                            className={Style.input}
                            value={sealIpAddress}
                            onChange={setSealIpAddress}
                            placeholder="要封禁的ip"
                        />
                        <Button className={Style.button} onClick={handleSealIp}>
                            确定
                        </Button>
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>封禁ip列表</p>
                    <div className={Style.sealList}>
                        {sealList.ips.map((ip) => (
                            <span className={Style.sealUsername} key={ip}>
                                {ip}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export default Admin;
