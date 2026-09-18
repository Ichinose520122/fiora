import store from '../state/store';
import action from '../state/action';
import { Message } from '../types/redux';
import waitForSession from './waitForSession';
import fetch from './fetch';
import retryFile from './retryFile';
const active = new Set<string>();
export default async function retryMessage(message: Message) {
    if (message.type === 'file') return retryFile(message);
    const userId = store.getState().user?._id;
    if (!userId || message.from._id !== userId || active.has(message._id)) return;
    active.add(message._id);
    const update = (data: Partial<Message>) => { if (store.getState().user?._id === userId) action.updateSelfMessage(message.to, message._id, data as Message); };
    try {
        if (message.type === 'image' && /^(file|content|data):/.test(message.content)) throw new Error('图片未上传完成，请重新选择图片发送');
        update({ loading: true, failed: false, error: '' });
        await waitForSession(userId);
        const [error, result] = await fetch<Message & { additionalMessages?: Message[] }>('sendMessage', { to: message.to, type: message.type, content: message.content }, { timeout: 180000, toast: false });
        if (error || !result) throw new Error(error || '消息未确认');
        const { additionalMessages = [], ...first } = result;
        update({ ...first, loading: false, failed: false });
        if (store.getState().user?._id === userId) additionalMessages.forEach((item) => action.addLinkmanMessage(message.to, item));
    } catch (error) { update({ loading: false, failed: true, error: error instanceof Error ? error.message : '发送失败' }); }
    finally { active.delete(message._id); }
}
