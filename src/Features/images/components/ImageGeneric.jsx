export default function ImageGeneric({ url, height, objectFit }) {
  return (
    <img
      src={url}
      style={{
        objectFit: objectFit ?? "contain", //
        width: "100%",
        maxHeight: height ?? "100%",
      }}
    />
  );
}
