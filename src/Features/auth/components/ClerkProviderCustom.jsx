import { useSelector } from "react-redux";

import { ClerkProvider } from "@clerk/clerk-react";

export default function ClerkProviderCustom({ children, ...props }) {
  // data

  const enabled = useSelector((s) => s.auth.clerkIsEnabled);

  // render
  if (!enabled) return children;
  return <ClerkProvider {...props}>{children}</ClerkProvider>;
}
