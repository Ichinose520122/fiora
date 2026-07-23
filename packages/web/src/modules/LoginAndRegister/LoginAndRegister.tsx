import React from 'react';
import { useSelector } from 'react-redux';

import Style from './LoginAndRegister.less';
import Login from './Login';
import Dialog from '../../components/Dialog';
import { State } from '../../state/reducer';
import useAction from '../../hooks/useAction';

function LoginAndRegister() {
    const action = useAction();
    const loginRegisterDialogVisible = useSelector(
        (state: State) => state.status.loginRegisterDialogVisible,
    );

    return (
        <Dialog
            visible={loginRegisterDialogVisible}
            closable={false}
            onClose={() => action.toggleLoginRegisterDialog(false)}
        >
            <div className={Style.login}>
                <Login />
            </div>
        </Dialog>
    );
}

export default LoginAndRegister;
