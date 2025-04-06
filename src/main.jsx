import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import MainApp from "App/components/MainApp";

import {LicenseInfo} from "@mui/x-license";
import PageRemoteContainerRedirect from "App/components/PageRemoteContainerRedirect";
const muiLicenseKey = import.meta.env.VITE_MUI_LICENSE_KEY;
LicenseInfo.setLicenseKey(muiLicenseKey);

// Check if the URL contains "/remote-container-redirect"
const url = new URL(window.location.href);
const isRedirectRoute = url.pathname === "/remote-container-redirect";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isRedirectRoute ? <PageRemoteContainerRedirect /> : <MainApp />}
  </StrictMode>
);
