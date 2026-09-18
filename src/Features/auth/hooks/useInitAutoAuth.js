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

    const urlConfig = appConfig?.auth?.autoAuth?.url;
    const authDataMapping = appConfig?.auth?.autoAuth?.dataMapping;


    useEffect(() => {
        if (urlConfig && authDataMapping) autoAuth(urlConfig, authDataMapping);
    }, [urlConfig, authDataMapping]);

    useEffect(() => {
        const { jwt, userIdMaster, userName, trigram } =
            getDebugAuthFromLocalStorage() ?? {};
        if (userIdMaster) {
            // Same shape as the profile produced by the autoAuth dataMapping
            // (idMaster / trigram): the hooks that read
            // `state.auth.userProfile.idMaster` directly (ByUser fetch,
            // dashboard "Mes Krtos") must see the debug identity too when the
            // autoAuth endpoint is unreachable (kal 401). `userIdMaster` is
            // kept for getUserIdMaster's legacy field.
            dispatch(
                updateUserProfile({
                    idMaster: userIdMaster,
                    userIdMaster,
                    userName,
                    trigram,
                })
            );
        }
        if (jwt) {
            dispatch(setJwt(jwt));
        }
    }, []);
}