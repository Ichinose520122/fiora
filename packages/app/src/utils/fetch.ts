import Toast from '../components/Toast';
import socket from '../socket';
import { socketRequest } from './socketRequest';
export default async function fetch<T = any>(event: string, data: any = {}, { toast = true, timeout = 30000 } = {}): Promise<[string | null, T | null]> {
    const result = await socketRequest<T>(socket, event, data, timeout);
    if (result[0] && toast) Toast.danger(result[0]);
    return result;
}
