interface ScrollMessage {
    _id: string;
    loading?: boolean;
    from: { _id: string };
}

/** Only a new local send should interrupt reading older messages. */
export function hasNewOwnMessage(
    messages: ScrollMessage[], previousIds: Set<string>, selfId: string,
) {
    return messages.some((message) =>
        message.loading && message.from._id === selfId && !previousIds.has(message._id));
}
