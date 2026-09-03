import { useSelector } from "react-redux";

export default function useNotesAppSession() {
  const session = useSelector((s) => s.notesApp.session);
  const authStatus = useSelector((s) => s.notesApp.authStatus);
  return { session, authStatus };
}
