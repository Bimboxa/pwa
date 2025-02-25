import {gapiConfigPromise, gsiPromise} from "./gapiServices";
import store from "App/store";
import {setAccessToken, setIsSignedIn} from "./gapiSlice";

export const getTokenClientAsync = async () => {
  const gsi = await gsiPromise;
  const gapiConfig = await gapiConfigPromise;
  const tokenClient = gsi.accounts.oauth2.initTokenClient({
    client_id: gapiConfig.clientId,
    scope: gapiConfig.scope,
    callback: (tokenResponse) => {
      if (tokenResponse?.error) {
        console.error("Error", tokenResponse.error);
        return;
      } else if (tokenResponse) {
        store.dispatch(setAccessToken(tokenResponse.access_token));
        store.dispatch(setIsSignedIn(true));
      }
    },
    prompt: "", // for automatic token refresh
  });
  return tokenClient;
};

export const signIn = (tokenClient) => {
  console.log("[gapiServicesAuth] tokenClient", tokenClient);
  if (tokenClient) {
    tokenClient.requestAccessToken();
  }
};
