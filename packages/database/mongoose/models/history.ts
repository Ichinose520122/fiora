import { Schema, model, Document } from 'mongoose';

const HistoryScheme = new Schema({
    user: {
        type: String,
        required: true,
    },
    linkman: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
});

HistoryScheme.index({ user: 1, linkman: 1 });

export interface HistoryDocument extends Document {
    /** user id */
    user: string;

    /** linkman id */
    linkman: string;

    /** last readed message id */
    message: string;
}

const History = model<HistoryDocument>('History', HistoryScheme);

export default History;

export async function createOrUpdateHistory(
    userId: string,
    linkmanId: string,
    messageId: string,
) {
    await History.updateOne(
        { user: userId, linkman: linkmanId },
        { $set: { message: messageId } },
        { upsert: true },
    );
    return {};
}
