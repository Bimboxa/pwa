import useNotesAppSession from "../hooks/useNotesAppSession";

import SectionNotesAppLoginForm from "./SectionNotesAppLoginForm";

// Login form while signed out; once signed in, the email and the sign-out
// button live in the panel header (IconButtonNotesAppSignOut).
export default function SectionNotesAppConnection({ appName = "Krnet" }) {
  // data

  const { session } = useNotesAppSession();

  // render

  if (session) return null;

  return <SectionNotesAppLoginForm appName={appName} />;
}
