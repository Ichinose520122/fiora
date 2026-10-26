/** @jest-environment jsdom */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import BotAccess from '../src/modules/Sidebar/BotAccess';
import { getBotConfig, saveBotConfig, rotateBotApiKey, revokeBotApiKey } from '../src/service';

jest.mock('../src/service', () => ({
    getBotConfig: jest.fn(),
    saveBotConfig: jest.fn(),
    rotateBotApiKey: jest.fn(),
    revokeBotApiKey: jest.fn(),
}));

const read = getBotConfig as jest.Mock;
const save = saveBotConfig as jest.Mock;
const rotate = rotateBotApiKey as jest.Mock;
const revoke = revokeBotApiKey as jest.Mock;
const empty = { enabled: false, userId: '', allowedGroupIds: [], allowPrivate: false, hasApiKey: false, apiKeyPrefix: '' };
const bound = { ...empty, userId: 'bot-user', allowedGroupIds: ['group-a'] };
const options = { users: [{ _id: 'bot-user', username: '专用机器人' }, { _id: 'second-bot', username: '备用机器人' }], groups: [{ _id: 'group-a', name: '测试群' }] };
const settings = (config = bound) => ({ config, options });

describe('BotAccess', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        read.mockReset().mockResolvedValue(settings());
        save.mockReset();
        rotate.mockReset();
        revoke.mockReset();
        jest.spyOn(window, 'confirm').mockReturnValue(true);
    });
    afterEach(() => jest.restoreAllMocks());

    it('starts disabled without credentials and binds an ordinary account before configuring scope', async () => {
        read.mockResolvedValueOnce(settings(empty));
        save.mockResolvedValueOnce(settings({ ...empty, userId: 'bot-user' }));
        render(<BotAccess />);
        await screen.findByRole('combobox', { name: '机器人账号' });
        await waitFor(() => expect(screen.getByRole('combobox').matches(':disabled')).toBe(false));
        expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
        expect(screen.getByRole('button', { name: '生成 API Key' }).matches(':disabled')).toBe(true);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bot-user' } });
        await waitFor(() => expect(read).toHaveBeenLastCalledWith('bot-user'));
        expect(screen.getByLabelText('允许与好友私聊').matches(':disabled')).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: '绑定机器人账号' }));
        await screen.findByText('机器人账号已绑定。请设置消息权限、保存配置，再生成 API Key。');
        expect(save).toHaveBeenCalledWith({ userId: 'bot-user', enabled: false, allowedGroupIds: [], allowPrivate: false });
        expect((screen.getByLabelText('测试群') as HTMLInputElement).checked).toBe(false);
        expect(screen.getByLabelText('允许与好友私聊').matches(':disabled')).toBe(false);
    });

    it('saves explicit group permissions, friend private messages and the enabled flag', async () => {
        save.mockResolvedValue(settings({ ...bound, enabled: true, allowedGroupIds: [], allowPrivate: true }));
        render(<BotAccess />);
        await waitFor(() => expect(screen.getByRole('combobox').matches(':disabled')).toBe(false));
        fireEvent.click(screen.getByRole('switch'));
        fireEvent.click(screen.getByLabelText('测试群'));
        fireEvent.click(screen.getByLabelText('允许与好友私聊'));
        expect(screen.getByRole('button', { name: '生成 API Key' }).matches(':disabled')).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: '保存接入配置' }));
        await screen.findByText('机器人接入配置已保存');
        expect(save).toHaveBeenCalledWith({ userId: 'bot-user', enabled: true, allowedGroupIds: [], allowPrivate: true });
    });

    it('displays generated credentials once, supports copying, and clears them on revoke', async () => {
        const keyed = { ...bound, hasApiKey: true, apiKeyPrefix: 'fiora_bot_abc' };
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        rotate.mockResolvedValue({ config: keyed, apiKey: 'secret-bot-key' });
        revoke.mockResolvedValue({ config: bound });
        render(<BotAccess />);
        await waitFor(() => expect(screen.getByRole('button', { name: '生成 API Key' }).matches(':disabled')).toBe(false));
        fireEvent.click(screen.getByRole('button', { name: '生成 API Key' }));
        expect((await screen.findByDisplayValue('secret-bot-key')).hasAttribute('readonly')).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: '复制 API Key' }));
        await screen.findByText('API Key 已复制');
        expect(writeText).toHaveBeenCalledWith('secret-bot-key');
        fireEvent.click(screen.getByRole('button', { name: '撤销 API Key' }));
        await screen.findByText('API Key 已撤销');
        expect(screen.queryByDisplayValue('secret-bot-key')).toBeNull();
    });

    it('does not recover a generated key when the panel is reopened', async () => {
        let resolve: (value: unknown) => void = () => {};
        rotate.mockReturnValue(new Promise((done) => { resolve = done; }));
        const first = render(<BotAccess />);
        await waitFor(() => expect(screen.getByRole('button', { name: '生成 API Key' }).matches(':disabled')).toBe(false));
        fireEvent.click(screen.getByRole('button', { name: '生成 API Key' }));
        first.unmount();
        render(<BotAccess />);
        await act(async () => { resolve({ config: { ...bound, hasApiKey: true }, apiKey: 'late-secret' }); });
        await waitFor(() => expect(screen.getByRole('combobox').matches(':disabled')).toBe(false));
        expect(screen.queryByDisplayValue('late-secret')).toBeNull();
        expect(screen.queryByText('API Key 已生成，请立即复制保存。')).toBeNull();
    });

    it('ignores stale key responses when refresh replaces the current view', async () => {
        let resolve: (value: unknown) => void = () => {};
        rotate.mockReturnValue(new Promise((done) => { resolve = done; }));
        const view = render(<BotAccess revision={0} />);
        await waitFor(() => expect(screen.getByRole('button', { name: '生成 API Key' }).matches(':disabled')).toBe(false));
        fireEvent.click(screen.getByRole('button', { name: '生成 API Key' }));
        view.rerender(<BotAccess revision={1} />);
        await act(async () => { resolve({ config: { ...bound, hasApiKey: true }, apiKey: 'stale-secret' }); });
        await waitFor(() => expect(screen.getByRole('combobox').matches(':disabled')).toBe(false));
        expect(screen.queryByDisplayValue('stale-secret')).toBeNull();
    });

    it('switches accounts in a separate binding save and does not persist candidate lookup configuration', async () => {
        read.mockResolvedValueOnce(settings({ ...bound, hasApiKey: true }));
        save.mockResolvedValueOnce(settings({ ...empty, userId: 'second-bot' }));
        render(<BotAccess />);
        await waitFor(() => expect(screen.getByRole('combobox').matches(':disabled')).toBe(false));
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'second-bot' } });
        await waitFor(() => expect(read).toHaveBeenLastCalledWith('second-bot'));
        expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('second-bot');
        expect(screen.getByRole('button', { name: '轮换 API Key' }).matches(':disabled')).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: '绑定机器人账号' }));
        await screen.findByText('机器人账号已绑定。请设置消息权限、保存配置，再生成 API Key。');
        expect(save).toHaveBeenCalledWith({ userId: 'second-bot', enabled: false, allowedGroupIds: [], allowPrivate: false });
    });

    it('keeps a failed rotation recoverable and supports cancelling destructive actions', async () => {
        read.mockResolvedValue(settings({ ...bound, hasApiKey: true }));
        rotate.mockRejectedValue(new Error('生成失败'));
        render(<BotAccess />);
        await waitFor(() => expect(screen.getByRole('button', { name: '轮换 API Key' }).matches(':disabled')).toBe(false));
        (window.confirm as jest.Mock).mockReturnValueOnce(false);
        fireEvent.click(screen.getByRole('button', { name: '轮换 API Key' }));
        expect(rotate).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '轮换 API Key' }));
        expect((await screen.findByRole('alert')).textContent).toContain('生成失败');
        expect(screen.getByRole('button', { name: '轮换 API Key' }).matches(':disabled')).toBe(false);
    });
});

