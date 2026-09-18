import { requireOptionalNativeModule } from 'expo';
import React from 'react';
import { Share, Text, TouchableOpacity, View } from 'react-native';
import * as Application from 'expo-application';
import { Actions } from '../navigation';

/** A malformed profile must not terminate the chat session. */
export default class ProfileBoundary extends React.Component<{ children: React.ReactNode; label?: string }, { error: Error | null }> {
    state: { error: Error | null } = { error: null };
    static getDerivedStateFromError(error: Error) { return { error }; }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
        void requireOptionalNativeModule('FioraConnection')?.recordError(`${this.props.label || '个人资料'}\n${error.stack || error.message}\n${info.componentStack || ''}`).catch(() => {});
    }
    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        return <View style={{ flex: 1, padding: 28, justifyContent: 'center', gap: 18, backgroundColor: '#f3f5fc' }}>
            <Text style={{ fontSize: 18, color: '#32405a' }}>{this.props.label || '个人资料'}页面暂时无法显示</Text>
            <Text style={{ color: '#667391' }}>可以返回继续聊天，或分享错误信息帮助定位问题。</Text>
            <TouchableOpacity onPress={() => Actions.chatlist()}><Text style={{ color: '#6377b4' }}>返回聊天</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { void Share.share({ message: `Fiora ${Application.nativeApplicationVersion} (${Application.nativeBuildVersion})\n${this.props.label || '个人资料'}页\n${error.name}: ${error.message}\n${error.stack || ''}` }).catch(() => {}); }}><Text style={{ color: '#6377b4' }}>分享错误信息</Text></TouchableOpacity>
        </View>;
    }
}
