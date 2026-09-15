import React from 'react';
import { View, Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { navigation, Actions } from './navigation';
import { useIsLogin } from './hooks/useStore';
import ChatList from './pages/ChatList/ChatList';
import Chat from './pages/Chat/Chat';
import Login from './pages/LoginSignup/Login';
import Signup from './pages/LoginSignup/Signup';
import Other from './pages/Other/Other';
import GroupProfile from './pages/GroupProfile/GroupProfile';
import UserInfo from './pages/UserInfo/UserInfo';
import GroupInfo from './pages/GroupInfo/GroupInfo';
import SearchResult from './pages/SearchResult/SearchResult';
import SelfInfo from './pages/ChatList/SelfInfo';
import ChatListRightButton from './pages/ChatList/ChatListRightButton';
import ChatRightButton from './pages/Chat/ChatRightButton';
import Loading from './components/Loading';
import Notification from './components/Nofitication';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
function Home() {
    const loggedIn = useIsLogin();
    return <Tabs.Navigator screenOptions={{ headerStyle: { backgroundColor: '#f3f5fc' }, headerTintColor: '#52658e', headerShadowVisible: false, headerTitleStyle: { fontSize: 17, fontWeight: '600' }, tabBarActiveTintColor: '#6377b4', tabBarInactiveTintColor: '#a0aac0', tabBarStyle: { backgroundColor: '#f8f9fe', borderTopColor: '#e8ecf6', elevation: 0 }, tabBarLabelStyle: { fontSize: 11 } }}>
        <Tabs.Screen name="chatlist" component={ChatList} options={{ title: '聊天', headerLeft: () => <SelfInfo />, headerRight: () => loggedIn ? <ChatListRightButton /> : <Button title="登录" color="#6377b4" onPress={() => Actions.login()} />, tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} /> }} />
        <Tabs.Screen name="other" component={Other} options={{ title: '我', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }} />
    </Tabs.Navigator>;
}
function screen(Component: any) { return ({ route }: any) => <Component {...route.params} />; }
const screens = { login: screen(Login), signup: screen(Signup), groupProfile: screen(GroupProfile), userInfo: screen(UserInfo), groupInfo: screen(GroupInfo), searchResult: screen(SearchResult) };
export default function App() {
    return <SafeAreaProvider><View style={{ flex: 1 }}>
        <NavigationContainer ref={navigation}>
            <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#f3f5fc' }, headerTintColor: '#52658e', headerShadowVisible: false, headerTitleStyle: { fontSize: 17, fontWeight: '600' } }}>
                <Stack.Screen name="tabs" component={Home} options={{ headerShown: false }} />
                <Stack.Screen name="chat" component={Chat} options={({ route }: any) => ({ title: route.params?.title || '聊天', headerRight: () => <ChatRightButton /> })} />
                {Object.entries(screens).map(([name, Component]) => <Stack.Screen key={name} name={name} component={Component} options={{ title: ({ login: '登录', signup: '注册', groupProfile: '群组资料', userInfo: '个人信息', groupInfo: '群组信息', searchResult: '搜索结果' } as any)[name] }} />)}
            </Stack.Navigator>
        </NavigationContainer>
        <Loading /><Notification />
    </View></SafeAreaProvider>;
}
