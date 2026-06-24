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
const FREE_OWNERS = new Set(["", "anonymous"]);

/**
 * Normalize an owner / user id to a comparable string, or null when it means
 * "no owner". Ids reach us as strings (debug auth) or numbers (edx idMaster,
 * e.g. 1838640), and across machines/saves the same identity may be stored
 * either way — so we always compare as strings.
 *
 * @param {string|number|null|undefined} value
 * @returns {string|null}
 */
export function normalizeOwnerId(value) {
  if (value === undefined || value === null) return null;
  const str = String(value);
  return FREE_OWNERS.has(str) ? null : str;
}

/**
 * @param {object} record
 * @returns {string|null} the effective owner id (normalized), or null if free.
 */
export function getEffectiveOwner(record) {
  return (
    normalizeOwnerId(record?.createdByUserIdMaster) ??
    normalizeOwnerId(record?.updatedByUserIdMaster)
  );
}

/**
 * @param {object} record
 * @param {string|number} currentUserId
 * @returns {boolean} true if the current user may edit/delete the record.
 */
export function canEditRecord(record, currentUserId) {
  const owner = getEffectiveOwner(record);
  return owner === null || owner === normalizeOwnerId(currentUserId);
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
