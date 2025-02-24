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
  // render

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MainAppLayout />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
