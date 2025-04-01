import {createContext, useContext, useState} from "react";

const RemoteTokenDataContext = createContext(null);

export function RemoteTokenDataProvider({children}) {
  const [remoteTokenData, setRemoteTokenData] = useState(null);
  return (
    <RemoteTokenDataContext.Provider
      value={{remoteTokenData, setRemoteTokenData}}
    >
      {children}
    </RemoteTokenDataContext.Provider>
  );
}

export function useRemoteTokenData() {
  return useContext(RemoteTokenDataContext);
}
