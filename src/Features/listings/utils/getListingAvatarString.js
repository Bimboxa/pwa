// Listing avatar text: the user-defined `avatarString` when set, otherwise
// initials derived from the name (first letter, or the first letters of the
// first two words when the name has several words).

export function getDefaultListingAvatarString(listing) {
  const name = (listing?.name ?? listing?.label ?? "").trim();
  if (!name) return "?";
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0][0].toUpperCase();
}

export default function getListingAvatarString(listing) {
  const custom = listing?.avatarString?.trim?.();
  if (custom) return custom;
  return getDefaultListingAvatarString(listing);
}
