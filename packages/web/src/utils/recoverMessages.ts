import { Message, MessagesMap } from '../state/reducer';

interface Cursor { time: string; id: string }
interface Page { messages: Message[]; until: string; next: Cursor | null }

/** Fetch an authoritative range without touching the displayed list until complete. */
export default async function recoverMessages(
    linkmanId: string,
    baseline: MessagesMap,
    fetchPage: (data: {
        linkmanId: string; since: string; until?: string; cursor?: Cursor;
    }) => Promise<Page>,
    isCurrent: () => boolean,
): Promise<Message[] | null> {
    const persisted = Object.values(baseline).filter((message) =>
        /^[a-f0-9]{24}$/i.test(message._id) && !message.loading,
    );
    if (!persisted.length) {
        return null;
    }
    const since = new Date(Math.min(...persisted.map((message) =>
        new Date(message.createTime).getTime(),
    ))).toISOString();
    let cursor: Cursor | undefined;
    let until: string | undefined;
    const messages: Message[] = [];
    do {
        // eslint-disable-next-line no-await-in-loop
        const page = await fetchPage({ linkmanId, since, until, cursor });
        if (!isCurrent()) {
            return null;
        }
        if (!page || !Array.isArray(page.messages) || !page.until) {
            throw new Error('无效的消息同步响应');
        }
        if (cursor && page.next && cursor.id === page.next.id && cursor.time === page.next.time) {
            throw new Error('消息同步游标未前进');
        }
        messages.push(...page.messages);
        until = page.until;
        cursor = page.next || undefined;
    } while (cursor);
    return messages;
}
