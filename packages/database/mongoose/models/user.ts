import { Schema, model, Document } from 'mongoose';
import {
    isValidUserTag,
    NAME_REGEXP,
    USER_TAG_MAX_LENGTH,
} from '@fiora/utils/const';
import { TagStyle } from '@fiora/utils/tagStyle';

const TagStyleSchema = new Schema(
    {
        preset: {
            type: String,
            enum: ['solid', 'dualGradient', 'tripleGradient', 'monochrome'],
            default: 'solid',
        },
        colors: [{ type: String }],
        particle: {
            type: String,
            enum: ['none', 'star', 'heart'],
            default: 'none',
        },
    },
    { _id: false },
);

const UserSchema = new Schema({
    createTime: { type: Date, default: Date.now },
    lastLoginTime: { type: Date, default: Date.now },

    username: {
        type: String,
        trim: true,
        unique: true,
        match: NAME_REGEXP,
        index: true,
    },
    salt: String,
    password: String,
    avatar: String,
    tag: {
        type: String,
        default: '',
        trim: true,
        validate: {
            validator: (tag: string) => tag === '' || isValidUserTag(tag),
            message: `用户标签不能超过${USER_TAG_MAX_LENGTH}个字符`,
        },
    },
    tagStyle: {
        type: TagStyleSchema,
        default: () => ({
            preset: 'solid',
            colors: [],
            particle: 'none',
        }),
    },
    expressions: [
        {
            type: String,
        },
    ],
    lastLoginIp: String,
    isAdmin: {
        type: Boolean,
        default: false,
    },
});

export interface UserDocument extends Document {
    /** 用户名 */
    username: string;
    /** 密码加密盐 */
    salt: string;
    /** 加密的密码 */
    password: string;
    /** 头像 */
    avatar: string;
    /** 用户标签 */
    tag: string;
    /** 用户标签样式 */
    tagStyle: TagStyle;
    /** 表情收藏 */
    expressions: string[];
    /** 创建时间 */
    createTime: Date;
    /** 最后登录时间 */
    lastLoginTime: Date;
    /** 最后登录IP */
    lastLoginIp: string;
    /** 是否为管理员 */
    isAdmin: boolean;
}

/**
 * User Model
 * 用户信息
 */
const User = model<UserDocument>('User', UserSchema);

export default User;
