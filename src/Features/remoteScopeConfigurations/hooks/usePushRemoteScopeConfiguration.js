import { useDispatch, useSelector } from "react-redux";

import { setLastSyncedRemoteConfigurationVersion } from "../remoteScopeConfigurationsSlice";

export default function usePushRemoteScopeConfiguration() {
    const dispatch = useDispatch();

    // data

    // return 

    const push = async () => {
        await new Promise((resolve) => {
            setTimeout(() => {
                console.log("pushing remote scope configuration");
                resolve();
            }, 3000);
        });
    }

    return push;
}