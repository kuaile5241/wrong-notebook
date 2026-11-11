# Online practice and foundation checks

Open Practice from navigation. Select a subject, book, chapter or topic, then start practice or a foundation check. Limits are 5/10/20/30 questions; small question pools finish earlier without repeating questions.

Answers and explanations are revealed after submission. Choice and numeric answers use deterministic grading without AI calls. Open answers and unsupported expressions require self-assessment. Mistakes join the private notebook, repeated attempts share the same source question, and new mistakes receive a next-day review.

Checks follow required prerequisites, with two correct responses as a limited indication. Direct, inferred, shaky, weak and unconfirmed outcomes stay distinct. Progress is stored per account, resumes across devices, and is included in backups. Restore rebuilds state from original questions and submitted answers rather than trusting backup answers. Disabled/expired accounts are rejected immediately; AI permission is not required for rule-based practice.

The pinned dataset in resources/learning contains 2938 topics and 11899 questions across seven subjects. AI-generated source content is not teacher-reviewed and some textbook mappings remain provisional. The data and diagnostic engine are CC BY-NC 4.0, with attribution, license and modification notices preserved. Commercial use requires separate authorization. See resources/learning/NOTICE.md.

Video is deferred. Apply migration 20261030033211_add_learning_sessions before running. Standalone file tracing and the family Docker image include resources/learning separately from persistent /app/data.

[Spoken step-by-step lessons](SPOKEN_LESSONS.en.md) are now available in feedback, history and mistake details. Video remains deferred.

## Dataset refresh, 2026-10-30

Pinned upstream 068db3c2550626529269d40939e3c93311a61349 adds junior-high history: 134 topics, 536 questions and 141 edges. Totals: 2938 topics, 11899 questions, 4380 edges. Grade 9 semester 2 uses the existing edition pending revised-book verification. All previous rows are unchanged; compatible 27f7cce sessions remain answerable and contribute to question avoidance. Unknown versions remain rejected.

The review map groups the account’s latest compatible learning snapshots by subject/book/chapter, including unfinished sessions. Only attempted topics contribute; inferred mastery cannot erase observed mistakes. Two distinct rule-graded passes remove a topic; one correct answer or self-assessment still needs confirmation. This is session-update-based aggregation, not a per-answer timeline or proof of mastery. Chapter rechecks/practice reuse existing account isolation, backups and tables; notebooks and review schedules are preserved. No anonymous upstream local ledger is introduced.

The existing English dataset remains aligned to PEP and other People’s Education series, not the child’s Lujiao-Xiangjiao edition. This refresh does not provide textbook-matched English lessons for that edition.


## Complete graph and diagnosis tools

/knowledge restores the full directory, stage/book/domain/ID search, soft and hard prerequisite graphs, 1/2/3/all upstream levels, downstream links, pan/zoom/fit, topic details, curriculum clauses, cross-subject math links and explicit study examples. All curriculum references resolve to the bundled 712 clauses. Catalogue pages support real pagination.

Target diagnosis and scope screening are distinct. Screening stays inside the chosen scope; confirmation can be 2/3/5 and sessions have up to 60 questions. Reports include untested topics, chapter counts, possible roots with pending/out-of-scope warnings and ordered learning paths/graphs. Continue, undo, correction, restart, JSON/PNG downloads and print/PDF are available. Correction discards subsequent session branches for re-answering; previously archived mistakes and practice history remain.

New sessions use the original complete relation graph; legacy sessions keep the old hard-edge graph and question order. /learn/profiles adds private per-account learner profiles, scoped progress/review topics/mistake sources, archive/restore and backup support. Existing records remain in the default profile. The migration adds User.learningSettings and LearningSession.profileId only. Current pinned questions remain unchanged; no upstream trackers or service workers are copied.

## Taxonomy update (2026-11-11)

Pinned upstream `07941bcf70bff6a59105e953b8d0e78f1dfa0d55`: 3442 topics, 13915 questions and 4915 links across ten subjects. Geography, biology and chemistry are now available; textbook chapters, curriculum metadata and illustrated questions were updated. Sujiao math and Yilin English mappings are shown as drafts in topic details. Existing Xiangjiao textbook shelves remain intact. Screening infers mastery only along hard prerequisite edges. Old sessions and backup restores use the retained immutable 068db3c data and engine; rewritten questions do not reuse old answers, blindspots or mistake identities.
