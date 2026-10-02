import React, { useEffect, useRef, useState } from 'react';
import { AdminUsersPage, formatAccountTime } from '@fiora/utils/adminUsers';
import fetch from '../../utils/fetch';
import Style from './AdminUsers.less';

export default function AdminUsers({ revision = 0 }: { revision?: number }) {
    const [keyword, setKeyword] = useState('');
    const [query, setQuery] = useState({ keyword: '', page: 1, refresh: 0 });
    const [result, setResult] = useState<AdminUsersPage>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const version = useRef(0);
    useEffect(() => {
        const request = ++version.current;
        setLoading(true); setError('');
        fetch<AdminUsersPage>('getAdminUsers', { keyword: query.keyword, page: query.page }, { toast: false })
            .then(([err, data]) => {
                if (version.current !== request) return;
                setResult(err ? undefined : data || undefined);
                setError(err || (!data ? '服务器未返回账号列表' : ''));
            })
            .catch(() => { if (version.current === request) { setResult(undefined); setError('读取失败，请重试'); } })
            .finally(() => { if (version.current === request) setLoading(false); });
        return () => { version.current += 1; };
    }, [query, revision]);
    return <div className={Style.directory}>
        <h3>全部账号{result ? ` · ${result.total}` : ''}</h3>
        <p className={Style.hint}>最近登录包含自动登录和重连，按本机时间显示；暂无记录表示未登录或历史记录缺失。</p>
        <form className={Style.toolbar} onSubmit={(event) => { event.preventDefault(); setQuery({ keyword: keyword.trim(), page: 1, refresh: query.refresh + 1 }); }}>
            <input aria-label="搜索用户名" placeholder="搜索用户名" maxLength={64} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <button type="submit" disabled={loading}>搜索</button>
            <button type="button" disabled={loading} onClick={() => setQuery({ ...query, refresh: query.refresh + 1 })}>刷新</button>
        </form>
        <div role="status" aria-live="polite">{loading ? '正在读取账号…' : error}</div>
        {!loading && result && <>
            <div className={Style.tableScroll}><table>
                <thead><tr><th scope="col">用户名</th><th scope="col">身份</th><th scope="col">最近登录</th><th scope="col">注册时间</th></tr></thead>
                <tbody>{result.users.map((user) => <tr key={user._id}>
                    <td>{user.username}</td><td>{user.isAdmin ? '管理员' : '普通用户'}</td>
                    <td>{formatAccountTime(user.lastLoginTime)}</td><td>{formatAccountTime(user.createTime)}</td>
                </tr>)}</tbody>
            </table></div>
            {!result.users.length && <p className={Style.hint}>没有匹配的账号</p>}
            <div className={Style.pagination}>
                <button type="button" disabled={result.page <= 1} onClick={() => setQuery({ ...query, page: result.page - 1 })}>上一页</button>
                <span>第 {result.page} / {result.pages} 页 · 共 {result.total} 个</span>
                <button type="button" disabled={result.page >= result.pages} onClick={() => setQuery({ ...query, page: result.page + 1 })}>下一页</button>
            </div>
        </>}
    </div>;
}
