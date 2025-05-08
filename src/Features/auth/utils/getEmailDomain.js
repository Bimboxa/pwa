export default function getEmailDomain(email) {
  if (!email) return null;
  return email.split("@").pop();
}
