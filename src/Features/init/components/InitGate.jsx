import useInit from "../hooks/useInit";
import DialogRemoteScopeConfigurationAvailable from "Features/remoteScopeConfigurations/components/DialogRemoteScopeConfigurationAvailable";
import DialogNewVersion from "Features/appConfig/components/DialogNewVersion";

export default function InitGate({ children }) {
  const { remoteScopeConfigCheck } = useInit();

  return (
    <>
      {children}
      <DialogRemoteScopeConfigurationAvailable
        open={remoteScopeConfigCheck.showDialog}
        onClose={remoteScopeConfigCheck.onClose}
        remoteConfig={remoteScopeConfigCheck.remoteConfig}
      />
      <DialogNewVersion />
    </>
  );
}
