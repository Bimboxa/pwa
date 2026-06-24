/**
 * Ownership model — single source of truth for edit/delete permissions.
 *
 * Business rule: an object created by a user can only be modified/deleted by
 * that same user. An object with no owner (created anonymously / legacy data)
 * is free for anyone to modify; the first modification "reserves" it to the
 * modifier through the `updatedByUserIdMaster` stamp.
 *
 * The effective owner is `createdByUserIdMaster` when set, otherwise
 * `updatedByUserIdMaster`, otherwise none (free for all).
 *
 * Used by both the DB layer (db.js hard guard) and the UI layer
 * (useCanEditRecord) so the rule lives in exactly one place.
 */

// Values that mean "no owner" → free for everyone.
const FREE_OWNERS = new Set([undefined, null, "", "anonymous"]);

/**
 * @param {object} record
 * @returns {string|null} the effective owner userIdMaster, or null if free.
 */
export function getEffectiveOwner(record) {
  const createdBy = record?.createdByUserIdMaster;
  if (!FREE_OWNERS.has(createdBy)) return createdBy;
  const updatedBy = record?.updatedByUserIdMaster;
  if (!FREE_OWNERS.has(updatedBy)) return updatedBy;
  return null;
}

/**
 * @param {object} record
 * @param {string} currentUserId
 * @returns {boolean} true if the current user may edit/delete the record.
 */
export function canEditRecord(record, currentUserId) {
  const owner = getEffectiveOwner(record);
  return owner === null || owner === currentUserId;
}

/**
 * Thrown by the DB layer when a user tries to modify/delete a record owned by
 * someone else. Caught by UI handlers to surface a toast instead of crashing.
 */
export class OwnershipError extends Error {
  constructor(
    message = "Ownership violation: cannot modify a record created by another user"
  ) {
    super(message);
    this.name = "OwnershipError";
  }
}
