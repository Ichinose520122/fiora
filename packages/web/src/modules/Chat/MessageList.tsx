import React, { useRef, useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';

import { css } from 'linaria';
import { State, Message } from '../../state/reducer';
import useIsLogin from '../../hooks/useIsLogin';
import useAction from '../../hooks/useAction';
import {
    getLinkmanHistoryMessages,
    getDefaultGroupHistoryMessages,
    updateHistory,
} from '../../service';
import MessageComponent from './Message/Message';

import Style from './MessageList.less';
import {
    captureMessageScroll, restoreMessageScroll, MessageScroll,
} from '../../utils/messageScroll';

const styles = {
    container: css`
        flex: 1;
        position: relative;
        overflow: hidden;
    `,
    unread: css`
        position: absolute;
        bottom: 6px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--primary-color-8);
        font-size: 14px;
        color: var(--primary-text-color-9);
        padding: 3px 8px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    `,
};

function MessageList() {
    const action = useAction();
    const selfId = useSelector((state: State) => state.user?._id || '');
    const focus = useSelector((state: State) => state.focus);
    const isGroup = useSelector(
        (state: State) => state.linkmans[focus].type === 'group',
    );
    const creator = useSelector(
        (state: State) => state.linkmans[focus].creator,
    );
    const messages = useSelector(
        (state: State) => state.linkmans[focus].messages,
    );
    const unread = useSelector((state: State) => state.linkmans[focus].unread);
    const isLogin = useIsLogin();
    const tagColorMode = useSelector(
        (state: State) => state.status.tagColorMode,
    );

    const $list = useRef<HTMLDivElement>(null);
    const positions = useRef<Record<string, MessageScroll>>({});
    const isFetching = useRef(false);

    function restorePosition() {
        if ($list.current) {
            restoreMessageScroll($list.current, positions.current[focus]);
            positions.current[focus] = captureMessageScroll($list.current);
        }
    }

    useLayoutEffect(restorePosition, [focus, messages]);

    function clearUnread() {
        action.setLinkmanProperty(focus, 'unread', 0);
        const messageKeys = Object.keys(messages);
        if (messageKeys.length > 0) {
            updateHistory(
                focus,
                messages[messageKeys[messageKeys.length - 1]]._id,
            );
        }
    }

    async function handleScroll(e: any) {
        // Don't know why the code-view dialog will also trigger when scrolling
        if ($list.current && e.target !== $list.current) {
            return;
        }
        if ($list.current) {
            positions.current[focus] = captureMessageScroll($list.current);
        }
        if (isFetching.current) {
            return;
        }

        const $div = e.target as HTMLDivElement;

        if (
            unread &&
            !document.hidden &&
            $div.scrollHeight - $div.clientHeight - $div.scrollTop <= 50
        ) {
            clearUnread();
        }

        if ($div.scrollTop === 0 && $div.scrollHeight > $div.clientHeight) {
            isFetching.current = true;
            let historyMessages: Message[] = [];
            if (isLogin) {
                historyMessages = await getLinkmanHistoryMessages(
                    focus,
                    Object.keys(messages).length,
                );
            } else {
                historyMessages = await getDefaultGroupHistoryMessages(
                    Object.keys(messages).length,
                );
            }
            if (historyMessages && historyMessages.length > 0) {
                action.addLinkmanHistoryMessages(focus, historyMessages);
            }
            isFetching.current = false;
        }
    }

    function renderMessage(message: Message) {
        const isSelf = message.from._id === selfId;

        let { tag } = message.from;
        if (!tag && isGroup && message.from._id === creator) {
            tag = '群主';
        }

        return (
            <MessageComponent
                key={message._id}
                id={message._id}
                linkmanId={focus}
                isSelf={isSelf}
                userId={message.from._id}
                avatar={message.from.avatar}
                username={message.from.username}
                originUsername={message.from.originUsername}
                time={message.createTime}
                type={message.type}
                content={message.content}
                tag={tag}
                tagStyle={message.from.tagStyle}
                loading={message.loading}
                percent={message.percent}
                shouldScroll={false}
                tagColorMode={tagColorMode}
            />
        );
    }

    return (
        <div className={styles.container}>
            <div
                className={`${Style.messageList} show-scrollbar`}
                onScroll={handleScroll}
                onLoadCapture={restorePosition}
                ref={$list}
            >
                {Object.values(messages).map((message) =>
                    renderMessage(message),
                )}
            </div>
        </div>
    );
}

export default MessageList;
