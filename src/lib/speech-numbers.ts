/** 明确的中文数值读法，避免语音模型将算式中的阿拉伯数字与运算词合并省读。 */
export function chineseNumber(value: string): string {
    const digits = '零一二三四五六七八九';
    const [whole, decimal] = value.split('.');
    if (whole.length > 12 || (whole.length > 1 && whole[0] === '0')) return [...value].map(c => c === '.' ? '点' : digits[Number(c)]).join('');
    const small = (n: number): string => {
        if (!n) return '';
        let text = '', zero = false;
        for (let place = 3; place >= 0; place--) {
            const d = Math.floor(n / 10 ** place) % 10;
            if (d) { if (zero) text += '零'; text += digits[d] + ['', '十', '百', '千'][place]; zero = false; }
            else if (text && n % 10 ** place) zero = true;
        }
        return text;
    };
    let n = Number(whole), result = '';
    for (const [size, unit] of [[100000000, '亿'], [10000, '万'], [1, '']] as const) {
        const group = Math.floor(n / size); n %= size;
        if (group) { if (result && group < 1000) result += '零'; result += small(group) + unit; }
    }
    result = (result || '零').replace(/^一十/, '十');
    return result + (decimal ? '点' + [...decimal].map(c => digits[Number(c)]).join('') : '');
}
