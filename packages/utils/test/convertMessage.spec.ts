import convertMessage from '../convertMessage';
import convertAppMessage from '../../app/src/utils/convertMessage';

describe('legacy system messages', () => {
    it('renders watch invitations without embedding login tickets', () => {
        const metadata = { source: 'https://example.com/series', title: '<script>片名</script>', cover: 'https://img.example.com/a.jpg' };
        for (const convert of [convertMessage, convertAppMessage]) {
            const result = convert({ type: 'system', content: JSON.stringify({ command: 'watch', invite: true, source: 'https://example.com/a.m3u8' }), from: { _id: 'user', username: 'tester' } } as any);
            expect(result.type).toBe('watch');
            expect(JSON.parse(result.content)).toEqual({ source: 'https://example.com/a.m3u8', title: '放映室', cover: '' });
            const updated = convert({ type: 'system', content: JSON.stringify({ command: 'watch', invite: true, value: '邀请一起看', ...metadata }), from: { _id: 'user', username: 'tester' } } as any);
            expect(updated.type).toBe('watch'); expect(JSON.parse(updated.content)).toEqual(metadata);
        }
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
