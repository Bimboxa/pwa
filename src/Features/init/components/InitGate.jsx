import useInit from "../hooks/useInit";

export default function InitGate({ children }) {
  useInit();

  return <>{children}</>;
}
