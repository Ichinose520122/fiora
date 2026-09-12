import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TextMessage from '../src/modules/Chat/Message/TextMessage';
import Linkman from '../src/modules/FunctionBarAndLinkmanList/Linkman';

jest.mock('react-redux', () => ({ useSelector: () => '' }), { virtual: true });
jest.mock('../src/hooks/useAction', () => () => ({}));
jest.mock('../src/hooks/useAero', () => () => ({}));
jest.mock('../src/hooks/useStore', () => ({ useStore: () => ({ linkmans: {} }) }));
jest.mock('../src/service', () => ({}));
jest.mock('../src/components/Avatar', () => () => null);
jest.mock('@fiora/utils/ua', () => ({ isMobile: false }));

describe('legacy text rendering', () => {
    const content = '<img src=x onerror="alert(1)"><b>hello</b>';
    it('sanitizes message HTML while preserving formatting and links', () => {
        const html = renderToStaticMarkup(<TextMessage content={`${content} https://example.com`} />);
        expect(html).not.toMatch(/onerror=/i);
        expect(html).toContain('<b>hello</b>');
        expect(html).toContain('href="https://example.com"');
    });
    it('sanitizes conversation previews without requiring the chat to be opened', () => {
        const html = renderToStaticMarkup(<Linkman id="chat" name="tester" avatar="" preview={content} unread={0} time={new Date()} />);
        expect(html).not.toMatch(/onerror=/i);
        expect(html).toContain('<b>hello</b>');
    });
    it('preserves generated emoji sprites after sanitizing the input', () => {
        const html = renderToStaticMarkup(<TextMessage content="#(哈哈)" />);
        expect(html).toContain('<img');
        expect(html).toContain('background-position: left -30px');
        expect(html).not.toContain('&lt;img');
    });
});
