import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { getCatalog, SUBJECT_NAMES, topicSubject, volumeLabel, DATASET_REVISION } from '@/lib/learning/catalog';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
export async function GET(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const p = new URL(req.url).searchParams, subject = p.get('subject') || 'math', c = getCatalog();
        if (!SUBJECT_NAMES[subject]) return NextResponse.json({ message: 'Invalid subject' }, { status: 400 });
        const topics = c.topics.filter(t => topicSubject(t) === subject), ids = new Set(topics.map(t => t.id));
        const standards = JSON.parse(readFileSync(join(process.cwd(), 'resources/learning/standards.json'), 'utf8')) as { id: string; text: string }[];
        const needed = new Set(topics.flatMap(t => (t.standards ?? []).map(s => s.id)));
        return NextResponse.json({ revision: DATASET_REVISION, subjects: SUBJECT_NAMES, topics: topics.map(t => ({ ...t, volumeName: volumeLabel(t) })), dependencies: c.dependencies.filter(d => ids.has(d.topicId) && ids.has(d.prerequisiteId)),
            standards: standards.filter(s => needed.has(s.id)), names: Object.fromEntries(c.topics.map(t => [t.id, { name: t.name, subject: topicSubject(t) }])), aliases: JSON.parse(readFileSync(join(process.cwd(), 'resources/learning/id-aliases.json'), 'utf8')) }, noStore);
    } catch (error) { return learningFailure(error); }
}
