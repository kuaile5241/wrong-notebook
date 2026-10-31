# English vocabulary atlas

Open Vocabulary at /words. The module adapts 7298 Word Atlas entries across 19 topics with illustrations, UK/US pronunciation and example recordings. Content is AI-created and not individually teacher-reviewed. Keep the CC BY 4.0 attribution, pinned revision and notices in resources/vocabulary.

## Learning

Primary uses a selected foundation list; junior suggests A1–B1 and senior A2–B2. All vocabulary exposes A1–C2. These filters are not official grade standards or textbook lists; Lujiao-Xiangjiao unit mapping is not yet available. Cards show the first meaning/example with expandable details; extra examples may be harder than the word’s level.

Meaning choice, listening choice, spelling and self-rated recall are supported. Server-graded first submissions update progress once; retries return the saved result. Conflicting word revisions and questions older than 24 hours return409. Account write queues improve concurrency; database revision conditions protect cross-process updates. Self-assessments are counted separately from objective accuracy. This dictionary is not a secure examination system.

Account preferences, favorites, cards and review schedules sync across devices. Search/page are temporary. Daily practice selects due words in the current stage/level/topic first, then unseen words. The goal counts daily review submissions without blocking extra practice. Mistake history lists previously incorrect words rather than declaring permanent weakness or filling the original notebook with every word.

FSRS uses target retention0.9; objective correct/wrong map to Good/Again, self-assessment uses four grades. Vocabulary scheduling remains separate from other subjects’ review plans.

## Persistence and access

Migration20261031085721_add_vocabulary_learning adds VocabularyCard, VocabularyAttempt and User.vocabularySettings through new tables and an additive column. All vocabulary APIs, including media, check account access. No AI permission or paid TTS/model call is needed. Recordings support Range, pause, replay and local playback speed. Missing recordings report an error instead of silently using device speech.

Existing JSON backups include vocabularyCards, completed vocabularyAttempts and the exporting account’s preferences. Media and transient unanswered questions are excluded. Restore validates words/card state/counters, recomputes objective results, filters foreign account records in normal imports and does not overwrite newer existing progress. Account deletion cascades private vocabulary records.

## Media deployment

Pinned upstream:99c007673d38f02c418d8e4cd2e9ec90b5d40be5. The37501 media files total about651MB. Check out the pinned revision, then run:

```sh
python3 scripts/install-vocabulary-media.py --source /path/to/word-atlas/public/atlas --output /opt/wrong-notebook/assets/word-atlas-99c0076
```

The installer verifies every file against resources/vocabulary/media-manifest.json and creates a new target rather than overwriting a live directory. Mount the result read-only at /app/resources/vocabulary-media, or set VOCABULARY_MEDIA_DIR. The image includes text resources separately from /app/data.

Preserve existing /app/data/lesson-audio; vocabulary recordings do not replace or clear persistent lesson speech. Self-hosted assets remove dependence on the author’s website. Reopening the existing online Android client loads the new web feature; physical Android testing is not implied.
