import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: { '/api/vocabulary': ['./resources/vocabulary/**/*'], '/api/vocabulary/**/*': ['./resources/vocabulary/**/*'], '/api/learning': ['./resources/learning/**/*'], '/api/learning/*': ['./resources/learning/**/*'], '/api/import': ['./resources/learning/**/*', './resources/vocabulary/**/*'], '/api/lesson-audio': ['./resources/learning/**/*'] },
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  // 禁止 next dev 自动向 AGENTS.md / CLAUDE.md 写入 agent-rules 段落
  agentRules: false,
};

export default nextConfig;
