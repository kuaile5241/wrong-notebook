import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCatalog, DATASET_REVISION, COMPATIBLE_DATASET_REVISIONS, SUBJECT_NAMES, topicSubject, volumeLabel } from '@/lib/learning/catalog';
import { learningAuth, learningFailure, noStore } from '@/lib/learning/auth';
import { summarizeBlindspots } from '@/lib/learning/blindspots';
import { createLearningSchema, createLearningState, learningView, parseLearning } from '@/lib/learning/session';

export async function GET(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const p = new URL(req.url).searchParams, catalog = getCatalog(), subject = p.get('subject') || 'math';
        const subjectTopics = catalog.topics.filter(t => topicSubject(t) === subject);
        const volume = p.get('volume') || `${subjectTopics[0]?.grade}-${subjectTopics[0]?.semester}`;
        const volumeTopics = subjectTopics.filter(t => `${t.grade}-${t.semester}` === volume);
        const chapter = p.get('chapter') || '', search = (p.get('search') || '').slice(0, 100).trim().toLowerCase();
        const filtered = (search ? subjectTopics : volumeTopics).filter(t => (!chapter || t.chapter === chapter || !!search) && (!search || `${t.name} ${t.chapter}`.toLowerCase().includes(search)));
        const recent = await prisma.learningSession.findMany({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' }, take: 12,
            select: { id: true, title: true, mode: true, status: true, updatedAt: true } });
        const records = await prisma.learningSession.findMany({ where: { userId: user.id, datasetVersion: { in: COMPATIBLE_DATASET_REVISIONS } }, select: { id: true, state: true, updatedAt: true } });
        return NextResponse.json({ blindspots: summarizeBlindspots(records, subject, volume), revision: DATASET_REVISION, totalTopics: catalog.topics.length, totalQuestions: catalog.questions.length,
            subjects: Object.entries(SUBJECT_NAMES).map(([key, name]) => ({ key, name, topics: catalog.topics.filter(t => topicSubject(t) === key).length })),
            volumes: [...new Map(subjectTopics.map(t => [`${t.grade}-${t.semester}`, { key: `${t.grade}-${t.semester}`, name: volumeLabel(t) }])).values()],
            volume, chapters: [...new Set(volumeTopics.map(t => t.chapter))],
            total: filtered.length, topics: filtered.slice(0, 100).map(t => ({ ...t,
                prerequisites: catalog.dependencies.filter(d => d.topicId === t.id).map(d => ({ id: d.prerequisiteId, name: catalog.byId.get(d.prerequisiteId)?.name ?? d.prerequisiteId, strength: d.strength })) })), recent }, noStore);
    } catch (error) { return learningFailure(error); }
}
export async function POST(req: Request) {
    try {
        const user = await learningAuth(); if (user instanceof NextResponse) return user;
        const parsed = createLearningSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ message: 'Invalid learning request' }, { status: 400 });
        const { topicIds, mode, count } = parsed.data, catalog = getCatalog();
        const topics = [...new Set(topicIds)].map(id => catalog.byId.get(id));
        if (topics.some(t => !t) || new Set(topics.map(t => t && topicSubject(t))).size !== 1)
            return NextResponse.json({ message: 'Invalid topics' }, { status: 400 });
        const recent = await prisma.learningSession.findMany({ where: { userId: user.id, datasetVersion: { in: COMPATIBLE_DATASET_REVISIONS } }, orderBy: { updatedAt: 'desc' }, take: 20 });
        const avoid = recent.flatMap(r => parseLearning(r.state).history.map(h => h.question.id));
        const state = createLearningState(topicIds, mode, count, avoid);
        const row = await prisma.learningSession.create({ data: { id: randomUUID(), userId: user.id, mode,
            title: topics.length === 1 ? topics[0]!.name : topics[0]!.chapter, datasetVersion: DATASET_REVISION,
            state: JSON.stringify(state) } });
        return NextResponse.json(learningView(row), { status: 201, ...noStore });
    } catch (error) { return learningFailure(error); }
}
