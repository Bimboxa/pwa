import {useEffect} from "react";

import PageGeneric from "Features/layout/components/PageGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";
import CircularProgress from "@mui/material/CircularProgress";

export default function PageRemoteContainerRedirect() {
  // data

  const queryParams = new URLSearchParams(window.location.search);
  const code = queryParams.get("code");

  // effects

  useEffect(() => {
    if (code && window.opener) {
      window.opener.postMessage(
        {
          type: "DROPBOX_AUTH",
          code,
        },
        window.location.origin
      );
    }

    // Close popup after short delay
    //setTimeout(() => window.close(), 500);
  }, [code]);

  return (
    <PageGeneric>
      <BoxCenter>{<CircularProgress />}</BoxCenter>
    </PageGeneric>
  );
}
