require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const User = require('../packages/database/mongoose/models/user').default;
const Group = require('../packages/database/mongoose/models/group').default;
const Friend = require('../packages/database/mongoose/models/friend').default;
(async () => {
    if (!process.env.Database.endsWith('/fiora_review')) throw new Error('Review database only');
    await mongoose.connect(process.env.Database, { useNewUrlParser: true, useUnifiedTopology: true });
    const password = fs.readFileSync('/secrets/review-password.txt', 'utf8').trim();
    const users = [];
    for (const name of ['reviewer1', 'reviewer2', 'reviewer3']) {
        let user = await User.findOne({ username: name });
        if (!user) {
            const salt = bcrypt.genSaltSync(10);
            user = await User.create({ username: name, salt, password: bcrypt.hashSync(password, salt),
                avatar: '/avatar/0.jpg', createTime: new Date('2020-01-01'), expressions: ['/avatar/0.jpg'] });
        }
        users.push(user);
    }
    const defaultGroup = await Group.findOne({ isDefault: true });
    if (defaultGroup) {
        await Group.updateOne({ _id: defaultGroup._id }, { $addToSet: { members: { $each: users.map(u => u._id) } }, $set: { creator: users[0]._id } });
    }
    for (const [name, members] of [['音乐审核房间', [users[0]._id, users[1]._id]], ['隔离测试房间', [users[2]._id]]]) {
        await Group.updateOne({ name }, { $setOnInsert: { name, members, creator: members[0], avatar: '/avatar/0.jpg' } }, { upsert: true });
    }
    for (const [from, to] of [[users[0]._id, users[1]._id], [users[1]._id, users[0]._id]]) {
        await Friend.updateOne({ from, to }, { $setOnInsert: { from, to } }, { upsert: true });
    }
    console.log('Three review accounts, two isolated groups and a private chat are ready.');
    await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
