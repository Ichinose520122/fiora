import assert, { AssertionError } from 'assert';
import { Types } from '@fiora/database/mongoose';
import Group, {
    GroupDocument,
} from '@fiora/database/mongoose/models/group';
import User, { UserDocument } from '@fiora/database/mongoose/models/user';
import getFriendId from '@fiora/utils/getFriendId';

type LinkmanAccess = {
    group: GroupDocument | null;
    user: UserDocument | null;
};

/**
 * Verify that the current user belongs to the requested group or private chat.
 * Private chat IDs are deterministic, so membership must never be inferred from
 * the caller simply knowing the ID.
 */
export default async function getLinkmanAccess(
    currentUserIdValue: string,
    linkmanIdValue: string,
): Promise<LinkmanAccess> {
    const currentUserId = currentUserIdValue.toString().toLowerCase();
    const linkmanId = String(linkmanIdValue || '').toLowerCase();

    assert(Types.ObjectId.isValid(currentUserId), '无效的当前用户ID');

    if (Types.ObjectId.isValid(linkmanId)) {
        const group = await Group.findOne({ _id: linkmanId });
        if (!group) {
            throw new AssertionError({ message: '群组不存在' });
        }
        assert(
            group.members.some(
                (member) => member.toString().toLowerCase() === currentUserId,
            ),
            '你不在该群组中',
        );
        return {
            group,
            user: null,
        };
    }

    assert(/^[0-9a-f]{48}$/.test(linkmanId), '无效的私聊ID');
    const firstUserId = linkmanId.slice(0, 24);
    const secondUserId = linkmanId.slice(24);
    assert(
        firstUserId === currentUserId || secondUserId === currentUserId,
        '无权访问该私聊',
    );

    const targetUserId =
        firstUserId === currentUserId ? secondUserId : firstUserId;
    assert(
        getFriendId(currentUserId, targetUserId) === linkmanId,
        '无效的私聊ID',
    );

    const user = await User.findOne({ _id: targetUserId });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    return {
        group: null,
        user,
    };
}
