import { setUserProfile, setJwt } from "Features/auth/authSlice";
import { useDispatch } from "react-redux";
import transformObject from "Features/misc/utils/transformObject";
import resolveUrl from "Features/appConfig/utils/resolveUrl";

export default function useAutoAuth() {
    const dispatch = useDispatch();

    return async (urlConfig, authDataMapping) => {
        if (!urlConfig) {
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
            console.log("[useAutoAuth] jwt", jwt);
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

                const res = await fetch(indirectUrl, {
                    method,
                    credentials: "include",
                });

                if (!res.ok) {
                    return;
                }

                const rawText = await res.text();

                let baseUrl = rawText.trim();
                baseUrl = baseUrl.replace(/^"|"$/g, ""); // strip JSON quotes if any

                if (!baseUrl) {
                    return;
                }

                // Complete the resolved base url with the original route.
                const tokenUrl = resolveUrl({ baseUrl, route: urlConfig.route });

                return await fetchTokenAndDispatch(tokenUrl);
            }

            // Direct path: resolve `baseUrl` + `route` directly.
            const url = resolveUrl(urlConfig);
            return await fetchTokenAndDispatch(url);
        } catch (error) {
            console.error("[useAutoAuth] error", error);
        }
    };
}
