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
    const view = render(<WatchMessage roomId="chat-id" content='{"source":"https://example.com/a.mp4"}' />);
    fireEvent.click(view.getByText('进入影院'));
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith('https://watch.example.com/#ticket=fresh'));
    expect(fetch).toHaveBeenCalledWith('watchJoin', { roomId: 'chat-id', source: 'https://example.com/a.mp4' });
    expect(tab.opener).toBe(null); open.mockRestore();
});
test('access refusal closes the blank window', async () => {
    const tab = { opener: {}, close: jest.fn() };
    const open = jest.spyOn(window, 'open').mockReturnValue(tab as any);
    (fetch as jest.Mock).mockResolvedValue(['你不在该群组中', null]);
    const view = render(<WatchMessage roomId="chat-id" content="{}" />);
    fireEvent.click(view.getByText('进入影院'));
    await waitFor(() => expect(tab.close).toHaveBeenCalled()); open.mockRestore();
});
