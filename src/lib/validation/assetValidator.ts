/**
 * Sproutelle Admin Content Studio - Asset-Level Validator
 * File: src/lib/validation/assetValidator.ts
 */

import type { MediaAsset, Question } from '../../types/database';
import type { ValidationMessage, ValidationResult } from './types';

export function validateAssets(
  questions: Question[],
  availableAssets: MediaAsset[] = []
): ValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const entityId = q.id || `q-${idx}`;

    const checkAsset = (assetId?: string | null, role: string = 'media') => {
      if (!assetId) return;
      const found = availableAssets.find((a) => a.id === assetId);
      if (!found) {
        errors.push({
          code: 'ERR_ASSET_MISSING_METADATA',
          message: `Question #${qNum} references ${role} asset ID ${assetId} which does not exist in media library records.`,
          severity: 'error',
          field: role,
          entityId,
          entityType: 'asset',
        });
      } else {
        if (!found.file_path || !found.file_path.trim()) {
          errors.push({
            code: 'ERR_ASSET_EMPTY_FILE_PATH',
            message: `Question #${qNum} references ${role} asset (${found.name}) which has an empty or invalid file_path in database records.`,
            severity: 'error',
            field: role,
            entityId,
            entityType: 'asset',
          });
        }
        if (!found.bucket_name || !found.bucket_name.trim()) {
          errors.push({
            code: 'ERR_ASSET_EMPTY_BUCKET_NAME',
            message: `Question #${qNum} references ${role} asset (${found.name}) which has an empty or invalid bucket_name in database records.`,
            severity: 'error',
            field: role,
            entityId,
            entityType: 'asset',
          });
        }
        if (role.includes('audio') && (!found.mime_type || !found.mime_type.startsWith('audio/'))) {
          errors.push({
            code: 'ERR_ASSET_MIME_MISMATCH_AUDIO',
            message: `Question #${qNum} audio asset (${found.name}) has invalid MIME type "${found.mime_type || 'empty'}", expected audio/* format.`,
            severity: 'error',
            field: role,
            entityId,
            entityType: 'asset',
          });
        }
        if ((role.includes('image') || role.includes('option')) && (!found.mime_type || !found.mime_type.startsWith('image/'))) {
          errors.push({
            code: 'ERR_ASSET_MIME_MISMATCH_IMAGE',
            message: `Question #${qNum} image asset (${found.name}) has invalid MIME type "${found.mime_type || 'empty'}", expected image/* format.`,
            severity: 'error',
            field: role,
            entityId,
            entityType: 'asset',
          });
        }
      }
    };

    checkAsset(q.image_asset_id, 'question_image');
    checkAsset(q.audio_asset_id, 'instruction_audio');

    (q.options || []).forEach((opt, optIdx) => {
      checkAsset(opt.media_asset_id, `option_${optIdx + 1}_image`);
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
