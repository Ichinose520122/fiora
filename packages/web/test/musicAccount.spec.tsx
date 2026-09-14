/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import request from '../src/utils/fetch';
import MusicAccount from '../src/modules/Music/MusicAccount';

jest.mock('../src/utils/fetch', () => jest.fn());

const fetchMock = request as jest.Mock;
const loggedOutAccount = {
    canManage: true,
    configured: true,
    loggedIn: false,
};

describe('MusicAccount', () => {
    beforeEach(() => fetchMock.mockReset());

    it('allows sending another code immediately when the adapter rejects the request', async () => {
        fetchMock
            .mockResolvedValueOnce([null, loggedOutAccount])
            .mockResolvedValueOnce(['验证码发送失败', null]);
        render(<MusicAccount />);
        await screen.findByText('尚未登录网易云');

        fireEvent.change(screen.getByLabelText('网易云手机号'), {
            target: { value: '13800138000' },
        });
        fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));

        await screen.findByText('验证码发送失败');
        expect(screen.getByRole('button', { name: '发送验证码' })).toBeEnabled();
        expect(fetchMock).toHaveBeenLastCalledWith(
            'musicSendCode',
            { phone: '13800138000', countryCode: '86' },
            { toast: false },
        );
    });

    it('supports logging in with a verified MUSIC_U cookie', async () => {
        fetchMock
            .mockResolvedValueOnce([null, loggedOutAccount])
            .mockResolvedValueOnce([null, { nickname: 'cookie-user' }]);
        render(<MusicAccount />);
        await screen.findByText('尚未登录网易云');

        fireEvent.change(screen.getByLabelText('网易云 MUSIC_U'), {
            target: { value: 'music-u-session-token' },
        });
        fireEvent.click(screen.getByRole('button', { name: '使用 MUSIC_U 登录' }));

        await screen.findByText('已登录：cookie-user');
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
            'musicLoginWithCookie',
            { cookie: 'music-u-session-token' },
            { toast: false },
        ));
    });
});
