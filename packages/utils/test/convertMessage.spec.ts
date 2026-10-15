import convertMessage from '../convertMessage';

describe('legacy system messages', () => {
    it('renders watch invitations without embedding login tickets', () => {
        const result = convertMessage({ type: 'system', content: JSON.stringify({ command: 'watch', invite: true, source: 'https://example.com/a.m3u8' }), from: { _id: 'user', username: 'tester' } });
        expect(result.type).toBe('watch');
        expect(JSON.parse(result.content)).toEqual({ source: 'https://example.com/a.m3u8' });
    });
    it.each(['not-json', '', 'null', '0', '"text"'])('does not throw for %p', (content) => {
        const message = { type: 'system', content, from: { _id: 'user', username: 'tester' } };
        expect(() => convertMessage(message)).not.toThrow();
        expect(message.content).toBe('无效的系统消息');
    });
    it('continues rendering valid roll and rps messages', () => {
        const from = () => ({ _id: 'user', username: 'tester' });
        expect(convertMessage({ type: 'system', content: '{"command":"roll","value":3,"top":6}', from: from() }).content).toBe('掷出了3点 (上限6点)');
        expect(convertMessage({ type: 'system', content: '{"command":"rps","value":"石头"}', from: from() }).content).toBe('使出了 石头');
    });
});
