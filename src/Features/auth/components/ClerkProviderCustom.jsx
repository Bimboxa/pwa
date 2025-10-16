import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { ClerkProvider } from "@clerk/clerk-react";

export default function ClerkProviderCustom({ children, ...props }) {
  // data

  const appConfig = useAppConfig();
  const enabled = appConfig?.auth?.service === "CLERK";

  // render
  if (!enabled) return children;
  return <ClerkProvider {...props}>{children}</ClerkProvider>;
}
