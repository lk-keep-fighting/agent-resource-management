import { z } from 'zod';

export const SkillMetadataSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'name 只能包含小写字母、数字和连字符'),
  description: z.string().min(1).max(1024),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  metadata: z.record(z.string()).optional(),
});

export const LoginSchema = z.object({
  apiKey: z.string().min(1, 'API Key 不能为空'),
});

export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;