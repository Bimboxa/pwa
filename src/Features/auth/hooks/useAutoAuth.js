import { setUserProfile, setJwt } from "Features/auth/authSlice";
import { useDispatch } from "react-redux";
import transformObject from "Features/misc/utils/transformObject";

import useLogAppEvent from "Features/appLog/hooks/useLogAppEvent";

export default function useAutoAuth() {
    const dispatch = useDispatch();
    const logEvent = useLogAppEvent();

    return async (url, authDataMapping) => {
        if (!url) {
            console.log("[useAutoAuth] no url");
        }

        else {
            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                })

                if (response.ok) {
                    const data = await response.json();



                    // userProfile

                    const userProfile = transformObject(data, authDataMapping.userProfile);
                    dispatch(setUserProfile(userProfile));

                    console.log("[useAutoAuth] userProfile", userProfile);

                    // App load is logged here, once auth has resolved the
                    // profile, so the LOAD_APP event carries a populated
                    // userName. We pass the freshly fetched profile explicitly
                    // since Redux hasn't propagated it yet.
                    logEvent("LOAD_APP", {}, { userProfile });

                    // jwt

                    const jwtObject = transformObject(data, authDataMapping.jwt);
                    const jwt = jwtObject?.jwt;
                    console.log("debug_jwt", jwt)
                    dispatch(setJwt(jwt));

                    return data;
                }
            }
            catch (error) {
                console.log("[useAutoAuth] error", error, "url", url);
            }
        }
    }
}