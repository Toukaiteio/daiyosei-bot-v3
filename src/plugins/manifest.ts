import { z } from 'zod';

export const pluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  version: z.string().default('0.0.0'),
  entry: z.string().optional(),
  enabled: z.boolean().default(true),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
