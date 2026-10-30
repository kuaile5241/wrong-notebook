'use client';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { figureSvgToDataUri } from '@/lib/figure-svg';
import type { PublicQuestion } from '@/lib/learning/types';

function Figure({ svg }: { svg?: string }) {
    // 配图已在服务端净化，使用图片隔离渲染，禁止内联执行 SVG。
    return svg ? <img src={figureSvgToDataUri(svg)} alt="" className="my-3 max-h-64 max-w-full rounded-lg bg-white p-2" /> : null;
}
export function QuestionContent({ question, answer, disabled, onAnswer }: { question: PublicQuestion; answer: string; disabled: boolean; onAnswer: (value: string) => void }) {
    return <div className="space-y-4"><MarkdownRenderer content={question.prompt} /><Figure svg={question.figure} />
        {question.choices && <div role="radiogroup" className="grid gap-3">{question.choices.map(c => <button key={c.key} type="button" role="radio" aria-checked={answer === c.key} disabled={disabled} onClick={() => onAnswer(c.key)} className={`min-h-12 rounded-xl border-2 p-4 text-left transition-colors ${answer === c.key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
            <span className="font-bold text-primary">{c.key}.</span><div className="mt-1">{!question.hideChoiceText && <MarkdownRenderer content={c.text} />}<Figure svg={c.figure} /></div>
        </button>)}</div>}
    </div>;
}
