// auth
import { ClerkProvider } from "@clerk/clerk-react";
import { frFR } from "@clerk/localizations";

// remote containers
import { RemoteTokenDataProvider } from "Features/sync/RemoteTokenDataContext";

// styles
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, GlobalStyles } from "@mui/material";
import theme from "Styles/theme";

// redux store
import store from "App/store";
import { Provider } from "react-redux";

// routes

import { Routes, Route } from "react-router-dom";

import OnboardingGate from "Features/onboarding/components/OnboardingGate";
import AuthGate from "Features/auth/components/AuthGate";
import MainAppLayout from "./MainAppLayout";
import PageLanding from "Features/init/components/PageLanding";
import PageRemoteContainerRedirect from "Features/sync/components/PageRemoteContainerRedirect";
import PageSignIn from "Features/auth/components/PageSignIn";
import PageOnboarding from "Features/onboarding/components/PageOnboarding";

// dexie

import { startDexieSync } from "App/dexieSyncService";
import useNetworkStatus from "Features/auth/hooks/useNetworkStatus";

startDexieSync();

function App({ pca, runningIn }) {
  // auth

  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const isOnline = useNetworkStatus();

  // render

  return (
    <ClerkProvider
      key={isOnline ? "online" : "offline"}
      publishableKey={clerkPublishableKey}
      localization={frFR}
    >
      <RemoteTokenDataProvider>
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <GlobalStyles
              styles={{
                html: { overscrollBehaviorY: "contain" },
                body: { overscrollBehaviorY: "contain" },
              }}
            />
            <OnboardingGate>
              <AuthGate>
                <Routes>
                  <Route path="/" element={<MainAppLayout />} />
                  <Route
                    path="/remote-container-redirect"
                    element={<PageRemoteContainerRedirect />}
                  />

                  <Route path="/landing" element={<PageLanding />} />
                  <Route path="/onboarding" element={<PageOnboarding />} />
                  <Route path="/sign-in" element={<PageSignIn />} />
                </Routes>
              </AuthGate>
            </OnboardingGate>
          </ThemeProvider>
        </Provider>
      </RemoteTokenDataProvider>
    </ClerkProvider>
  );
}

export default App;
