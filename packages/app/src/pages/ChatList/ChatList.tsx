import { useAppTheme, useThemedStyles } from '../../utils/theme';
import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Header, Item, Icon, Input } from '../../components/NativeUI';
import { Actions } from '../../navigation';
import Linkman from './Linkman';
import { useLinkmans } from '../../hooks/useStore';
import { Linkman as LinkmanType } from '../../types/redux';
import PageContainer from '../../components/PageContainer';
import { search } from '../../service';
import { isiOS } from '../../utils/platform';

export default function ChatList() {
    const theme = useAppTheme(); const styles = useThemedStyles(baseStyles);

    const [searchKeywords, updateSearchKeywords] = useState('');
    const linkmans = useLinkmans();

    async function handleSearch() {
        const result = await search(searchKeywords);
        updateSearchKeywords('');
        if (result) Actions.push('searchResult', result);
    }

    function renderLinkman(linkman: LinkmanType) {
        const { _id: linkmanId, unread, messages, createTime } = linkman;
        const lastMessage =
            messages.length > 0 ? messages[messages.length - 1] : null;

        let time = new Date(createTime);
        let preview = '暂无消息';
        if (lastMessage) {
            time = new Date(lastMessage.createTime);
            preview =
                lastMessage.type === 'text'
                    ? `${lastMessage.content}`
                    : `[${lastMessage.type}]`;
            if (linkman.type === 'group') {
                preview = `${lastMessage.from.username}: ${preview}`;
            }
        }
        return (
            <Linkman
                key={linkmanId}
                id={linkmanId}
                name={linkman.name}
                avatar={linkman.avatar}
                preview={preview}
                time={time}
                unread={unread}
                linkman={linkman}
                lastMessageId={lastMessage ? lastMessage._id : ''}
            />
        );
    }

    return (
        <PageContainer>
            <Header searchBar rounded noShadow style={styles.searchContainer}>
                <Item style={styles.searchItem}>
                    <Icon name="ios-search" style={styles.searchIcon} />
                    <Input
                        style={styles.searchText}
                        placeholder="搜索群组/用户"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        value={searchKeywords}
                        onChangeText={updateSearchKeywords}
                        onSubmitEditing={handleSearch}
                    />
                </Item>
            </Header>
            <ScrollView style={styles.messageList} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                {linkmans && [...linkmans].sort((a, b) => new Date(b.messages[b.messages.length - 1]?.createTime || b.createTime).getTime() - new Date(a.messages[a.messages.length - 1]?.createTime || a.createTime).getTime()).map((linkman) => renderLinkman(linkman))}
            </ScrollView>
        </PageContainer>
    );
}

const baseStyles = StyleSheet.create({
    messageList: {},
    searchContainer: {
        marginTop: isiOS ? 0 : 5,
        backgroundColor: 'transparent',
        height: 62,
        borderBottomWidth: 0,
    },
    searchItem: {
        backgroundColor: '#ffffff9e', borderRadius: 15, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ffffffb0',
    },
    searchIcon: {
        color: '#9ba7bd',
    },
    searchText: {
        fontSize: 14,
    },
});
