import { File } from 'expo-file-system';
import store from '../state/store';
import action from '../state/action';
import { Message } from '../types/redux';
import uploadFile from './uploadFile';
import waitForSession from './waitForSession';
import fetch from './fetch';

const active = new Set<string>();
export default async function retryFile(message: Message) {
    if (active.has(message._id)) return;
    const sender = store.getState().user?._id;
    if (!sender || sender !== message.from._id) return;
    active.add(message._id);
    const update = (patch: Partial<Message>) => {
        if (sender === store.getState().user?._id) action.updateSelfMessage(message.to, message._id, patch as Message);
    };
    try {
        update({ loading: true, failed: false, error: '', statusText: '正在准备上传…' });
        const details = JSON.parse(message.content);
        await waitForSession(sender);
        if (!details.fileUrl) {
            if (!message.localFileUri) throw new Error('手机上的文件已不可用，请重新选择');
            const file = new File(message.localFileUri);
            if (!file.exists) throw new Error('手机上的文件已不可用，请重新选择');
            const bytes = await file.arrayBuffer();
            if (bytes.byteLength !== details.size) throw new Error('文件大小已改变，请重新选择');
            details.fileUrl = await uploadFile(bytes, `FileMessage/${sender}_${Date.now()}.${details.ext}`, false, (percent) => update({ statusText: `正在上传文件… ${percent}%` }));
        }
        const content = JSON.stringify(details);
        update({ content, statusText: '正在确认消息…' });
        await waitForSession(sender);
        // A disconnected acknowledgement may still have committed the message.
        const [historyError, history] = await fetch<Message[]>('getLinkmanHistoryMessages', { linkmanId: message.to, existCount: 0 }, { toast: false });
        if (historyError) throw new Error(historyError);
        const existing = history?.find((item) => item.from._id === sender && item.type === 'file' && item.content === content);
        const [error, result] = existing ? [null, existing] : await fetch<Message>('sendMessage', { to: message.to, type: 'file', content }, { toast: false });
        if (error || !result) throw new Error(error || '服务器未返回消息确认');
        update({ ...result, loading: false, failed: false, error: '', statusText: '', localFileUri: undefined });
    } catch (error) {
        update({ loading: false, failed: true, error: error instanceof Error ? error.message : '文件发送失败', statusText: '' });
    } finally { active.delete(message._id); }
}
