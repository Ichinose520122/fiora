import React, { useState, useCallback, useRef, MouseEvent } from 'react';
import loadable from '@loadable/component';

import { getOSSFileUrl } from '../../../utils/uploadFile';
import Style from './Message.less';
import { CircleProgress } from '../../../components/Progress';
import Message from '../../../components/Message';
import { addExpression } from '../../../service';
import store from '../../../state/store';
import { ActionTypes } from '../../../state/action';

const ReactViewerAsync = loadable(
    async () =>
        // @ts-ignore 
        import(/* webpackChunkName: "react-viewer" */ 'react-viewer'),
);

interface ImageMessageProps {
    src: string;
    loading: boolean;
    percent: number;
    messageId: string;
    isSelf: boolean;
}

function ImageMessage(props: ImageMessageProps) {
    const { src, loading, percent, messageId, isSelf } = props;

    const [viewer, toggleViewer] = useState(false);
    const [saved, setSaved] = useState(false);
    const closeViewer = useCallback(() => toggleViewer(false), []);
    const $container = useRef(null);

    const [loadedSize, setLoadedSize] = useState({ src: '', width: 200, height: 200 });
    let imageSrc = src;
    // CSS constrains this preferred thumbnail to the actual message column.
    const maxWidth = 350;
    const maxHeight = 200;
    let width = loadedSize.src === src ? loadedSize.width : 200;
    let height = loadedSize.src === src ? loadedSize.height : 200;
    const parseResult = /width=([0-9]+)&height=([0-9]+)/.exec(imageSrc);
    if (parseResult && +parseResult[1] > 0 && +parseResult[2] > 0) {
        const natureWidth = +parseResult[1];
        const naturehHeight = +parseResult[2];
        let scale = 1;
        if (natureWidth * scale > maxWidth) {
            scale = maxWidth / natureWidth;
        }
        if (naturehHeight * scale > maxHeight) {
            scale = maxHeight / naturehHeight;
        }
        width = natureWidth * scale;
        height = naturehHeight * scale;
        imageSrc = /^(blob|data):/.test(imageSrc)
            ? imageSrc.split('?')[0]
            : getOSSFileUrl(
                src,
                `image/resize,w_${Math.floor(width)},h_${Math.floor(
                    height,
                )}/quality,q_90`,
            );
    }

    let className = Style.imageMessage;
    if (loading) {
        className += ` ${Style.iamgeLoading}`;
    }
    if (/huaji=true/.test(imageSrc)) {
        className += ` ${Style.huaji}`;
    }

    function handleImageViewerMaskClick(e: MouseEvent) {
        // @ts-ignore
        if (e.target?.tagName !== 'IMG') {
            closeViewer();
        }
    }

    async function handleAddExpression(e: MouseEvent<HTMLButtonElement>) {
        e.stopPropagation();
        const expressions = await addExpression(messageId);
        if (expressions) {
            store.dispatch({
                type: ActionTypes.UpdateUserInfo,
                payload: { expressions },
            });
            setSaved(true);
            Message.success('已添加到我的表情');
        }
    }

    return (
        <>
            <div className={className} ref={$container}>
                <img
                    className={Style.image}
                    src={imageSrc}
                    alt="消息图片"
                    width={width}
                    height={height}
                    onLoad={(event) => {
                        if (parseResult && +parseResult[1] > 0 && +parseResult[2] > 0) return;
                        const image = event.currentTarget;
                        if (!image.naturalWidth || !image.naturalHeight) return;
                        const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
                        setLoadedSize({ src, width: image.naturalWidth * scale, height: image.naturalHeight * scale });
                    }}
                    onClick={() => toggleViewer(true)}
                />
                {isSelf && !loading && (
                    <button
                        type="button"
                        className={Style.saveExpressionButton}
                        onClick={handleAddExpression}
                        disabled={saved}
                    >
                        {saved ? '已收藏' : '收藏表情'}
                    </button>
                )}
                <CircleProgress
                    className={Style.imageProgress}
                    percent={percent}
                    strokeWidth={5}
                    strokeColor="#a0c672"
                    trailWidth={5}
                />
                <div
                    className={`${Style.imageProgress} ${Style.imageProgressNumber}`}
                >
                    {Math.ceil(percent)}%
                </div>
                {viewer && (
                    <ReactViewerAsync
                        // eslint-disable-next-line react/destructuring-assignment
                        visible={viewer}
                        onClose={closeViewer}
                        onMaskClick={handleImageViewerMaskClick}
                        images={[
                            {
                                src: getOSSFileUrl(src, `image/quality,q_95`),
                                alt: '',
                            },
                        ]}
                        noNavbar
                    />
                )}
            </div>
        </>
    );
}

export default React.memo(ImageMessage);
