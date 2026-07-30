import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

/**
 * Resolve the current user's trigram from the auth userProfile, falling back
 * to the debug auth stored in localStorage (same pattern as
 * usePushRemoteScopeConfiguration / useCreatePov). Mirrors getUserIdMaster.
 *
 * @param {object} userProfile - state.auth.userProfile
 * @returns {string|null}
 */
export default function getUserTrigram(userProfile) {
  return userProfile?.trigram ?? getDebugAuthFromLocalStorage()?.trigram ?? null;
}
