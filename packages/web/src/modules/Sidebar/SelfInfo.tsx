import AvatarDecorationPicker from './AvatarDecorationPicker';
import React, { useState, useRef } from 'react';
import ReactLoading from 'react-loading';
import Cropper from 'react-cropper';
import CropperJS from 'cropperjs';
import 'cropperjs/dist/cropper.css';

import { useSelector } from 'react-redux';
import config from '@fiora/config/client';
import readDiskFile from '../../utils/readDiskFile';
import uploadFile, { getOSSFileUrl } from '../../utils/uploadFile';
import Dialog from '../../components/Dialog';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { State } from '../../state/reducer';
import Message from '../../components/Message';
import { changeAvatar, changePassword, changeUsername } from '../../service';
import useAction from '../../hooks/useAction';
import socket from '../../socket';

import Style from './SelfInfo.less';
import Common from './Common.less';

interface SelfInfoProps {
    visible: boolean;
    onClose: () => void;
}

function SelfInfo(props: SelfInfoProps) {
    const { visible, onClose } = props;

    const action = useAction();
    const userId = useSelector((state: State) => state.user?._id);
    const avatar = useSelector((state: State) => state.user?.avatar);
    const primaryColor = useSelector(
        (state: State) => state.status.primaryColor,
    );
    const [loading, toggleLoading] = useState(false);
    const [cropper, setCropper] = useState({
        enable: false,
        src: '',
        ext: '',
    });
    const $cropper = useRef<CropperJS | null>(null);
    const [cropReady, setCropReady] = useState(false);
    const [zoom, setZoom] = useState(1);
    const initializingCrop = useRef(false);

    function resetCrop() {
        const editor = $cropper.current;
        if (!editor) return;
        initializingCrop.current = true;
        const container = editor.getContainerData();
        const image = editor.getImageData();
        const side = Math.min(container.width, container.height) * 0.8;
        const ratio = side / Math.min(image.naturalWidth, image.naturalHeight);
        // First cover the stage so the old crop box cannot constrain the new one.
        editor.zoomTo(Math.max(container.width / image.naturalWidth, container.height / image.naturalHeight));
        editor.setCropBoxData({
            left: (container.width - side) / 2,
            top: (container.height - side) / 2,
            width: side,
            height: side,
        });
        editor.zoomTo(ratio);
        editor.setCanvasData({
            left: (container.width - image.naturalWidth * ratio) / 2,
            top: (container.height - image.naturalHeight * ratio) / 2,
        });
        initializingCrop.current = false;
        setZoom(1);
        setCropReady(true);
    }

    function handleCropZoom(event: CustomEvent) {
        const editor = $cropper.current;
        if (!editor || initializingCrop.current) return;
        const minimum = editor.getCropBoxData().width / Math.min(
            editor.getImageData().naturalWidth, editor.getImageData().naturalHeight,
        );
        const scale = event.detail.ratio / minimum;
        if (scale < 1 - 0.0001 || scale > 4 + 0.0001) {
            event.preventDefault();
            return;
        }
        setZoom(Math.max(1, Math.min(4, scale)));
    }

    function changeCropZoom(scale: number) {
        const editor = $cropper.current;
        if (!editor) return;
        const image = editor.getImageData();
        editor.zoomTo(scale * editor.getCropBoxData().width / Math.min(image.naturalWidth, image.naturalHeight));
    }

    async function uploadAvatar(blob: Blob, ext = 'png') {
        if (blob.size > config.maxAvatarSize) {
            Message.error(`上传头像失败，请选择小于 ${config.maxAvatarSize / 1024 / 1024} MB 的图片`);
            return;
        }
        toggleLoading(true);

        try {
            const avatarUrl = await uploadFile(
                blob,
                `Avatar/${userId}_${Date.now()}.${ext}`,
            );
            const isSuccess = await changeAvatar(avatarUrl);
            if (isSuccess) {
                action.setAvatar(avatarUrl);
                Message.success('修改头像成功');
            }
        } catch (err) {
            console.error(err);
            Message.error(err instanceof Error ? `上传头像失败：${err.message}` : '上传头像失败，请重试');
        } finally {
            toggleLoading(false);
            setCropper({ enable: false, src: '', ext: '' });
        }
    }

    async function selectAvatar() {
        const file = await readDiskFile(
            'blob',
            'image/png,image/jpeg,image/gif',
        );
        if (!file) {
            return;
        }
        if (file.length > config.maxAvatarSize) {
            // eslint-disable-next-line consistent-return
            return Message.error(`设置头像失败，请选择小于 ${config.maxAvatarSize / 1024 / 1024} MB 的图片`);
        }

        // gif头像不需要裁剪
        if (file.ext === 'gif') {
            uploadAvatar(file.result as Blob, file.ext);
        } else {
            // 显示头像裁剪
            const reader = new FileReader();
            reader.readAsDataURL(file.result as Blob);
            reader.onloadend = () => {
                setCropReady(false);
                setCropper({
                    enable: true,
                    src: reader.result as string,
                    ext: file.ext,
                });
            };
        }
    }

    function handleChangeAvatar() {
        try {
            // Canvas exports PNG regardless of the selected file's original extension.
            // Bound the output so a compressed photo cannot expand into a huge PNG.
            const canvas = $cropper.current?.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 });
            if (!canvas) throw new Error('头像尚未加载完成，请稍后重试');
            canvas.toBlob((blob: Blob | null) => {
                if (!blob) {
                    Message.error('头像裁剪失败，请重新选择图片');
                    return;
                }
                void uploadAvatar(blob, 'png');
            }, 'image/png');
        } catch (err) {
            Message.error(err instanceof Error ? err.message : '头像裁剪失败，请重新选择图片');
        }
    }

    function reLogin(message: string) {
        action.logout();
        window.localStorage.removeItem('token');
        Message.success(message);
        socket.disconnect();
        socket.connect();
    }

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    async function handleChangePassword() {
        const isSuccess = await changePassword(oldPassword, newPassword);
        if (isSuccess) {
            onClose();
            reLogin('修改密码成功, 请使用新密码重新登录');
        }
    }

    const [username, setUsername] = useState('');

    /**
     * 修改用户名
     */
    async function handleChangeUsername() {
        const isSuccess = await changeUsername(username);
        if (isSuccess) {
            onClose();
            reLogin('修改用户名成功, 请使用新用户名重新登录');
        }
    }

    function handleCloseDialog(event: any) {
        /**
         * 点击关闭按钮, 或者在非图片裁剪时点击蒙层, 才能关闭弹窗
         */
        if (event.target.className === 'rc-dialog-close-x' || !cropper.enable) {
            onClose();
        }
    }

    return (
        <Dialog
            className={Style.selfInfo}
            visible={visible}
            title="个人信息设置"
            onClose={handleCloseDialog}
        >
            <div className={Common.container}><AvatarDecorationPicker />
                <div className={Common.block}>
                    <p className={Common.title}>修改头像</p>
                    <div className={Style.changeAvatar}>
                        {cropper.enable ? (
                            <div className={Style.cropper}>
                                <Cropper
                                    key={cropper.src}
                                    className={loading ? 'blur' : ''}
                                    // @ts-ignore
                                    ref={$cropper}
                                    src={cropper.src}
                                    style={{
                                        width: '100%',
                                        height: 280,
                                    }}
                                    aspectRatio={1}
                                    viewMode={1}
                                    dragMode="move"
                                    cropBoxMovable={false}
                                    cropBoxResizable={false}
                                    toggleDragModeOnDblclick={false}
                                    guides={false}
                                    center={false}
                                    movable
                                    zoomable
                                    zoomOnTouch
                                    zoomOnWheel
                                    enable={!loading}
                                    ready={resetCrop}
                                    zoom={handleCropZoom}
                                />
                                <p className={Style.cropHint}>上下左右拖动图片，调整缩放选取头像范围</p>
                                <label className={Style.zoomControl}>
                                    <span>缩放</span>
                                    <input
                                        type="range"
                                        min={1}
                                        max={4}
                                        step={0.01}
                                        value={zoom}
                                        disabled={!cropReady || loading}
                                        aria-label="头像缩放"
                                        onChange={(event) => changeCropZoom(Number(event.target.value))}
                                    />
                                    <output>{Math.round(zoom * 100)}%</output>
                                </label>
                                <div className={Style.cropActions}>
                                    <Button
                                        className={Style.button}
                                        onClick={() => { if (cropReady && !loading) handleChangeAvatar(); }}
                                    >
                                        修改头像
                                    </Button>
                                    <button type="button" disabled={!cropReady || loading} onClick={resetCrop}>重置</button>
                                    <button type="button" disabled={loading} onClick={() => setCropper({ enable: false, src: '', ext: '' })}>取消</button>
                                </div>
                                <ReactLoading
                                    className={`${Style.loading} ${
                                        loading ? 'show' : 'hide'
                                    }`}
                                    type="spinningBubbles"
                                    color={`rgb(${primaryColor}`}
                                    height={120}
                                    width={120}
                                />
                            </div>
                        ) : (
                            <div className={Style.preview}>
                                <img
                                    className={loading ? 'blur' : ''}
                                    alt="头像预览"
                                    src={getOSSFileUrl(avatar as string)}
                                    onClick={selectAvatar}
                                />
                                <ReactLoading
                                    className={`${Style.loading} ${
                                        loading ? 'show' : 'hide'
                                    }`}
                                    type="spinningBubbles"
                                    color={`rgb(${primaryColor}`}
                                    height={80}
                                    width={80}
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>修改密码</p>
                    <div>
                        <Input
                            className={Style.input}
                            value={oldPassword}
                            onChange={setOldPassword}
                            type="password"
                            placeholder="旧密码"
                        />
                        <Input
                            className={Style.input}
                            value={newPassword}
                            onChange={setNewPassword}
                            type="password"
                            placeholder="新密码"
                        />
                        <Button
                            className={Style.button}
                            onClick={handleChangePassword}
                        >
                            确认修改
                        </Button>
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>修改用户名</p>
                    <div>
                        <Input
                            className={Style.input}
                            value={username}
                            onChange={setUsername}
                            type="text"
                            placeholder="用户名"
                        />
                        <Button
                            className={Style.button}
                            onClick={handleChangeUsername}
                        >
                            确认修改
                        </Button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export default SelfInfo;
