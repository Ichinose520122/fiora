import { Types } from '@fiora/database/mongoose';
import assert from 'assert';
import User from '@fiora/database/mongoose/models/user';
import Message from '@fiora/database/mongoose/models/message';
import { createOrUpdateHistory } from '@fiora/database/mongoose/models/history';
import getLinkmanAccess from '../utils/linkmanAccess';

export async function updateHistory(
    ctx: Context<{ userId: string; linkmanId: string; messageId: string }>,
) {
    const { linkmanId, messageId } = ctx.data;
    const self = ctx.socket.user.toString();
    if (!Types.ObjectId.isValid(messageId)) {
        return {
            msg: `not update with invalid messageId:${messageId}`,
        };
    }

    await getLinkmanAccess(self, linkmanId);

    const [user, message] = await Promise.all([
        User.findOne({ _id: self }),
        Message.findOne({ _id: messageId, to: linkmanId }),
    ]);
    assert(user, '用户不存在');
    assert(message, '消息不存在或不属于该会话');

    await createOrUpdateHistory(self, linkmanId, messageId);

    return {
        msg: 'ok',
    };
}
