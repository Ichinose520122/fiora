/**
 * set global css variable
 * @param color primary color, three numbers split with comma, like 255,255,255
 * @param textColor text colore, format like color
 */
export default function setCssVariable(color: string, textColor: string) {
    const style = document.documentElement.style;
    for (let i = 0; i <= 10; i++) {
        style.setProperty('--primary-color-' + i, 'rgba(' + color + ', ' + i / 10 + ')');
        style.setProperty('--primary-color-' + i + '_5', 'rgba(' + color + ', ' + (i + 0.5) / 10 + ')');
        style.setProperty('--primary-text-color-' + i, 'rgba(' + textColor + ', ' + i / 10 + ')');
    }
    for (const [key, variable, fallback] of [
        ['selfBubbleColor', '--self-bubble-color', '--primary-color-10'],
        ['selfBubbleTextColor', '--self-bubble-text-color', '--primary-text-color-10'],
    ]) {
        const value = window.localStorage.getItem(key) || '';
        const channels = value.split(',').map((part) => Number(part.trim()));
        const valid = channels.length === 3 && channels.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255);
        style.setProperty(variable, valid ? 'rgb(' + channels.join(',') + ')' : 'var(' + fallback + ')');
    }
}
