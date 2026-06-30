import { setUserProfile, setJwt } from "Features/auth/authSlice";
import { useDispatch } from "react-redux";
import transformObject from "Features/misc/utils/transformObject";
import resolveUrl from "Features/appConfig/utils/resolveUrl";

export default function useAutoAuth() {
    const dispatch = useDispatch();

    return async (urlConfig, authDataMapping) => {
        if (!urlConfig) {
            console.log("[useAutoAuth] no url config");
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

            if (!response.ok) {
                console.error(
                    "[useAutoAuth] token fetch failed",
                    response.status,
                    response.statusText,
                    "url",
                    tokenUrl
                );
                return;
            }

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
            // Indirect base url: `url.baseUrl` is an object holding an `indirect`
            // sub-config. We first call that endpoint to obtain the real base url
            // (returned as plain text), then complete it with the original
            // `url.route` to build the final token url.
            const indirectConfig = urlConfig?.baseUrl?.indirect;

            if (indirectConfig) {
                const indirectUrl = resolveUrl(indirectConfig);
                const method = indirectConfig.method ?? "GET";

                console.log("[useAutoAuth] Step 1: call url to get auth base url", indirectUrl);

                const res = await fetch(indirectUrl, {
                    method,
                    credentials: "include",
                });

                if (!res.ok) {
                    console.error(
                        "[useAutoAuth] Step 1 failed",
                        res.status,
                        res.statusText,
                        "url",
                        indirectUrl
                    );
                    return;
                }

                let baseUrl = (await res.text()).trim();
                baseUrl = baseUrl.replace(/^"|"$/g, ""); // strip JSON quotes if any

                if (!baseUrl) {
                    console.error(
                        "[useAutoAuth] Step 1: empty base url returned",
                        "url",
                        indirectUrl
                    );
                    return;
                }

                console.log("[useAutoAuth] Step 1 done: auth base url", baseUrl);

                // Complete the resolved base url with the original route.
                const tokenUrl = resolveUrl({ baseUrl, route: urlConfig.route });

                console.log("[useAutoAuth] token url to call", tokenUrl);

                return await fetchTokenAndDispatch(tokenUrl);
            }

            // Direct path: resolve `baseUrl` + `route` directly.
            const url = resolveUrl(urlConfig);
            return await fetchTokenAndDispatch(url);
        } catch (error) {
            console.log("[useAutoAuth] error", error);
        }
    };
}
