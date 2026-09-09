export interface MessageScroll {
    bottom: boolean;
    top: number;
    id: string | null;
    offset: number;
}

export function captureMessageScroll(list: HTMLElement): MessageScroll {
    const top = list.getBoundingClientRect().top;
    const anchor = Array.from(list.querySelectorAll<HTMLElement>('[data-message-id]'))
        .find((element) => element.getBoundingClientRect().bottom > top);
    return {
        bottom: list.scrollHeight - list.clientHeight - list.scrollTop <= 40,
        top: list.scrollTop,
        id: anchor ? anchor.getAttribute('data-message-id') : null,
        offset: anchor ? anchor.getBoundingClientRect().top - top : 0,
    };
}

export function restoreMessageScroll(list: HTMLElement, saved?: MessageScroll) {
    if (!saved || saved.bottom) {
        list.scrollTop = list.scrollHeight;
        return;
    }
    const anchor = Array.from(list.querySelectorAll<HTMLElement>('[data-message-id]'))
        .find((element) => element.getAttribute('data-message-id') === saved.id);
    if (anchor) {
        list.scrollTop += anchor.getBoundingClientRect().top -
            list.getBoundingClientRect().top - saved.offset;
    } else {
        list.scrollTop = saved.top;
    }
}
