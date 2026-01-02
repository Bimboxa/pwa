function getImageCenterColor(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const center = {
        x: Math.floor(width / 2),
        y: Math.floor(height / 2),
    };
    const data = imageData.data;
    const index = (center.y * width + center.x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    const colorHex =
        "#" +
        [r, g, b]
            .map((value) => value.toString(16).padStart(2, "0"))
            .join("");

    return {
        rgba: {
            r,
            g,
            b,
            a,
        },
        hex: colorHex,
    };
}