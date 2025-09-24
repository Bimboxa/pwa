export default function getObjectHash(object) {
  if (!object) return "";

  return Object.entries(object).reduce(
    (ac, [key, value]) => {
      ac = ac + " " + key + ":" + (value ?? "");
      return ac;
    },
    [""]
  );
}
