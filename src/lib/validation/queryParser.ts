/**
 * Sproutelle Admin Content Studio - Publication Query Parser
 * File: src/lib/validation/queryParser.ts
 */

import type { Question, GameLevel } from '../../types/database';
import type { AdminReleasePackSnapshot } from '../publisher';

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

export interface PublishRPCExecutionResult {
  success: boolean;
  version?: string;
  error?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function executePublishReleaseRPC(
  gameId: string,
  snapshot: AdminReleasePackSnapshot,
  client: any
): Promise<PublishRPCExecutionResult> {
  try {
    const { data, error } = await client.rpc('publish_game_release', {
      p_game_id: gameId,
      p_version_number: snapshot.pack_version,
      p_pack_data: snapshot,
    });

    if (error) {
      return {
        success: false,
        error: `RPC Execution Error: ${error.message}`,
      };
    }

    if (data === false) {
      return {
        success: false,
        error: 'Publish function returned false.',
      };
    }

    // Active release post-publication verification
    const { data: releaseData, error: releaseErr } = await client
      .from('game_releases')
      .select('id, version_number, is_active')
      .eq('game_id', gameId)
      .eq('is_active', true);

    if (releaseErr) {
      return {
        success: false,
        error: `Publication RPC executed, but active release verification query failed: ${releaseErr.message}`,
      };
    }

    const releases = (releaseData as Array<{ id: string; version_number: string; is_active: boolean }>) || [];

    if (releases.length === 0) {
      return {
        success: false,
        error: 'Publication RPC executed, but no active release record was verified in the database.',
      };
    }

    if (releases.length > 1) {
      return {
        success: false,
        error: `Publication anomaly: found ${releases.length} active releases for this game. Expected exactly 1 active release.`,
      };
    }

    return {
      success: true,
      version: snapshot.pack_version,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database publish failed.';
    return {
      success: false,
      error: msg,
    };
  }
}
