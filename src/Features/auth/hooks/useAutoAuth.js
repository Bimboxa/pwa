import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useAutoAuth() {

    return async (url) => {
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

                return data;
            }
            catch (error) {
                console.log("[useAutoAuth] error", error);
            }
        }

    }
}