import {useSelector} from "react-redux";

export default function useAppConfig() {
  const appConfig = useSelector((s) => s.appConfig.value);

  return appConfig;
}
