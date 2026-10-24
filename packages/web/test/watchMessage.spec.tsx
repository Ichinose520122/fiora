import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import WatchMessage from '../src/modules/Chat/Message/WatchMessage';
import fetch from '../src/utils/fetch';
jest.mock('../src/utils/fetch', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../src/components/Message', () => ({ __esModule: true, default: { error: jest.fn() } }));
test('click obtains a fresh ticket for the invitation chat and navigates without opener', async () => {
    const tab = { opener: {}, location: { replace: jest.fn() }, close: jest.fn() };
    const open = jest.spyOn(window, 'open').mockReturnValue(tab as any);
    (fetch as jest.Mock).mockResolvedValue([null, { url: 'https://watch.example.com/#ticket=fresh' }]);
    const view = render(<WatchMessage roomId="chat-id" content='{"source":"https://example.com/a.mp4","title":"葬送的芙莉莲","cover":"https://img.example.com/cover.jpg"}' />);
    fireEvent.click(view.getByAltText('葬送的芙莉莲'));
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith('https://watch.example.com/#ticket=fresh'));
    expect(fetch).toHaveBeenCalledWith('watchJoin', { roomId: 'chat-id', source: 'https://example.com/a.mp4' });
    expect(tab.opener).toBe(null);
    await waitFor(() => expect(view.getByRole('button').hasAttribute('disabled')).toBe(false));
    fireEvent.click(view.getByText('葬送的芙莉莲'));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2)); open.mockRestore();
});
test('access refusal closes the blank window', async () => {
    const tab = { opener: {}, close: jest.fn() };
    const open = jest.spyOn(window, 'open').mockReturnValue(tab as any);
    (fetch as jest.Mock).mockResolvedValue(['你不在该群组中', null]);
    const view = render(<WatchMessage roomId="chat-id" content="{}" />);
    fireEvent.click(view.getByRole('button', { name: '放映室，进入放映室' }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled()); open.mockRestore();
});

test('an updated invitation refreshes its title and recovers from a failed cover', () => {
    const view = render(<WatchMessage roomId="chat-id" content='{"title":"原来的影片","cover":"https://img.example.com/old.jpg"}' />);
    fireEvent.error(view.getByAltText('原来的影片'));
    expect(view.queryByRole('img')).toBe(null);
    expect(view.getByRole('button', { name: '原来的影片，进入放映室' })).toBeTruthy();

    view.rerender(<WatchMessage roomId="chat-id" content='{"title":"新的影片","cover":"https://img.example.com/new.jpg"}' />);
    expect(view.getByText('新的影片')).toBeTruthy();
    expect(view.getByAltText('新的影片').getAttribute('src')).toBe('https://img.example.com/new.jpg');
    expect(view.queryByText('原来的影片')).toBe(null);
});

test('joining remains disabled and shows progress until the ticket arrives', async () => {
    let complete: (result: any) => void = () => {};
    const tab = { opener: {}, location: { replace: jest.fn() }, close: jest.fn() };
    const open = jest.spyOn(window, 'open').mockReturnValue(tab as any);
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const view = render(<WatchMessage roomId="chat-id" content='{"title":"影片"}' />);
    const button = view.getByRole('button', { name: '影片，进入放映室' });
    fireEvent.click(button);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(view.getByText('正在进入…')).toBeTruthy();

    complete([null, { url: 'https://watch.example.com/#ticket=fresh' }]);
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(view.getByText('进入放映室')).toBeTruthy();
    open.mockRestore();
});
