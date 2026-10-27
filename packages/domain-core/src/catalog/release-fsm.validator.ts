import {
  type ReleaseStatus,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';

const ALLOWED_TRANSITIONS: Readonly<Record<ReleaseStatus, readonly ReleaseStatus[]>> = {
  DRAFT: ['UPLOADING_ASSETS'],
  UPLOADING_ASSETS: ['DRAFT', 'FORENSIC_PROCESSING'],
  FORENSIC_PROCESSING: ['MANUAL_COPYRIGHT_REVIEW', 'MODERATION_QUEUE', 'REJECTED'],
  MANUAL_COPYRIGHT_REVIEW: ['MODERATION_QUEUE', 'APPROVED_FOR_DELIVERY', 'REJECTED'],
  MODERATION_QUEUE: ['APPROVED_FOR_DELIVERY', 'REJECTED'],
  APPROVED_FOR_DELIVERY: ['DISPATCHING_TO_REVELATOR'],
  DISPATCHING_TO_REVELATOR: ['LIVE_ON_DSPS', 'MODERATION_QUEUE'],
  LIVE_ON_DSPS: ['TAKEDOWN_REQUESTED'],
  REJECTED: ['DRAFT'],
  TAKEDOWN_REQUESTED: [],
};

/**
 * Enforces catalog immutability and valid state transitions before Revelator ingestion.
 */
export function validateReleaseStateTransition(
  currentStatus: ReleaseStatus,
  targetStatus: ReleaseStatus,
): Result<ReleaseStatus> {
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowedNext.includes(targetStatus)) {
    return err(
      createDomainError({
        code: 'INVALID_STATE_TRANSITION',
        moduleName: 'ReleaseStateMachine',
        message: `Transición de catálogo prohibida: no se puede pasar de "${currentStatus}" a "${targetStatus}".`,
      }),
    );
  }

  return ok(targetStatus);
}

/**
 * Determines whether metadata/audio tracks can still be mutated by the tenant.
 */
export function isReleaseEditableByTenant(status: ReleaseStatus): boolean {
  return status === 'DRAFT' || status === 'REJECTED';
}
