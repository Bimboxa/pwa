export default function getAvatarStringFromUserProfile(userProfile) {
  const firstName = userProfile?.firstName;
  const lastName = userProfile?.lastName;
  const trigram = userProfile?.trigram;
  const userName = userProfile?.userName;

  if (trigram) return trigram;

  if (!firstName && !lastName) {
    if (userName) {
      const nameParts = userName.split(" ");
      if (nameParts.length > 1) {
        return (
          nameParts[0].substring(0, 1) +
          nameParts[nameParts.length - 1].substring(0, 1).toUpperCase()
        );
      }
      return userName.substring(0, 2).toUpperCase();
    }
    return "";
  }
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
