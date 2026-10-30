# Aliyun natural narration

Administrators open Settings → AI Provider → Aliyun natural narration. Enter a Beijing Model Studio API Key and Workspace ID over HTTPS or an SSH tunnel, enable and save. Long Xiaoxia is the default teacher voice; Long Xiaochun and Long Anyang remain available. Save & preview uses billable synthesis. Keys remain in server config/app-config.json, are masked in API responses, and never enter the app or Git. Protect configuration backups.

Automatic mode uses Aliyun when enabled, otherwise the existing compatible voice. Natural voice errors remain visible; there is no silent mechanical fallback. Device mode reports missing voices immediately. Phones need no proxy or app reinstall. Speed, pause, replay and continuous steps remain available.

The server sends lesson text to Aliyun CosyVoice HTTP (cosyvoice-v3-flash, Beijing workspace endpoint). WAV audio is persisted and reused by text and synthesis parameters; see [persistent audio](PERSISTENT_AUDIO.en.md). Provider download URLs have their own expiry. Ownership, submitted-question checks, active-account checks, 60 chunks/user/minute and two concurrent synthesis jobs remain enforced. Text/model/voice/synthesis parameter changes create a new cache entry; credential rotation does not regenerate completed audio.

Optional environment defaults: DASHSCOPE_API_KEY, DASHSCOPE_WORKSPACE_ID. Administrator configuration takes precedence.

Official API: https://help.aliyun.com/zh/model-studio/cosyvoice-tts-http-api
Voices: https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list

Legacy numeric workspace IDs use the official DashScope endpoint; API Host workspace IDs use the dedicated Beijing endpoint.
