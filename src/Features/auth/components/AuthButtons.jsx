import AuthButtonsVariantCustom from "./AuthButtonsVariantCustom";
import AuthButtonsVariantClerk from "./AuthButtonsVariantClerk";

export default function AuthButtons() {
  const variant = "CUSTOM";

  if (variant === "CUSTOM") {
    return <AuthButtonsVariantCustom />;
  }

  if (variant === "CLERK") {
    return <AuthButtonsVariantClerk />;
  }

  return null;
}
