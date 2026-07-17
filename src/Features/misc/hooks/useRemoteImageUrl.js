import { useState, useEffect } from "react";

import { useSelector } from "react-redux";

// Object URL for a remote image fetched with the auth bearer token — a plain
// <img src> would not send the Authorization header (revoked on cleanup).
export default function useRemoteImageUrl(url) {
  const jwt = useSelector((s) => s.auth.jwt);

  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    let createdUrl = null;
    let cancelled = false;

    async function load() {
      if (!url) {
        setObjectUrl(null);
        return;
      }
      try {
        const response = await fetch(url, {
          headers: {
            ...(jwt && { Authorization: `Bearer ${jwt}` }),
          },
        });
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        const blob = await response.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      } catch (error) {
        console.error("[useRemoteImageUrl] error", error);
        if (!cancelled) setObjectUrl(null);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url, jwt]);

  return objectUrl;
}
