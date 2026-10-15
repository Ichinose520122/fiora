import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import MessageList from '../src/modules/Chat/MessageList';

let mockState: any;
jest.mock('react-redux', () => ({ useSelector: (select: any) => select(mockState) }), { virtual: true });
jest.mock('linaria', () => ({ css: () => '' }), { virtual: true });
jest.mock('../src/hooks/useAction', () => () => ({}));
jest.mock('../src/hooks/useIsLogin', () => () => true);
jest.mock('../src/service', () => ({}));
jest.mock('../src/modules/Chat/Message/Message', () => (props: any) => <div data-message-id={props.id} />);

function message(id: string, self = false, loading = false) {
    return { _id: id, loading, from: { _id: self ? 'self' : 'other' } };
}

describe('chat scroll behavior', () => {
    it('follows local sends and media growth, but preserves history reading for incoming messages', () => {
        const messages = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`m${i}`, message(`m${i}`)]));
        mockState = { user: { _id: 'self' }, focus: 'chat', status: {}, linkmans: { chat: { type: 'group', messages } } };
        const view = render(<MessageList />);
        const list = view.container.querySelector('.show-scrollbar') as HTMLElement;
        let position = 0;
        let extraHeight = 0;
        const bounds = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            const top = this.hasAttribute('data-message-id') ? Array.from(list.children).indexOf(this) * 100 - position : 0;
            return { top, bottom: top + (this === list ? 300 : 100) } as DOMRect;
        });
        Object.defineProperties(list, {
            scrollHeight: { get: () => list.children.length * 100 + extraHeight },
            clientHeight: { get: () => 300 },
            scrollTop: { get: () => position, set: (value) => { position = Math.max(0, Math.min(value, list.scrollHeight - 300)); } },
        });
        const update = (next: any) => {
            mockState.linkmans.chat.messages = next;
            view.rerender(<MessageList />);
        };
        update({ ...messages });
        expect(position).toBe(1700);
        list.scrollTop = 500;
        fireEvent.scroll(list);
        const incoming = { ...messages, incoming: message('incoming') };
        update(incoming);
        expect(position).toBe(500);
        const own = { ...incoming, local: message('local', true, true) };
        update(own);
        expect(position).toBe(1900);
        extraHeight = 400;
        fireEvent.load(list.lastElementChild!);
        expect(position).toBe(2300);
        list.scrollTop = 600;
        fireEvent.scroll(list);
        update({ ...own, olderSelf: message('olderSelf', true) });
        expect(position).toBe(600);
        update({ older: message('older'), ...own });
        expect(position).toBe(700);
        bounds.mockRestore();
    });
});
