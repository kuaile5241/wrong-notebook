# Persistent lesson audio

Completed WAV segments are atomically saved to data/lesson-audio/<SHA256>.wav, or LESSON_AUDIO_CACHE_DIR. Persist the data mount when recreating containers. There is no expiry or automatic eviction. Keys include actual spoken text, engine/model, voice, synthesis rate, sample rate and format; they exclude account IDs and credentials. Local playback speed changes do not call TTS. A previously unseen segment requires its first synthesis.

Concurrent requests share a promise and a disk lock across independent processes. Client cancellation stops playback, while started synthesis finishes and saves. Only actual synthesis emits a Generating new lesson audio log with a hash and nonsensitive voice parameters. Files remain behind authenticated ownership, content-version and account-access checks, without public audio URLs.

Corrupt files do not trigger paid regeneration. Save failures report an error and prevent repeated synthesis in the same process. Completed and successfully saved audio is reusable; upstream failures or crashes before saving cannot guarantee exactly-once billing.

Back up and migrate data/lesson-audio separately with the data directory. JSON database exports do not embed audio bytes. No database migration is needed. Directories/files use 700/600 permissions. With no automatic cleanup, stored versions consume disk space; restoring previous text/voice parameters reuses the old file.
