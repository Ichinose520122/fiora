import { useAppTheme } from './utils/theme';
import CrashReport, { recordScreen } from './components/CrashReport';
import { MusicSessionProvider } from './modules/Music/MusicSession';
import React from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import { BackgroundConnection } from './components/BackgroundConnection';
import { View, Button } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
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
    const theme = useAppTheme();

    const loggedIn = useIsLogin();
    return <Tabs.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.navigation }, headerTintColor: theme.text, headerShadowVisible: false, headerTitleStyle: { fontSize: 17, fontWeight: '600' }, tabBarHideOnKeyboard: true, sceneStyle: { backgroundColor: theme.page }, tabBarActiveTintColor: theme.accent, tabBarInactiveTintColor: theme.muted, tabBarStyle: { backgroundColor: theme.navigation, borderTopColor: theme.color('#e8ecf6', 'borderTopColor'), elevation: 0 }, tabBarLabelStyle: { fontSize: 11 } }}>
        <Tabs.Screen name="chatlist" component={ChatList} options={{ title: '聊天', headerLeft: () => <SelfInfo />, headerRight: () => loggedIn ? <ChatListRightButton /> : <Button title="登录" color={theme.color('#6377b4')} onPress={() => Actions.login()} />, tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} /> }} />
        <Tabs.Screen name="other" component={Other} options={{ title: '我', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }} />
    </Tabs.Navigator>;
}
function screen(Component: any) { return ({ route }: any) => <Component {...route.params} />; }
const screens = { login: screen(Login), signup: screen(Signup), groupProfile: screen(GroupProfile), userInfo: screen(UserInfo), groupInfo: screen(GroupInfo), searchResult: screen(SearchResult) };
export default function App() {
    const theme = useAppTheme();

    return <SafeAreaProvider><KeyboardProvider statusBarTranslucent navigationBarTranslucent><View style={{ flex: 1, backgroundColor: theme.page }}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <MusicSessionProvider><NavigationContainer theme={{ ...DefaultTheme, dark: theme.dark, colors: { ...DefaultTheme.colors, primary: theme.accent, background: theme.page, card: theme.navigation, text: theme.text, border: theme.border, notification: theme.accent } }} ref={navigation} onReady={recordScreen} onStateChange={recordScreen}>
            <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: theme.page }, headerStyle: { backgroundColor: theme.navigation }, headerTintColor: theme.text, headerShadowVisible: false, headerTitleStyle: { fontSize: 17, fontWeight: '600' } }}>
                <Stack.Screen name="tabs" component={Home} options={{ headerShown: false }} />
                <Stack.Screen name="chat" component={Chat} options={({ route }: any) => ({ title: route.params?.title || '聊天', headerRight: () => <ChatRightButton /> })} />
                {Object.entries(screens).map(([name, Component]) => <Stack.Screen key={name} name={name} component={Component} options={{ title: ({ login: '登录', signup: '注册', groupProfile: '群组资料', userInfo: '个人信息', groupInfo: '群组信息', searchResult: '搜索结果' } as any)[name] }} />)}
            </Stack.Navigator>
        </NavigationContainer></MusicSessionProvider>
        <Loading /><CrashReport /><Notification /><BackgroundConnection />
    </View></KeyboardProvider></SafeAreaProvider>;
}
