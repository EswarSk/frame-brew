import { z } from 'zod';

export const generationFormSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  stylePreset: z.string().optional(),
  durationSec: z
    .number()
    .int('Duration must be a whole number of seconds')
    .min(10, 'Minimum duration is 10 seconds')
    .max(30, 'Maximum duration is 30 seconds'),
  captions: z.boolean().optional(),
  watermark: z.boolean().optional(),
});

export type GenerationFormValues = z.infer<typeof generationFormSchema>;

