/**
 * Sproutelle Admin Content Studio - Publication Query Parser
 * File: src/lib/validation/queryParser.ts
 */

import type { Question, GameLevel } from '../../types/database';

export interface PublicationDataLoadResult {
  success: boolean;
  questions: Question[];
  activeSubcategoryIds: Set<string>;
  levels: GameLevel[];
  error?: string;
}

export function parsePublicationDataQueries(
  qRes: { data: unknown; error: { message: string } | null },
  assignRes: { data: unknown; error: { message: string } | null },
  levelsRes: { data: unknown; error: { message: string } | null }
): PublicationDataLoadResult {
  if (qRes.error) {
    return {
      success: false,
      questions: [],
      activeSubcategoryIds: new Set(),
      levels: [],
      error: `Questions Query Failure: ${qRes.error.message}`,
    };
  }
  if (assignRes.error) {
    return {
      success: false,
      questions: [],
      activeSubcategoryIds: new Set(),
      levels: [],
      error: `Subcategory Assignments Query Failure: ${assignRes.error.message}`,
    };
  }
  if (levelsRes.error) {
    return {
      success: false,
      questions: [],
      activeSubcategoryIds: new Set(),
      levels: [],
      error: `Game Levels Query Failure: ${levelsRes.error.message}`,
    };
  }

  const questions = (qRes.data as Question[]) || [];
  const activeSubcategoryIds = new Set<string>();
  if (assignRes.data) {
    (assignRes.data as Array<{ subcategory_id: string }>).forEach((a) => {
      if (a.subcategory_id) activeSubcategoryIds.add(a.subcategory_id);
    });
  }
  const levels = (levelsRes.data as GameLevel[]) || [];

  return {
    success: true,
    questions,
    activeSubcategoryIds,
    levels,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadPublicationData(
  gameId: string,
  isConfigured: boolean,
  client: any
): Promise<PublicationDataLoadResult> {
  if (!isConfigured) {
    return {
      success: false,
      questions: [],
      activeSubcategoryIds: new Set(),
      levels: [],
      error: 'Supabase is not configured. Cannot perform publication preview or validation.',
    };
  }

  try {
    const [qRes, assignRes, levelsRes] = await Promise.all([
      client.from('questions').select('*, options:question_options(*)').eq('game_id', gameId).order('sort_order', { ascending: true }),
      client.from('subcategory_games').select('subcategory_id').eq('game_id', gameId).eq('is_active', true),
      client.from('game_levels').select('*').eq('game_id', gameId).order('level_number', { ascending: true }),
    ]);

    return parsePublicationDataQueries(qRes, assignRes, levelsRes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database query failed.';
    return {
      success: false,
      questions: [],
      activeSubcategoryIds: new Set(),
      levels: [],
      error: `Publication Data Load Failure: Could not verify subcategory assignments or questions (${msg}).`,
    };
  }
}
