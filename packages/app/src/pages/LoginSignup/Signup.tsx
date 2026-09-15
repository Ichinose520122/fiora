import React from 'react';
import { Container, Toast } from '../../components/NativeUI';
import { Actions } from '../../navigation';

import fetch from '../../utils/fetch';
import platform from '../../utils/platform';
import action from '../../state/action';

import Base from './Base';
import { setStorageValue } from '../../utils/storage';
import { Friend, Group } from '../../types/redux';

export default function Signup() {
    async function handleSubmit(username: string, password: string, inviteCode = '') {
        const [err, res] = await fetch('register', {
            username,
            password,
            inviteCode,
            ...platform,
        });
        if (!err) {
            Toast.show({
                text: '创建成功',
                type: 'success',
            });

            await setStorageValue('token', res.token);
            const user = res;
            action.setUser(user);

            const linkmanIds = [
                ...user.groups.map((g: Group) => g._id),
                ...user.friends.map((f: Friend) => f._id),
            ];
            const [err2, linkmans] = await fetch('getLinkmansLastMessagesV2', {
                linkmans: linkmanIds,
            });
            if (!err2) {
                action.setLinkmansLastMessages(linkmans);
            }

            Actions.chatlist();

        }
    }
    return (
        <Container>
            <Base invite
                buttonText="注册"
                jumpText="已有账号? 去登陆"
                jumpPage="login"
                onSubmit={handleSubmit}
            />
        </Container>
    );
}
