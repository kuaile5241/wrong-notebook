# Math speech and narrated SVG explanations

Common equations are verbalized before synthesis, including full-width operators and numeric-only Chinese equations. For example, 40-12=28 is read as forty minus twelve equals twenty-eight in Chinese. Displayed mathematics is never recomputed or changed. Learners can inspect the exact spoken text. Unsupported TeX asks them to consult the screen.

Segments now allow 450 characters and prefer sentence boundaries. Continuous narration prefetches one segment ahead; pause/navigation cancels it. Initial loading and network waits remain possible. Long Xiaoxia is the default teacher voice; previous voices remain selectable.

SVG explanations gain continuous narration, pause, speed and step controls. Audio progress drives each scene's SMIL clock. Newly generated SVGs include detailed scripts in root desc elements with data-voice-start/end attributes, in the selected language. Existing animations use the original question/explanation/answer and an evenly divided timeline; regenerate for scene-specific scripts. The UI explains this limitation.

Narration remains stored in existing SVG fields and therefore travels through existing backup/import paths, without schema changes. The audio endpoint validates ownership, saved language, fingerprints, account access and quotas, ignoring client text. Invalid/overlapping/out-of-range metadata falls back to the original explanation. Aliyun usage is billable; synthesis audio stays in server memory. Real audio and ASR spot checks do not guarantee every complex formula will be pronounced perfectly.
