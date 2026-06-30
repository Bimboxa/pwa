import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setJwt } from "../authSlice";
import { updateUserProfile } from "../authSlice";

import useAutoAuth from "./useAutoAuth";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import resolveUrl from "Features/appConfig/utils/resolveUrl";

import getDebugAuthFromLocalStorage from "../services/getDebugAuthFromLocalStorage";


export default function useInitAutoAuth() {

    const dispatch = useDispatch();

    const autoAuth = useAutoAuth();
    const appConfig = useAppConfig();

    const urlConfig = appConfig?.auth?.autoAuth?.url;
    const url = resolveUrl(urlConfig);
    const authDataMapping = appConfig?.auth?.autoAuth?.dataMapping;
    const method = urlConfig?.method ?? "GET";
    const indirect = Boolean(urlConfig?.indirect);


    useEffect(() => {
        if (url && authDataMapping) autoAuth(url, authDataMapping, { method, indirect });
    }, [url, authDataMapping, method, indirect]);

    useEffect(() => {
        const { jwt, userIdMaster, userName } = getDebugAuthFromLocalStorage() ?? {};
        if (userIdMaster) {
            dispatch(updateUserProfile({ userIdMaster, userName }));
        }
        if (jwt) {
            dispatch(setJwt(jwt));
        }
    }, []);
}