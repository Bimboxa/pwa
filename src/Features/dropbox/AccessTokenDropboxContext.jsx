import {createContext, useContext, useState} from "react";

const AccessTokenContext = createContext(null);

export function AccessTokenDropboxProvider({children}) {
  const [accessToken, setAccessToken] = useState(null);
  return (
    <AccessTokenContext.Provider value={{accessToken, setAccessToken}}>
      {children}
    </AccessTokenContext.Provider>
  );
}

export function useAccessToken() {
  return useContext(AccessTokenContext);
}
