
import { useLiveQuery } from "dexie-react-hooks";

import { useSelector } from "react-redux";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import resolvePoints from "Features/annotations/utils/resolvePoints";

import db from "App/db/db";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";

export default function useAnnotationsV2() {

    // data

    const baseMap = useMainBaseMap();

    const annotationTemplates = useAnnotationTemplates();
    const annotationTemplatesMap = getItemsByKey(annotationTemplates, "id");

    const tempAnnotations = useSelector((s) => s.annotations.tempAnnotations);

    // main
    let annotations = useLiveQuery(async () => {
        if (baseMap?.id) {


            // points index
            const points = await db.points.where("baseMapId").equals(baseMap?.id).toArray();
            const pointsIndex = getItemsByKey(points, "id");

            // annotations
            let _annotations = await db.annotations.where("baseMapId").equals(baseMap?.id).toArray();
            _annotations = _annotations.map(annotation => {
                const _annotation = {
                    ...annotation,
                }

                if (_annotation.type === "MARKER") {
                    _annotation.point = resolvePoints({ points: annotation.points, pointsIndex, imageSize: baseMap.image.imageSize })[0];
                } else {
                    _annotation.points = resolvePoints({ points: annotation.points, pointsIndex, imageSize: baseMap.image.imageSize });
                }

                return _annotation;


            })

            return _annotations;
        }

    }, [baseMap?.id]);

    // override with annotation templates
    annotations = annotations?.map(annotation => ({
        ...annotation,
        ...getAnnotationTemplateProps(annotationTemplatesMap[annotation?.annotationTemplateId])
    }))

    // override with temp annotations
    annotations = [...(annotations ?? []), ...(tempAnnotations ?? [])];


    // return 

    return annotations;
}