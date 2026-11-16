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
