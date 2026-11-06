
export const generationEn = {
 title: 'Generate a narrated video', hint: 'Supported mathematics questions are turned into a storyboard, natural narration and animation. Generation continues in the background.',
 generate: 'Generate explanation video', retry: 'Retry generation', voice: 'Narrator', girl: 'Gentle female voice', boy: 'Male voice',
 queued: 'Queued', planning: 'Writing the storyboard', rendering: 'Narrating and rendering', completed: 'Video ready', unsupported: 'This question is not supported yet', failed: 'Generation failed',
 missing: 'Please complete the question, answer and explanation first.', failure: 'Unable to submit or load this task. Please retry.',
 download: 'Download MP4', review: 'AI-generated explanation. Check the reasoning and numbers while learning.',
 edgeFailed: 'The free Edge voice service is unavailable. Retry later; saved audio is reused.', interrupted: 'The task was interrupted. Retry to continue.',
 limited: 'AI permission or quota is unavailable.', invalid: 'A calculation in the storyboard failed verification. Retry generation.',
 cache: 'The same question, model and voice reuse an existing video. Playback and downloads use the saved result.',
};
export const generationZh: typeof generationEn = {
 title: '题目生成讲解视频', hint: '支持的数学题会自动制作分镜、自然配音和动画，离开页面后继续在后台处理。',
 generate: '生成讲解视频', retry: '重试生成', voice: '讲解声音', girl: '温柔女声', boy: '男声',
 queued: '排队中', planning: '正在编写分镜', rendering: '正在配音和渲染', completed: '视频已完成', unsupported: '暂不支持这道题', failed: '生成失败',
 missing: '请先补全题目、答案和详细解析。', failure: '提交或加载任务失败，请重试。',
 download: '下载 MP4', review: 'AI生成讲解，学习时请结合原题核对思路和数字。',
 edgeFailed: 'Edge免费配音暂时不可用，请稍后重试，已保存音频会复用。', interrupted: '任务被中断，可重试继续。',
 limited: 'AI权限或额度暂时不可用。', invalid: '分镜中的计算未通过校验，请重试生成。',
 cache: '相同题目、模型和声音会复用已有视频，播放和下载读取已保存的结果。',
};
