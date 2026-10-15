/** @jest-environment jsdom */
import React from 'react';
import { act, render } from '@testing-library/react';
import MessageList from '../src/pages/Chat/MessageList';

let mockMessages: any[];
let mockProps: any;
const mockEnd = jest.fn();
const mockTo = jest.fn();
const mockKeyboard: Record<string, () => void> = {};
jest.mock('react-native', () => {
    const React = require('react');
    return {
        StyleSheet: { create: (value: any) => value },
        ScrollView: React.forwardRef((props: any, ref: any) => {
            mockProps = props;
            React.useImperativeHandle(ref, () => ({ scrollToEnd: mockEnd, scrollTo: mockTo }));
            return <div>{props.children}</div>;
        }),
    };
}, { virtual: true });
jest.mock('react-native-keyboard-controller', () => ({ KeyboardEvents: {
    addListener: (name: string, callback: () => void) => { mockKeyboard[name] = callback; return { remove: () => {} }; },
} }), { virtual: true });
jest.mock('react-native-image-viewing', () => () => null, { virtual: true });
jest.mock('../src/config', () => ({ assetUrl: (value: string) => value }));
jest.mock('../src/state/action', () => ({}));
jest.mock('../src/utils/fetch', () => ({}));
jest.mock('../src/hooks/useStore', () => ({
    useFocusLinkman: () => ({ messages: mockMessages }), useIsLogin: () => true,
    useSelfId: () => 'self', useStore: () => ({ focus: 'chat' }),
}));
jest.mock('../src/components/Toast', () => ({}));
jest.mock('../src/utils/platform', () => ({ isAndroid: true }));
jest.mock('../src/utils/constant', () => ({}));
jest.mock('../src/pages/Chat/Message', () => () => null);

const message = (id: string, own = false) => ({ _id: id, type: 'text', loading: own, from: { _id: own ? 'self' : 'other' } });
const scroll = (y: number, height: number) => mockProps.onScroll({ nativeEvent: {
    layoutMeasurement: { height: 300 }, contentSize: { height }, contentOffset: { y },
} });

describe('native chat scroll behavior', () => {
    beforeEach(() => {
        jest.useFakeTimers(); jest.clearAllMocks();
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(() => callback(0), 16));
        jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => window.clearTimeout(id));
        mockMessages = [message('first'), message('last')];
    });
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

    it('follows sends and incoming batches at the bottom, and anchors prepended history', () => {
        const ref = React.createRef<any>();
        const view = render(<MessageList $scrollView={ref} />);
        const resize = (height: number) => act(() => {
            mockProps.onContentSizeChange(100, height); jest.advanceTimersByTime(20);
        });
        resize(1000);
        expect(mockEnd).toHaveBeenCalledTimes(1);
        scroll(100, 1000);
        mockEnd.mockClear();
        mockMessages = [...mockMessages, message('incoming')];
        view.rerender(<MessageList $scrollView={ref} />); resize(1100);
        expect(mockEnd).not.toHaveBeenCalled();
        mockMessages = [...mockMessages, message('own', true)];
        view.rerender(<MessageList $scrollView={ref} />); resize(1200);
        expect(mockEnd).toHaveBeenCalledTimes(1);
        mockMessages = [...mockMessages, message('batch1'), message('batch2')];
        view.rerender(<MessageList $scrollView={ref} />); resize(1400);
        expect(mockEnd).toHaveBeenCalledTimes(2);
        scroll(100, 1400);
        mockMessages = [message('older'), ...mockMessages];
        view.rerender(<MessageList $scrollView={ref} />); resize(1500);
        expect(mockTo).toHaveBeenLastCalledWith({ x: 0, y: 200, animated: false });
        expect(mockEnd).toHaveBeenCalledTimes(2);
    });

    it('finishes scrolling a local send after the keyboard animation', () => {
        const ref = React.createRef<any>();
        const view = render(<MessageList $scrollView={ref} />);
        act(() => mockKeyboard.keyboardWillHide());
        mockMessages = [...mockMessages, message('own', true)];
        view.rerender(<MessageList $scrollView={ref} />);
        act(() => mockProps.onContentSizeChange(100, 1200));
        expect(mockEnd).not.toHaveBeenCalled();
        act(() => { mockKeyboard.keyboardDidHide(); jest.advanceTimersByTime(60); });
        expect(mockEnd).toHaveBeenCalledTimes(1);
    });
});
