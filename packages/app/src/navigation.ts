import { CommonActions, createNavigationContainerRef, StackActions } from '@react-navigation/native';
export const navigation = createNavigationContainerRef<any>();
const go = (name: string, params?: any) => {
    if (!navigation.isReady()) return;
    if (name === 'chatlist' || name === '_chatlist' || name === 'other') {
        navigation.navigate('tabs', { screen: name === 'other' ? 'other' : 'chatlist' });
    } else navigation.navigate(name, params);
};
export const Actions: any = {
    get currentScene() { return navigation.isReady() ? navigation.getCurrentRoute()?.name : ''; },
    push: go,
    pop: () => navigation.canGoBack() && navigation.goBack(),
    replace: (name: string, params?: any) => navigation.dispatch(StackActions.replace(name, params)),
    refresh: (params: any) => navigation.setParams(params),
    popTo: (name: string) => {
        const state = navigation.getRootState();
        const target = name === '_chatlist' || name === 'chatlist' ? 'tabs' : name;
        const index = state?.routes.findIndex((route) => route.name === target) ?? -1;
        if (state && index >= 0) navigation.dispatch(CommonActions.reset({ ...state, index, routes: state.routes.slice(0, index + 1) }));
        else go(name);
    },
};
['chat', 'login', 'signup', 'chatlist', 'other', 'userInfo', 'groupInfo', 'groupProfile', 'searchResult'].forEach((name) => {
    Actions[name] = (params?: any) => go(name, params);
});
