import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useAutoAuth() {

    const appConfig = useAppConfig();

    const url = appConfig?.auth?.autoAuth?.url;

    return async () => {
        if (!url) {
            console.log("[useAutoAuth] no url");
        }

        else {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
            })

            const data = await response.json();

            console.log("[useAutoAuth] data", data);

            return data;
        }

    }
}