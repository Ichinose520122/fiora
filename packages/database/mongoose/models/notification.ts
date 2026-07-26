import { Schema, model, Document } from 'mongoose';

const NotificationSchema = new Schema({
    createTime: { type: Date, default: Date.now },

    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    token: {
        type: String,
        unique: true,
    },
});

export interface NotificationDocument extends Document {
    user: any;
    token: string;
}

const Notification = model<NotificationDocument>(
    'Notification',
    NotificationSchema,
);

export default Notification;
