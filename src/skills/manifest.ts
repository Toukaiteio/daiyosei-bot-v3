import { z } from 'zod';

export const skillManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  version: z.string().default('0.0.0'),
  permissions: z.array(z.string()).default([]),
  instruction: z.string().min(1),
  enabled: z.boolean().default(true),
});

export type SkillManifest = z.infer<typeof skillManifestSchema>;
