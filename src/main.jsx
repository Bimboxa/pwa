import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";

import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import {BrowserRouter} from "react-router-dom";
import MainApp from "App/components/MainApp";

import {LicenseInfo} from "@mui/x-license";

const muiLicenseKey = import.meta.env.VITE_MUI_LICENSE_KEY;
LicenseInfo.setLicenseKey(muiLicenseKey);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  </StrictMode>
);
