export default function getAnnotationTemplateSizeInPx({ size, sizeUnit, meterByPx }) {

    if (sizeUnit === "PX" || !meterByPx || !sizeUnit) {
        return size;
    }

    else if (sizeUnit === "M" && meterByPx) {
        return {
            width: size.width / meterByPx,
            height: size.height / meterByPx,
        };
    }

}