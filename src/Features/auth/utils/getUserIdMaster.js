/**
 * Resolve the current user's master id from the auth userProfile.
 *
 * The field depends on the auth flow / appConfig:
 * - debug auth & Kerberos autoAuth (localStorage) dispatch `userIdMaster`
 * - edx appConfig maps the identity to `idMaster` (from staff.idObject), a
 *   NUMBER — so callers must coerce to string before comparing.
 *
 * Returns the raw value (string or number) or null if no identity is resolved.
 * Ownership comparisons go through `normalizeOwnerId` (App/db/ownership) which
 * coerces to string.
 *
 * @param {object} userProfile - state.auth.userProfile
 * @returns {string|number|null}
 */
export default function getUserIdMaster(userProfile) {
  const raw = userProfile?.userIdMaster ?? userProfile?.idMaster;
  return raw === undefined || raw === null || raw === "" ? null : raw;
}
