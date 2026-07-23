import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import Style from './LoginAndRegister.less';
import Login from './Login';
import Register from './Register';
import Dialog from '../../components/Dialog';
import { State } from '../../state/reducer';
import useAction from '../../hooks/useAction';

function LoginAndRegister() {
    const action = useAction();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const loginRegisterDialogVisible = useSelector(
        (state: State) => state.status.loginRegisterDialogVisible,
    );

    return (
        <Dialog
            visible={loginRegisterDialogVisible}
            closable={false}
            onClose={() => action.toggleLoginRegisterDialog(false)}
        >
            <div className={Style.modeSwitch}>
                <button
                    className={`${Style.modeButton} ${
                        mode === 'login' ? Style.modeButtonActive : ''
                    }`}
                    type="button"
                    onClick={() => setMode('login')}
                >
                    登录
                </button>
                <button
                    className={`${Style.modeButton} ${
                        mode === 'register' ? Style.modeButtonActive : ''
                    }`}
                    type="button"
                    onClick={() => setMode('register')}
                >
                    邀请注册
                </button>
            </div>
            <div className={Style.login}>
                {mode === 'login' ? <Login /> : <Register />}
            </div>
        </Dialog>
    );
}

export default LoginAndRegister;
