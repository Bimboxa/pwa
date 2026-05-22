import {useSelector} from "react-redux";

export default function useDocumentationConfig() {
  return useSelector((s) => s.appConfig.value?.features?.documentation ?? null);
}
