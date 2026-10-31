import { describe, expect, it } from 'vitest';
import { parseTextbookFile, textbookTemplate } from '@/lib/textbooks/import-file';
describe('教材批量导入文本', () => {
    it('中文模板可直接解析，布尔值正确转换', () => {
        const rows = parseTextbookFile(textbookTemplate(), 'csv');
        expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ unitCode: 'U1', word: 'hello', meaning: '你好', useAtlasImage: false, verified: false });
    });
    it('保留引号内逗号、换行与双引号，支持Excel换行格式', () => {
        const rows = parseTextbookFile('unitCode,unitTitle,word,meaning,example\r\nU1,Hello,hello,你好,"Hello, ""Sam""!\nGood day."\r\n', 'csv');
        expect(rows[0]).toMatchObject({ example: 'Hello, "Sam"!\nGood day.' });
    });
    it('支持TSV和JSON，不接受重复列或不完整引号', () => {
        expect(parseTextbookFile('unitCode\tunitTitle\tword\tmeaning\nU1\tHello\thi\t你好', 'tsv')).toHaveLength(1);
        expect(parseTextbookFile('{"rows":[{"word":"hi"}]}', 'json')).toEqual([{ word: 'hi' }]);
        expect(() => parseTextbookFile('unitCode,unitTitle,word,meaning,word\nU1,X,hi,你好,hi', 'csv')).toThrow();
        expect(() => parseTextbookFile('unitCode,unitTitle,word,meaning\nU1,X,"hi,你好', 'csv')).toThrow();
    });
    it('不把真假字符串误当true，拒绝过大文件', () => {
        expect(() => parseTextbookFile('unitCode,unitTitle,word,meaning,verified\nU1,X,hi,你好,maybe', 'csv')).toThrow();
        expect(() => parseTextbookFile('x'.repeat(2_000_001), 'csv')).toThrow();
    });
});
