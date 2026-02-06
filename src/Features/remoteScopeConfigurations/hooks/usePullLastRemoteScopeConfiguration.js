import { useDispatch, useSelector } from "react-redux";

import { setLastSyncedRemoteConfigurationVersion } from "../remoteScopeConfigurationsSlice";

export default function usePullLastRemoteScopeConfiguration() {
    const dispatch = useDispatch();

    // data

    const configuration = useSelector((s) => s.remoteScopeConfigurations.lastRemoteConfiguration);

    // return 

    const pull = async () => {
        await new Promise((resolve) => {
            setTimeout(() => {
                dispatch(setLastSyncedRemoteConfigurationVersion(configuration.version));
                resolve();
            }, 3000);
        });
    }

    return pull;
}