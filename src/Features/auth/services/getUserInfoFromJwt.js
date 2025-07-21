import getAppConfigDefault from "Features/appConfig/services/getAppConfigDefault";
import decodeJWT from "./decodeJWT";

export default function getUserInfoFromJwt({ appConfig, jwt }) {
  const decoded = decodeJWT(jwt) ?? {};

  const userInfoConfig = appConfig?.auth?.userInfo ?? {};

  let userInfo = {};

  Object.entries(userInfoConfig).forEach(([key, value]) => {
    userInfo[key] = decoded[value];
  });

  return userInfo;
}
