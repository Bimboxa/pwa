import { setUserProfile, setJwt } from "Features/auth/authSlice";
import { useDispatch } from "react-redux";
import transformObject from "Features/misc/utils/transformObject";

export default function useAutoAuth() {
    const dispatch = useDispatch();

    return async (url, authDataMapping, options = {}) => {
        const { method = "GET", indirect = false } = options;

        if (!url) {
            console.log("[useAutoAuth] no url");
            return;
        }

        // Fetches the token endpoint, maps the response and dispatches
        // userProfile + jwt. Shared by the direct and indirect paths.
        const fetchTokenAndDispatch = async (tokenUrl) => {
            const response = await fetch(tokenUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
            });

            if (!response.ok) return;

            const data = await response.json();

            // userProfile

            const userProfile = transformObject(data, authDataMapping.userProfile);
            dispatch(setUserProfile(userProfile));

            console.log("[useAutoAuth] userProfile", userProfile);

            // jwt

            const jwtObject = transformObject(data, authDataMapping.jwt);
            const jwt = jwtObject?.jwt;
            console.log("debug_jwt", jwt);
            dispatch(setJwt(jwt));

            return data;
        };

        try {
            if (indirect) {
                // Step 1: call the configured url to resolve the real token url
                // (returned as plain text).
                const res = await fetch(url, {
                    method,
                    credentials: "include",
                });

                if (!res.ok) return;

                let tokenUrl = (await res.text()).trim();
                tokenUrl = tokenUrl.replace(/^"|"$/g, ""); // strip JSON quotes if any

                if (!tokenUrl) {
                    console.log("[useAutoAuth] empty indirect url");
                    return;
                }

                // Step 2: fetch the token from the resolved url.
                return await fetchTokenAndDispatch(tokenUrl);
            }

            // Direct (legacy) path.
            return await fetchTokenAndDispatch(url);
        } catch (error) {
            console.log("[useAutoAuth] error", error, "url", url);
        }
    };
}
