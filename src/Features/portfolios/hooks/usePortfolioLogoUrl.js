import { useEffect, useState } from "react";

import db from "App/db/db";

// Load the portfolio logo from db.files and return an object URL.
// Automatically revokes the previous URL on cleanup or when fileName changes.
export default function usePortfolioLogoUrl(logo) {
  const [url, setUrl] = useState(null);

  const fileName = logo?.fileName;

  useEffect(() => {
    if (!fileName) {
      setUrl(null);
      return;
    }

    let revoked = false;
    let objectUrl = null;

    (async () => {
      const file = await db.files.get(fileName);
      if (revoked) return;

      if (file?.fileArrayBuffer) {
        const blob = new Blob([file.fileArrayBuffer], {
          type: file.fileMime || "image/png",
        });
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } else {
        setUrl(null);
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileName]);

  return url;
}
