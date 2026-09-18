/* eslint-disable react/jsx-props-no-spreading */
import { View } from '../../components/NativeUI';
import React from 'react';
import { useWindowDimensions, StyleSheet, TouchableOpacity } from 'react-native';
import Image from '../../components/Image';
import { Message } from '../../types/redux';



type Props = {
    message: Message;
    openImageViewer: (imageUrl: string) => void;
    couldDelete: boolean;
    onLongPress: () => void;
};

function ImageMessage({
    message,
    openImageViewer,
    couldDelete,
    onLongPress,
}: Props) {
    const { width: screenWidth } = useWindowDimensions();
    const maxWidth = Math.max(80, Math.min(350, screenWidth - 130));
    const maxHeight = 200;
    let scale = 1;
    let width = 160;
    let height = 120;
    const parseResult = /width=([0-9]+)&height=([0-9]+)/.exec(message.content);
    if (parseResult && +parseResult[1] > 0 && +parseResult[2] > 0) {
        width = parseInt(parseResult[1], 10);
        height = parseInt(parseResult[2], 10);
        if (width * scale > maxWidth) {
            scale = maxWidth / width;
        }
        if (height * scale > maxHeight) {
            scale = maxHeight / height;
        }
    }

    function handleImageClick() {
        const imageUrl = message.content;
        openImageViewer(imageUrl);
    }

    return (
        <View
            style={[
                styles.container,
                { width: width * scale, height: height * scale },
            ]}
        >
            <TouchableOpacity
                onPress={handleImageClick}
                {...({ onLongPress })}
            >
                <Image
                    src={message.content}
                    style={{ width: width * scale, height: height * scale }}
                />
            </TouchableOpacity>
        </View>
    );
}

export default ImageMessage;

const styles = StyleSheet.create({
    container: {
        height: 200,

        borderRadius: 9,
        overflow: 'hidden',
    },
});
