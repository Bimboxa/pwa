import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolveRequestBody from "Features/appConfig/utils/resolveRequestBody";

import postAppLogService from "../services/postAppLogService";

/**
 * Builds the `userName` sent to Scribe.
 *
 * Prefers the configured template (default `{{userProfile.trigram}}`, i.e.
 * `staff.sIdentifiant`). When the trigram is empty/null, falls back to
 * `firstName + lastName` so the log still carries a usable identity.
 */
function resolveUserName(config, userProfile) {
  const trigram = resolveRequestBody(
    config.userName ?? "{{userProfile.trigram}}",
    { userProfile }
  );
  if (trigram) return trigram;

  return [userProfile?.firstName, userProfile?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Dedicated hook to log application events to the Scribe API.
 *
 * Returns `logEvent(eventKey, params)`:
 * - `eventKey` is a key defined in the centralized registry
 *   (`appConfig.appLogEvents`, loaded from `Data/<orga>/appLogEvents.js`).
 * - `params` are raw values consumed by the event's `buildMessage`.
 *
 * Fire-and-forget: it never blocks the UI and swallows errors (a failed log
 * must not break the business flow). No-op when no endpoint is configured.
 */
export default function useLogAppEvent() {
  const appConfig = useAppConfig();
  const userProfile = useSelector((s) => s.auth.userProfile);

  return (eventKey, params = {}) => {
    const config = appConfig?.features?.appLog;
    if (!config?.url) return; // no endpoint => do nothing

    const event = appConfig?.appLogEvents?.[eventKey];
    if (!event) return;

    const appMessage = event.buildMessage
      ? event.buildMessage(params)
      : params.message ?? eventKey;

    console.log("[appLog]", eventKey, params);

    const userName = resolveUserName(config, userProfile);

    postAppLogService({
      config,
      verb: event.verb ?? "trace",
      userName,
      appMessage,
      systemVersion: appConfig?.appVersion,
      error: params.error,
    }).catch((e) => console.warn("[appLog] log failed", e));
  };
}
