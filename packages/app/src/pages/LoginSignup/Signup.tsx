import React from 'react';
import { Container, Toast } from '../../components/NativeUI';
import { Actions } from '../../navigation';

import fetch from '../../utils/fetch';
import platform from '../../utils/platform';
import action from '../../state/action';

import Base from './Base';
import { saveSession } from '../../utils/session';
import store from '../../state/store';
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

            await saveSession(res.token);
            const user = res;
            action.setUser(user);
            action.connect();
            Actions.pop();
            const linkmanIds = [
                ...user.groups.map((g: Group) => g._id),
                ...user.friends.map((f: Friend) => f._id),
            ];
            const [err2, linkmans] = await fetch('getLinkmansLastMessagesV2', {
                linkmans: linkmanIds,
            });
            if (!err2 && store.getState().user?._id === user._id) {
                action.setLinkmansLastMessages(linkmans);
            }



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
