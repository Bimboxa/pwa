export default function getAvatarStringFromUserInfo(userInfo) {
  const firstName = userInfo?.firstName;
  const lastName = userInfo?.lastName;
  const trigram = userInfo?.trigram;

  if (trigram) return trigram;

  if (!firstName && !lastName) return "";
  if (firstName && lastName) {
    return (firstName[0] + lastName[0]).toUpperCase();
  }
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase();
  }
  if (lastName) {
    return lastName.substring(0, 2).toUpperCase();
  }
  return "";
}
