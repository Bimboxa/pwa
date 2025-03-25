// auth
import {ClerkProvider} from "@clerk/clerk-react";
import {frFR} from "@clerk/localizations";

// remote containers
import {AccessTokenDropboxProvider} from "Features/dropbox/AccessTokenDropboxContext";

// styles
import {ThemeProvider} from "@mui/material/styles";
import {CssBaseline} from "@mui/material";
import theme from "Styles/theme";

// redux store
import store from "App/store";
import {Provider} from "react-redux";

// other
import MainAppLayout from "./MainAppLayout";

function App({pca, runningIn}) {
  // auth

  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  // render

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} localization={frFR}>
      <AccessTokenDropboxProvider>
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <MainAppLayout />
          </ThemeProvider>
        </Provider>
      </AccessTokenDropboxProvider>
    </ClerkProvider>
  );
}

export default App;
