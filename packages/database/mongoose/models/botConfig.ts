import { Schema, model, Document } from 'mongoose';

const BotConfigSchema = new Schema({
    singleton: { type: String, unique: true, default: 'default' },
    enabled: { type: Boolean, default: false },
    userId: { type: String, default: '' },
    allowedGroupIds: [{ type: String }],
    allowPrivate: { type: Boolean, default: false },
    apiKeyHash: { type: String, default: '', select: false },
    apiKeyPrefix: { type: String, default: '' },
    revision: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
});

export interface BotConfigDocument extends Document {
    enabled: boolean;
    userId: string;
    allowedGroupIds: string[];
    allowPrivate: boolean;
    apiKeyHash: string;
    apiKeyPrefix: string;
    revision: string;
    updatedAt: Date;
}

// Durable request fingerprints reject conflicting retries across restarts and workers.
const BotRequestSchema = new Schema({
    key: { type: String, required: true, unique: true },
    digest: { type: String, required: true },
    messageId: { type: String },
    createTime: { type: Date, default: Date.now },
});
export const BotRequest = model<Document & { key: string; digest: string; messageId?: string }>('BotRequest', BotRequestSchema);
export default model<BotConfigDocument>('BotConfig', BotConfigSchema);
