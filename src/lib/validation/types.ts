/**
 * Sproutelle Admin Content Studio - Shared Validation Types
 * File: src/lib/validation/types.ts
 */

export type ValidationSeverity = 'error' | 'warning';

export type ValidationEntity = 'game' | 'question' | 'option' | 'asset' | 'engine' | 'hierarchy';

export interface ValidationMessage {
  code: string;
  message: string;
  severity: ValidationSeverity;
  field?: string;
  entityId?: string;
  entityType: ValidationEntity;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}
