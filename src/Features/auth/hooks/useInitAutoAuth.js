import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setJwt } from "../authSlice";
import { updateUserProfile } from "../authSlice";

import useAutoAuth from "./useAutoAuth";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import getDebugAuthFromLocalStorage from "../services/getDebugAuthFromLocalStorage";


export default function useInitAutoAuth() {

    const dispatch = useDispatch();

    const autoAuth = useAutoAuth();
    const appConfig = useAppConfig();

    const url = appConfig?.auth?.autoAuth?.url;
    const authDataMapping = appConfig?.auth?.autoAuth?.dataMapping;


    useEffect(() => {
        if (url && authDataMapping) autoAuth(url, authDataMapping);
    }, [url, authDataMapping]);

    useEffect(() => {
        const { jwt, userIdMaster } = getDebugAuthFromLocalStorage() ?? {};
        if (userIdMaster) {
            dispatch(updateUserProfile({ idMaster: userIdMaster }));
        }
        if (jwt) {
            dispatch(setJwt(jwt));
        }
    }, []);
}