import { z } from 'zod';

export const RoadmapStepSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  title: z.string().min(1, "Step title cannot be empty"),
  description: z.string().min(1, "Step description cannot be empty"),
  requiredTools: z.array(z.string()).optional().default([]),
  expectedOutput: z.string().optional().default(""),
  dependencies: z.array(z.string()).optional().default([]),
});

export const RoadmapSchema = z.object({
  objective: z.string().min(1, "Objective is required"),
  steps: z.array(RoadmapStepSchema).min(1, "Roadmap must have at least one step"),
  completionCriteria: z.array(z.string()).min(1, "Completion criteria must have at least one item"),
});

export const ToolCallSchema = z.object({
  tool: z.string(),
  params: z.record(z.string(), z.any()),
});

export const ReviewSchema = z.object({
  passed: z.boolean(),
  completenessScore: z.number().min(0).max(100).optional(),
  observations: z.array(z.string()),
  repairNeeded: z.boolean(),
  repairNotes: z.string().optional(),
});

export type ValidatedRoadmap = z.infer<typeof RoadmapSchema>;
export type ValidatedRoadmapStep = z.infer<typeof RoadmapStepSchema>;
export type ValidatedToolCall = z.infer<typeof ToolCallSchema>;
export type ValidatedReview = z.infer<typeof ReviewSchema>;
