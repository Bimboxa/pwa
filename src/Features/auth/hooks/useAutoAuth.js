import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import { setUserProfile, setJwt } from "Features/auth/authSlice";
import { useDispatch } from "react-redux";
import transformObject from "Features/misc/utils/transformObject";

export default function useAutoAuth() {
    const dispatch = useDispatch();

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

                const data = await response.json();

                console.log("[useAutoAuth] data", data);

                // userProfile

                const userProfile = transformObject(data, authDataMapping.userProfile);
                dispatch(setUserProfile(userProfile));

                // jwt

                const jwt = transformObject(data, authDataMapping.jwt);
                dispatch(setJwt(jwt));

                return data;
            }
            catch (error) {
                console.log("[useAutoAuth] error", error);
            }
        }
    }
}