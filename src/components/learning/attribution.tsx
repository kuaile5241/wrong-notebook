'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export function LearningAttribution() {
    const { t } = useLanguage();
    return <aside className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <p>{t.learning.preview}</p>
        <a href="https://github.com/xiaoyang111222/cn-math-taxonomy" target="_blank" rel="noreferrer" className="underline underline-offset-4">{t.learning.license}</a>
        <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans" target="_blank" rel="noreferrer" className="ml-2 underline">CC BY-NC 4.0</a>
    </aside>;
}
