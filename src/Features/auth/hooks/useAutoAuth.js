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

                if (response.ok) {
                    const data = await response.json();

                    console.log("[useAutoAuth] data", data);

                    // userProfile

                    const userProfile = transformObject(data, authDataMapping.userProfile);
                    dispatch(setUserProfile(userProfile));

                    // jwt

                    const jwtObject = transformObject(data, authDataMapping.jwt);
                    const jwt = jwtObject?.jwt;
                    console.log("debug_jwt", jwt)
                    dispatch(setJwt(jwt));

                    return data;
                }
            }
            catch (error) {
                console.log("[useAutoAuth] error", error);
            }
        }
    }
}