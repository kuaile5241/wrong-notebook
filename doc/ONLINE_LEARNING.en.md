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
