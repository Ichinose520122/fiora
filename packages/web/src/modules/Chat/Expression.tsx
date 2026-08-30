import React, { MouseEvent, useEffect, useState } from 'react';
import Loading from 'react-loading';
import { useSelector } from 'react-redux';

import expressions from '@fiora/utils/expressions';
import emojiCategories from '@fiora/utils/emoji';
import { addParam } from '@fiora/utils/url';
import BaiduImage from '@fiora/assets/images/baidu.png';
import config from '@fiora/config/client';
import Style from './Expression.less';
import {
    Tabs,
    TabPane,
    TabContent,
    ScrollableInkTabBar,
} from '../../components/Tabs';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { removeExpression, searchExpression } from '../../service';
import Message from '../../components/Message';
import { State } from '../../state/reducer';
import store from '../../state/store';
import { ActionTypes } from '../../state/action';

interface ExpressionProps {
    onSelectText: (expression: string) => void;
    onSelectEmoji: (emoji: string) => void;
    onSelectImage: (expression: string) => void;
}

interface ExpressionImage {
    image: string;
    width: number;
    height: number;
}

interface QFaceAsset {
    type: number;
    path: string;
}

interface QFaceRecord {
    emojiId: string;
    describe: string;
    isHide: boolean;
    assets: QFaceAsset[];
}

interface QFaceExpression {
    id: string;
    name: string;
    preview: string;
    image: string;
}

let cachedQFaceExpressions: QFaceExpression[] | null = null;

function resolveQFaceAsset(path: string) {
    const assetBaseUrl = new URL(
        config.qqExpression.assetBaseUrl,
        window.location.origin,
    );
    return new URL(path, assetBaseUrl).toString();
}

function isUnicodeEmojiId(id: string) {
    const firstCodePoint = id.codePointAt(0) || 0;
    return firstCodePoint > 0x2000 && id.length <= 12;
}

function parseQFaceManifest(records: QFaceRecord[]) {
    return records
        .filter(
            (record) =>
                !record.isHide &&
                !isUnicodeEmojiId(record.emojiId) &&
                Array.isArray(record.assets) &&
                record.assets.length > 0,
        )
        .map((record) => {
            const png = record.assets.find((asset) => asset.type === 0);
            const apng = record.assets.find((asset) => asset.type === 2);
            const preview = png || apng;
            const source = apng || png;
            if (!preview || !source) {
                return null;
            }
            return {
                id: `qface:${record.emojiId}`,
                name: record.describe.replace(/^\//, ''),
                preview: resolveQFaceAsset(preview.path),
                image: resolveQFaceAsset(source.path),
            };
        })
        .filter(Boolean)
        .slice(0, config.qqExpression.maxItems) as QFaceExpression[];
}

function Expression(props: ExpressionProps) {
    const { onSelectText, onSelectEmoji, onSelectImage } = props;
    const favoriteExpressions = useSelector(
        (state: State) => state.user?.expressions || [],
    );

    const [keywords, setKeywords] = useState('');
    const [searchLoading, toggleSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<ExpressionImage[]>([]);
    const [emojiCategory, setEmojiCategory] = useState(
        emojiCategories[0].key,
    );
    const [qfaceLoading, setQFaceLoading] = useState(
        cachedQFaceExpressions === null,
    );
    const [qfaceError, setQFaceError] = useState('');
    const [qfaceExpressions, setQFaceExpressions] = useState<
        QFaceExpression[]
    >(cachedQFaceExpressions || []);

    useEffect(() => {
        if (cachedQFaceExpressions) {
            return undefined;
        }
        let canceled = false;
        window
            .fetch(config.qqExpression.manifestUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then((records: QFaceRecord[]) => {
                if (!canceled) {
                    const parsedExpressions = parseQFaceManifest(records);
                    cachedQFaceExpressions = parsedExpressions;
                    setQFaceExpressions(parsedExpressions);
                    setQFaceLoading(false);
                }
            })
            .catch(() => {
                if (!canceled) {
                    setQFaceError(
                        'QQ 表情缓存尚未准备好，请稍后重试',
                    );
                    setQFaceLoading(false);
                }
            });
        return () => {
            canceled = true;
        };
    }, []);

    async function handleSearchExpression() {
        if (keywords.trim()) {
            toggleSearchLoading(true);
            setSearchResults([]);
            const result = await searchExpression(keywords.trim());
            if (result) {
                if (result.length !== 0) {
                    setSearchResults(result);
                } else {
                    Message.info('没有相关表情, 换个关键字试试吧');
                }
            }
            toggleSearchLoading(false);
        }
    }

    function selectImage(image: string, width: number, height: number) {
        onSelectImage(
            addParam(image, {
                width: String(width || 120),
                height: String(height || 120),
            }),
        );
    }

    function handleClickImage(
        image: string,
        event: MouseEvent<HTMLImageElement>,
    ) {
        selectImage(
            image,
            event.currentTarget.naturalWidth,
            event.currentTarget.naturalHeight,
        );
    }

    async function handleRemoveFavorite(expression: string) {
        const nextExpressions = await removeExpression(expression);
        if (nextExpressions) {
            store.dispatch({
                type: ActionTypes.UpdateUserInfo,
                payload: { expressions: nextExpressions },
            });
        }
    }

    const selectedEmojiCategory =
        emojiCategories.find((category) => category.key === emojiCategory) ||
        emojiCategories[0];

    return (
        <div className={Style.expression}>
            <Tabs
                defaultActiveKey="default"
                renderTabBar={() => <ScrollableInkTabBar />}
                renderTabContent={() => <TabContent />}
            >
                <TabPane tab="默认表情" key="default">
                    <div className={Style.panelScroll}>
                        {favoriteExpressions.length > 0 && (
                            <section className={Style.favoriteSection}>
                                <p className={Style.sectionTitle}>我的表情</p>
                                <div className={Style.imageGrid}>
                                    {favoriteExpressions.map((expression) => (
                                        <div
                                            className={Style.imageGridItem}
                                            key={expression}
                                        >
                                            <img
                                                src={expression}
                                                alt="收藏表情"
                                                onClick={() =>
                                                    onSelectImage(expression)
                                                }
                                            />
                                            <button
                                                type="button"
                                                className={Style.removeFavorite}
                                                onClick={() =>
                                                    handleRemoveFavorite(
                                                        expression,
                                                    )
                                                }
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                        <div className={Style.defaultExpression}>
                            {expressions.default.map((expression, index) => (
                                <div
                                    className={Style.defaultExpressionBlock}
                                    key={expression}
                                    onClick={() => onSelectText(expression)}
                                    role="button"
                                >
                                    <div
                                        className={Style.defaultExpressionItem}
                                        style={{
                                            backgroundPosition: `left ${
                                                -30 * index
                                            }px`,
                                            backgroundImage: `url(${BaiduImage})`,
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </TabPane>
                <TabPane tab="Emoji" key="emoji">
                    <div className={Style.emojiPanel}>
                        <div className={Style.emojiCategories}>
                            {emojiCategories.map((category) => (
                                <button
                                    type="button"
                                    key={category.key}
                                    className={`${Style.emojiCategoryButton} ${
                                        category.key === emojiCategory
                                            ? Style.activeCategory
                                            : ''
                                    }`}
                                    onClick={() =>
                                        setEmojiCategory(category.key)
                                    }
                                >
                                    {category.name}
                                </button>
                            ))}
                        </div>
                        <div className={Style.emojiGrid}>
                            {selectedEmojiCategory.emojis.map((emoji) => (
                                <button
                                    type="button"
                                    className={Style.emojiItem}
                                    key={emoji}
                                    onClick={() => onSelectEmoji(emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                </TabPane>
                <TabPane tab="QQ 表情" key="qq">
                    <div className={Style.qqPanel}>
                        {qfaceLoading && (
                            <div className={Style.centerMessage}>
                                正在加载 QQ 表情…
                            </div>
                        )}
                        {qfaceError && (
                            <div className={Style.centerMessage}>
                                {qfaceError}
                            </div>
                        )}
                        {!qfaceLoading && !qfaceError && (
                            <div className={Style.imageGrid}>
                                {qfaceExpressions.map((expression) => (
                                    <button
                                        type="button"
                                        className={Style.qfaceItem}
                                        key={expression.id}
                                        title={expression.name}
                                        onClick={(event) => {
                                            const image = event.currentTarget.querySelector(
                                                'img',
                                            ) as HTMLImageElement;
                                            selectImage(
                                                expression.image,
                                                image.naturalWidth,
                                                image.naturalHeight,
                                            );
                                        }}
                                    >
                                        <img
                                            src={expression.preview}
                                            alt={expression.name}
                                            loading="lazy"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                        <p className={Style.copyrightNotice}>
                            QQ 表情资源版权归腾讯所有，仅供非商业学习交流。
                        </p>
                    </div>
                </TabPane>
                <TabPane tab="在线搜索" key="search">
                    <div className={Style.searchExpression}>
                        <div className={Style.searchExpressionInputBlock}>
                            <Input
                                className={Style.searchExpressionInput}
                                value={keywords}
                                onChange={setKeywords}
                                onEnter={handleSearchExpression}
                                placeholder="搜索在线表情包"
                            />
                            <Button
                                className={Style.searchExpressionButton}
                                onClick={handleSearchExpression}
                            >
                                搜索
                            </Button>
                        </div>
                        <div
                            className={`${Style.loading} ${
                                searchLoading ? 'show' : 'hide'
                            }`}
                        >
                            <Loading
                                type="spinningBubbles"
                                color="#4A90E2"
                                height={100}
                                width={100}
                            />
                        </div>
                        <div className={Style.searchResult}>
                            {searchResults.map(({ image }) => (
                                <div className={Style.searchImage} key={image}>
                                    <img
                                        src={image}
                                        alt="表情"
                                        onClick={(event) =>
                                            handleClickImage(image, event)
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </TabPane>
            </Tabs>
        </div>
    );
}

export default Expression;
