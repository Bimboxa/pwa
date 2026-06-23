import resolveUrl from "Features/appConfig/utils/resolveUrl";

import formatScribeDate from "../utils/formatScribeDate";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Posts a single event to the Scribe API.
 *
 * The endpoint is derived from the configured base URL plus a per-verb method
 * name: `{resolveUrl(config.url)}/Create{Verb}FromJson`
 * (e.g. https://scribeapi.etandex.fr/log/CreateTraceFromJson).
 *
 * No-op when no endpoint is configured.
 *
 * @param {Object} params
 * @param {Object} params.config - appConfig.features.appLog (url, token, source).
 * @param {string} params.verb - start | trace | warning | error | critical | end.
 * @param {string} params.userName - resolved user name (trigram).
 * @param {string} params.appMessage - human-readable message.
 * @param {string} [params.systemVersion] - app version.
 * @param {Error} [params.error] - optional error for error/critical verbs.
 */
export default async function postAppLogService({
  config,
  verb,
  userName,
  appMessage,
  systemVersion,
  error,
}) {
  if (!config?.url) return; // no endpoint => no-op

  const base = resolveUrl(config.url);
  const url = `${base}/Create${cap(verb || "trace")}FromJson`;

  const body = {
    token: config.token,
    date: formatScribeDate(new Date()),
    device: navigator.userAgent,
    ip: null,
    systemVersion: systemVersion
      ? `${systemVersion} (${window.location.hostname})`
      : window.location.hostname,
    userName,
    appMessage,
    source: config.source,
    ...(error
      ? {
          exceptionMessage: error.message ?? String(error),
          innerException: error.inner ?? "",
          stackTrace: error.stack ?? "",
        }
      : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`appLog HTTP ${res.status}`);
}
