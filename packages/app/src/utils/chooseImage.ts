import * as ImagePicker from 'expo-image-picker';
import uploadFile from './uploadFile';
export async function chooseImage(prefix: 'Avatar' | 'GroupAvatar' | 'BackgroundImage', userId: string) {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: prefix !== 'BackgroundImage', aspect: [1, 1], quality: 0.85, base64: true });
    if (result.canceled) return null;
    const image = result.assets[0];
    if (!image.base64) throw new Error('图片读取失败');
    if (image.base64.length * 0.75 > (prefix === 'BackgroundImage' ? 5 : 1.5) * 1024 * 1024) throw new Error(prefix === 'BackgroundImage' ? '请选择小于 5 MB 的背景图' : '请选择小于 1.5 MB 的头像');
    return uploadFile(image.base64, `${prefix}/${userId}_${Date.now()}`, true);
}
