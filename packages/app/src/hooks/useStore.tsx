import { useAppTheme } from '../utils/theme';
import { useSelector } from 'react-redux';
import { State, User } from '../types/redux';

export function useStore() {
    return useSelector((state: State) => state);
}

export function useUser() {
    return useStore().user as User;
}

export function useSelfId() {
    const user = useUser();
    return (user && user._id) || '';
}

export function useIsLogin() {
    return !!useSelfId();
}

export function useIsAdmin() {
    const user = useUser();
    return (user && user.isAdmin) || false;
}

export function useTheme() {
    const theme = useAppTheme();
    return { primaryColor8: theme.accent + 'cc', primaryColor10: theme.accent, primaryTextColor10: theme.onAccent };
}

export function useLinkmans() {
    const data = useStore();
    return data.linkmans || [];
}

export function useFocusLinkman() {
    const data = useStore();
    const { linkmans, focus = '' } = data;
    if (linkmans) {
        return linkmans.find((linkman) => linkman._id === focus);
    }
    return null;
}

export function useFocus() {
    const data = useStore();
    return data.focus || '';
}
