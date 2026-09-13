import { Schema, model } from 'mongoose';

// One document per existing group/private conversation. Audio bytes live elsewhere.
export default model('MusicRoom', new Schema({
    _id: String,
    state: Schema.Types.Mixed,
    updatedAt: { type: Date, default: Date.now },
}));

