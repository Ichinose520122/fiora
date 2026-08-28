import React, { useState } from 'react';
import platform from 'platform';
import { useDispatch } from 'react-redux';

import getFriendId from '@fiora/utils/getFriendId';
import convertMessage from '@fiora/utils/convertMessage';
import Style from './LoginRegister.less';
import Input from '../../components/Input';
import useAction from '../../hooks/useAction';
import { register, getLinkmansLastMessagesV2 } from '../../service';
import { initOSS } from '../../utils/uploadFile';
import { Message } from '../../state/reducer';
import { ActionTypes } from '../../state/action';

function Register() {
    const action = useAction();
    const dispatch = useDispatch();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');

    async function handleRegister() {
        const user = await register(
            username.trim(),
            password.trim(),
            inviteCode.trim(),
            platform.os?.family,
            platform.name,
            platform.description,
        );
        if (user) {
            action.setUser(user);
            action.toggleLoginRegisterDialog(false);
            window.localStorage.setItem('token', user.token);
            await initOSS();

            const linkmanIds = [
                ...user.groups.map((group: any) => group._id),
                ...user.friends.map((friend: any) =>
                    getFriendId(friend.from, friend.to._id),
                ),
            ];
            const linkmanMessages = await getLinkmansLastMessagesV2(linkmanIds);
            Object.values(linkmanMessages).forEach(
                // @ts-ignore
                ({ messages }: { messages: Message[] }) => {
                    messages.forEach(convertMessage);
                },
            );
            dispatch({
                type: ActionTypes.SetLinkmansLastMessages,
                payload: linkmanMessages,
            });
        }
    }

    return (
        <div className={`${Style.loginRegister} ${Style.register}`}>
            <h2 className={Style.heading}>加入休息室</h2>
            <p className={Style.description}>使用通用邀请码</p>
            <h3 className={Style.title}>用户名</h3>
            <Input
                className={Style.input}
                value={username}
                onChange={setUsername}
                onEnter={handleRegister}
            />
            <h3 className={Style.title}>密码</h3>
            <Input
                className={Style.input}
                type="password"
                value={password}
                onChange={setPassword}
                onEnter={handleRegister}
            />
            <h3 className={Style.title}>邀请码</h3>
            <Input
                className={Style.input}
                type="password"
                value={inviteCode}
                onChange={setInviteCode}
                onEnter={handleRegister}
            />
            <button
                className={Style.button}
                onClick={handleRegister}
                type="button"
            >
                注册并进入
            </button>
        </div>
    );
}

export default Register;
