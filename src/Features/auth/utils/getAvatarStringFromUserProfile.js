export default function getAvatarStringFromUserProfile(userProfile) {
  const firstName = userProfile?.firstName;
  const lastName = userProfile?.lastName;
  const trigram = userProfile?.trigram;

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
