import decodeJWT from "./decodeJWT";

export default function getUserProfileFromJwt({ appConfig, jwt }) {
  const decoded = decodeJWT(jwt) ?? {};

  const userProfileConfig = appConfig?.auth?.userProfile ?? {};

  let userProfile = {};

  Object.entries(userProfileConfig).forEach(([key, value]) => {
    userProfile[key] = decoded[value];
  });

  return userProfile;
}
