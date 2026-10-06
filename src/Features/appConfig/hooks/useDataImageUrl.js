import { useEffect, useState } from "react";

import loadDataImageUrl from "../utils/dataImageUrlLoaders";

/*
 * Lazily resolve the URL of an image stored under Data/<orgaCode>/.
 * Nothing loads until `enabled` is true (e.g. a dialog opening); the url is
 * reset when the path changes.
 */
export default function useDataImageUrl({
  orgaCode,
  relativePath,
  enabled = true,
}) {
  const [state, setState] = useState({ path: null, url: null });

  const shouldLoad = Boolean(enabled && orgaCode && relativePath);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    loadDataImageUrl({ orgaCode, relativePath })
      .then((url) => {
        if (!cancelled) setState({ path: relativePath, url: url ?? null });
      })
      .catch((error) => {
        console.error("[useDataImageUrl] failed to load", relativePath, error);
        if (!cancelled) setState({ path: relativePath, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, [shouldLoad, orgaCode, relativePath]);

  const resolved = state.path === relativePath;
  return {
    url: resolved ? state.url : null,
    loading: shouldLoad && !resolved,
  };
}
