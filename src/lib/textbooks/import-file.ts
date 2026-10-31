const HEADER_LABELS = ['单元编号', '单元名称', '模块名称', '页码', '单词或短语', '本课词义', '例句', '例句翻译', '图鉴ID', '使用图鉴插画', '备注', '已核对'];
export const TEXTBOOK_COLUMNS = ['unitCode', 'unitTitle', 'moduleTitle', 'pageReference', 'word', 'meaning', 'example', 'translation', 'atlasId', 'useAtlasImage', 'notes', 'verified'];
/** 解析CSV/TSV引号、换行及双引号转义；只处理文本，不执行公式或脚本。 */
export function parseTextbookFile(text: string, format: 'csv' | 'tsv' | 'json'): unknown[] {
    if (text.length > 2_000_000) throw new Error('FILE_TOO_LARGE');
    text = text.replace(/^\uFEFF/, '');
    if (format === 'json') {
        const parsed: unknown = JSON.parse(text);
        const rows = Array.isArray(parsed) ? parsed : typeof parsed === 'object' && parsed !== null && 'rows' in parsed ? parsed.rows : null;
        if (!Array.isArray(rows) || rows.length > 1000) throw new Error('INVALID_ROWS'); return rows;
    }
    const delimiter = format === 'tsv' ? '\t' : ',', rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false, closedQuote = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (closedQuote && ![delimiter, '\n', '\r'].includes(ch)) throw new Error('INVALID_QUOTES');
        if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else if (!quoted && cell) throw new Error('INVALID_QUOTES'); else { quoted = !quoted; if (!quoted) closedQuote = true; } }
        else if (!quoted && ch === delimiter) { row.push(cell); cell = ''; closedQuote = false; }
        else if (!quoted && (ch === '\n' || ch === '\r')) {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); if (row.some(c => c.trim())) rows.push(row); row = []; cell = ''; closedQuote = false;
            if (rows.length > 1001) throw new Error('TOO_MANY_ROWS');
        } else cell += ch;
    }
    if (quoted) throw new Error('UNFINISHED_QUOTES');
    row.push(cell); if (row.some(c => c.trim())) rows.push(row);
    if (rows.length > 1001) throw new Error('TOO_MANY_ROWS');
    const header = rows.shift()?.map(c => { const i = HEADER_LABELS.indexOf(c.trim()); return i >= 0 ? TEXTBOOK_COLUMNS[i] : c.trim(); });
    if (!header || new Set(header).size !== header.length || ['unitCode', 'unitTitle', 'word', 'meaning'].some(k => !header.includes(k)) || header.some(k => !TEXTBOOK_COLUMNS.includes(k))) throw new Error('INVALID_HEADER');
    return rows.map(values => {
        if (values.length !== header.length) throw new Error('INVALID_COLUMN_COUNT');
        return Object.fromEntries(header.map((name, i) => {
            const value = values[i].trim();
            if (['useAtlasImage', 'verified'].includes(name)) {
                if (!['', 'true', 'false', '1', '0', '是', '否'].includes(value.toLowerCase())) throw new Error('INVALID_BOOLEAN');
                return [name, ['true', '1', '是'].includes(value.toLowerCase())];
            }
            return [name, value];
        }));
    });
}
export function textbookTemplate() {
    return '\uFEFF' + HEADER_LABELS.join(',') + '\r\nU1,Hello!,Module 1,pp.3-9,hello,你好,,,,false,示例请按课本核对,false\r\n';
}
