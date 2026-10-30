# Spoken step-by-step explanations

Practice feedback, completed answer history and the mistake detail analysis card offer Listen & learn step by step. Original paragraphs, formulas and diagrams are preserved; no new mathematical conclusions are generated. The full explanation remains available.

Controls include previous/next step, play, continuous narration, pause, replay and 0.75/1/1.25 speed. Navigation, changing questions and backgrounding stop playback. Automatic mode prefers Aliyun when enabled, otherwise compatible audio. Device voice is an explicit choice with immediate availability feedback. Device speech resumes from the current short sentence when necessary.

Compatible audio uses the independent espeak-ng executable inside the application container. It has a mechanical voice, supports Mandarin and English, and generates short WAV audio only. Completed audio is persisted and reused, limited to 8MB per segment. No videos are generated. Compatible mode makes no paid voice calls; optional Aliyun natural voice is billed by usage. Some devices require an additional Continue tap after preparation.

Common mathematical notation is converted to speech; unsupported TeX asks the learner to consult the visible formula. The original displayed mathematics remains authoritative. POST /api/lesson-audio reads only owned mistakes or submitted answers, checks account expiry and content fingerprints, limits generation to two concurrent tasks and 60 requests per user per minute.

Family and standard Docker images install espeak-ng. Other deployment environments must install the executable for compatible audio; device speech remains independent. Aliyun requires administrator credentials; no new database fields or migrations. eSpeak NG is a separate GPL-licensed program: https://github.com/espeak-ng/espeak-ng . Dataset license restrictions remain unchanged.

[Aliyun CosyVoice](ALIYUN_VOICE.en.md)

[Persistent audio and deduplication](PERSISTENT_AUDIO.en.md)
