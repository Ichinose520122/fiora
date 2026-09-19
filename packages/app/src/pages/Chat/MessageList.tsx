import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import ImageViewer from 'react-native-image-viewing';
import { assetUrl } from '../../config';

import action from '../../state/action';
import fetch from '../../utils/fetch';

import Message from './Message';
import {
    useFocusLinkman,
    useIsLogin,
    useSelfId,
    useStore,
} from '../../hooks/useStore';
import { Message as MessageType } from '../../types/redux';
import Toast from '../../components/Toast';
import { isAndroid, isiOS } from '../../utils/platform';
import { referer } from '../../utils/constant';

type Props = {
    $scrollView: React.RefObject<ScrollView | null>;
};


function MessageList({ $scrollView }: Props) {
    const scrollState = useRef({ prevContentHeight: 0, prevMessageCount: 0, shouldScroll: true, isFirstTimeFetchHistory: true }).current;
    const keyboardTransition = useRef(false);
    const wasAtBottom = useRef(true);
    const scrollFrame = useRef<number | null>(null);
    const viewportHeight = useRef(0);
    const resizeScroll = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isLogin = useIsLogin();
    const self = useSelfId();
    const focusLinkman = useFocusLinkman();
    const { focus } = useStore();
    const messages = focusLinkman?.messages || [];

    const userScrolling = useRef(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showImageViewerDialog, toggleShowImageViewerDialog] = useState(
        false,
    );
    const [imageViewerIndex, setImageViewerIndex] = useState(0);

    useEffect(() => {
        const willChange = () => {
            if (!keyboardTransition.current) wasAtBottom.current = scrollState.shouldScroll;
            keyboardTransition.current = true;
            if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
            if (resizeScroll.current) clearTimeout(resizeScroll.current);
        };
        const didChange = (opening: boolean) => {
            // Keep transition-generated layout/scroll events out of history loading.
            if (resizeScroll.current) clearTimeout(resizeScroll.current);
            resizeScroll.current = setTimeout(() => {
                // On hide, ScrollView clamps to the larger viewport itself.
                // A second scrollToEnd after that clamp causes a visible bounce.
                if (opening && wasAtBottom.current) $scrollView.current?.scrollToEnd({ animated: false });
                keyboardTransition.current = false;
                scrollState.shouldScroll = wasAtBottom.current;
            }, 50);
        };
        const listeners = [
            KeyboardEvents.addListener('keyboardWillShow', willChange),
            KeyboardEvents.addListener('keyboardWillHide', willChange),
            KeyboardEvents.addListener('keyboardDidShow', () => didChange(true)),
            KeyboardEvents.addListener('keyboardDidHide', () => didChange(false)),
        ];
        return () => {
            listeners.forEach(listener => listener.remove());
            if (resizeScroll.current) clearTimeout(resizeScroll.current);
            if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
        };
    }, []);

    function getImages() {
        const imageMessages = messages.filter(
            (message) => message.type === 'image',
        );
        const images = imageMessages.map((message) => {
            const url = message.content;
            const parseResult = /width=(\d+)&height=(\d+)/.exec(url);
            return {
                uri: assetUrl(url),
                ...(parseResult
                    ? {
                        width: +parseResult[1],
                        height: +parseResult[2],
                    }
                    : {}),
            };
        });
        return images;
    }

    function scrollToEnd() {
        if (keyboardTransition.current) return;
        if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
        scrollFrame.current = requestAnimationFrame(() => {
            scrollFrame.current = null;
            if (!keyboardTransition.current) $scrollView.current?.scrollToEnd({ animated: false });
        });
    }

    async function handleRefresh() {
        if (refreshing) {
            return;
        }

        if (scrollState.isFirstTimeFetchHistory && isAndroid) {
            scrollState.isFirstTimeFetchHistory = false;
            return;
        }

        setRefreshing(true);

        let err = null;
        let result = null;
        if (isLogin) {
            [err, result] = await fetch('getLinkmanHistoryMessages', {
                linkmanId: focus,
                existCount: messages.filter((message) => /^[a-f0-9]{24}$/i.test(message._id)).length,
            });
        } else {
            [err, result] = await fetch('getDefalutGroupHistoryMessages', {
                existCount: messages.length,
            });
        }
        if (!err && Array.isArray(result)) {
            if (result.length > 0) {
                action.addLinkmanHistoryMessages(focus, result);
            } else {
                Toast.warning('没有更多消息了');
            }
        }

        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    }
    /**
     * 加载历史消息后, 自动滚动到合适位置
     */
    function handleContentSizeChange(
        contentWidth: number,
        contentHeight: number,
    ) {
        if (scrollState.prevContentHeight === 0) {
            $scrollView.current!.scrollTo({
                x: 0,
                y: 0,
                animated: false,
            });
        } else if (
            contentHeight !== scrollState.prevContentHeight &&
            messages.length - scrollState.prevMessageCount > 1
        ) {
            $scrollView.current!.scrollTo({
                x: 0,
                y: contentHeight - scrollState.prevContentHeight - 60,
                animated: false,
            });
        }
        scrollState.prevContentHeight = contentHeight;
        scrollState.prevMessageCount = messages.length;
    }

    function handleScroll(event: any) {
        const {
            layoutMeasurement,
            contentSize,
            contentOffset,
        } = event.nativeEvent;
        if (keyboardTransition.current) return;
        scrollState.shouldScroll =
            contentOffset.y >
            contentSize.height - layoutMeasurement.height * 1.2;

        if (userScrolling.current && contentOffset.y < (isiOS ? 0 : 50)) {
            handleRefresh();
        }
    }

    function openImageViewer(url: string) {
        const images = getImages();
        const index = images.findIndex(
            (image) => image.uri === assetUrl(url),
        );
        toggleShowImageViewerDialog(true);
        setImageViewerIndex(Math.max(0, index));
    }

    function renderMessage(message: MessageType) {
        return (
            <Message
                key={message._id}
                message={message}
                isSelf={self === message.from._id}
                shouldScroll={scrollState.shouldScroll}
                scrollToEnd={scrollToEnd}
                openImageViewer={openImageViewer}
            />
        );
    }

    function closeImageViewerDialog() {
        toggleShowImageViewerDialog(false);
    }

    return (
        <ScrollView
            style={styles.container}
            ref={$scrollView}
            onContentSizeChange={handleContentSizeChange}
            contentContainerStyle={{ paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={isiOS ? "interactive" : "on-drag"}
            onLayout={(event) => {
                const height = event.nativeEvent.layout.height;
                const previous = viewportHeight.current;
                viewportHeight.current = height;
                // Expanding the viewport already clamps its offset natively.
                if (!keyboardTransition.current && height < previous && scrollState.shouldScroll) scrollToEnd();
            }}
            onScrollBeginDrag={() => { userScrolling.current = true; }}
            onScrollEndDrag={() => { userScrolling.current = false; }}
            scrollEventThrottle={50}
            onScroll={handleScroll}
        >
            {messages.map((message) => renderMessage(message))}
            <ImageViewer
                images={getImages()}
                imageIndex={imageViewerIndex}
                visible={showImageViewerDialog}
                onRequestClose={closeImageViewerDialog}
            />
        </ScrollView>
    );
}

export default MessageList;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 0,
    },
});
