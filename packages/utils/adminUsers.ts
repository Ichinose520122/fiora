export interface AdminUser {
    _id: string;
    username: string;
    isAdmin: boolean;
    createTime: string | null;
    lastLoginTime: string | null;
}

export interface AdminUsersPage {
    users: AdminUser[];
    total: number;
    page: number;
    pageSize: number;
    pages: number;
}

export function formatAccountTime(value: string | null) {
    if (!value) return '暂无记录';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '暂无记录' : date.toLocaleString();
}
