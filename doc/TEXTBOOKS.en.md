# Textbook shelf and content management

Learners use /books; Vocabulary and Practice link to the shelf. Administrators use /admin/textbooks from the shelf or admin dashboard. Learners only access published, non-archived material; every management write checks the current database role.

Books support primary, junior and senior grades, subjects, volumes, publishers, editions/reprints, ISBN and source notes. New books are drafts. Units have stable codes, titles, modules, order, page references, notes and optional HTTP(S) course links. Terms support lesson-specific meanings, original examples, atlas mappings and verification flags. Illustrations require explicit semantic confirmation instead of automatic reuse. Unmatched words/phrases remain learnable.

## Batch import

Use UTF-8 CSV, TSV or JSON, up to2MB and1000 rows. The downloadable template has Chinese headers; English field names are accepted. Required:unitCode, unitTitle, word, meaning. Optional:moduleTitle, pageReference, example, translation, atlasId, useAtlasImage, notes, verified. Boolean values accept true/false,1/0 and是/否.

Preview before confirming. The preview reports new units, additions, updates, duplicates and missing recordings. Invalid rows prevent the entire transaction; conflicting unit titles, repeated words within a unit and mismatched atlas links are rejected. Choose skip or update for existing entries. Revision checks prevent stale management windows from overwriting edits.

Publish after review. Whole-book or unit selection syncs to the learner account and uses the existing four practice modes, favorites, mistakes andFSRS reviews. Lesson meanings have separate IDs/progress from free-atlas senses. Editing a book invalidates unfinished stale questions without deleting prior progress.

## Prepared first book

Lujiao-Xiangjiao English grade3 upper, ISBN978-7-5539-9947-0, Hunan/Shandong Education Press. Official previews identify the August2024 first edition, June2025 reprint:3 modules,9 units,125 reference word/phrase entries,71 with matching atlas recordings.

Cover, copyright page and directory were checked against public National Smart Education previews. Vocabulary comes from public unit reference lists and has not been checked word-by-word against the book’s final glossary or reviewed by a teacher. Verification notes are shown in the book and terms. Source metadata is in resources/textbooks/source-manifest.json. No full textbook pages/PDF, passages, external recordings or videos are redistributed. Installing the prepared book again never overwrites administrator edits.

## Audio and persistence

Matching words reuse self-hosted recordings. Unmatched entries can use the configured Aliyun natural voice only after an explicit play action; the audio element defers its online source until that action, andHEAD never generates speech. The server reads a published term, ignoring caller text. Existing persistent lesson-audio caching reuses identical text/model/voice/synthesis-rate and deduplicates generation. Pause/replay do not re-synthesize. Initial generation follows the configured provider’s fees and is not labeled nativeUK/US recording. No mechanical fallback is used.

Migration20261031114206_add_textbook_books adds three textbook tables and an additive scope column toVocabularyAttempt. Preserve Word Atlas media mounts and existing lesson speech files. Administrator JSON backups include global books/units/terms; restore missing content before vocabulary progress without overwriting newer existing books. Normal imports cannot publish shared content and require the corresponding server-side catalog for term progress. Archiving retains progress. All endpoints enforce active/unexpired accounts. Factory reset includes textbook tables and was tested only on temporary databases.
