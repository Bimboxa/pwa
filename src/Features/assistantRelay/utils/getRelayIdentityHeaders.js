import getUserIdMaster from "../../auth/utils/getUserIdMaster.js";

// Trigram is compared with a verified JWT claim by the relay. The master ID
// remains the stable storage identity; neither header is proof of identity.
export default function getRelayIdentityHeaders(userProfile) {
  const userIdMaster = getUserIdMaster(userProfile);
  const trigram = userProfile?.trigram;
  return {
    ...(userIdMaster !== null
      ? { "X-User-Id-Master": String(userIdMaster) }
      : {}),
    ...(typeof trigram === "string" && trigram.length
      ? { "X-Trigram": trigram }
      : {}),
  };
}
