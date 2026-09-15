import React from 'react';
import { Container } from '../../components/NativeUI';
import { Actions } from '../../navigation';

import fetch from '../../utils/fetch';
import platform from '../../utils/platform';
import action from '../../state/action';

import Base from './Base';
import { saveSession } from '../../utils/session';
import store from '../../state/store';
import { Friend, Group } from '../../types/redux';

export default function Login() {
    async function handleSubmit(username: string, password: string) {
        const [err, res] = await fetch('login', {
            username,
            password,
            ...platform,
        });
        if (!err) {
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
            <Base
                buttonText="登录"
                jumpText="注册新用户"
                jumpPage="signup"
                onSubmit={handleSubmit}
            />
        </Container>
    );
}
