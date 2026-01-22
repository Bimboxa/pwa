import { useEffect } from "react";


import useAutoAuth from "./useAutoAuth";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";


export default function useInitAutoAuth() {
    const autoAuth = useAutoAuth();
    const appConfig = useAppConfig();

    const url = appConfig?.auth?.autoAuth?.url;
    const authDataMapping = appConfig?.auth?.autoAuth?.dataMapping;

    useEffect(() => {
        if (url) autoAuth(url, authDataMapping);
    }, [url]);
}