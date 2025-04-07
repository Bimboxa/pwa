// auth
import {ClerkProvider} from "@clerk/clerk-react";
import {frFR} from "@clerk/localizations";

// remote containers
import {RemoteTokenDataProvider} from "Features/sync/RemoteTokenDataContext";

// styles
import {ThemeProvider} from "@mui/material/styles";
import {CssBaseline} from "@mui/material";
import theme from "Styles/theme";

// redux store
import store from "App/store";
import {Provider} from "react-redux";

// routes

import {Routes, Route} from "react-router-dom";
import MainAppLayout from "./MainAppLayout";
import PageLanding from "Features/init/components/PageLanding";
import PageRemoteContainerRedirect from "Features/sync/components/PageRemoteContainerRedirect";

function App({pca, runningIn}) {
  // auth

  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  // render

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} localization={frFR}>
      <RemoteTokenDataProvider>
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <Routes>
              <Route path="/" element={<MainAppLayout />} />
              <Route
                path="/remote-container-redirect"
                element={<PageRemoteContainerRedirect />}
              />

              <Route path="/landing" element={<PageLanding />} />
            </Routes>
          </ThemeProvider>
        </Provider>
      </RemoteTokenDataProvider>
    </ClerkProvider>
  );
}

export default App;
