/**
 * Grant or revoke administrator privileges for an existing account.
 */

import chalk from 'chalk';

import initMongoDB from '@fiora/database/mongoose/initMongoDB';
import User from '../../database/mongoose/models/user';

export async function setAdmin(username: string, enabled = true) {
    if (!username) {
        console.log(chalk.red('用户名不能为空'));
        return false;
    }

    await initMongoDB();

    const user = await User.findOne({ username });
    if (!user) {
        console.log(chalk.red(`账号 [${username}] 不存在`));
        return false;
    }

    user.isAdmin = enabled;
    await user.save();
    console.log(
        chalk.green(
            enabled
                ? `已将 [${username}] 设为管理员`
                : `已取消 [${username}] 的管理员权限`,
        ),
    );
    return true;
}

async function run() {
    const username = process.argv[3];
    const enabledValue = process.argv[4];
    const enabled = !['false', '0', 'no'].includes(
        String(enabledValue || 'true').toLowerCase(),
    );
    await setAdmin(username, enabled);
    process.exit(0);
}

export default run;
