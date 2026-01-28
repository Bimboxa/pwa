export default function getEntityAutoIncrementProps(entityModel, entities) {


    const fields = Object.values(entityModel?.fieldsObject);
    const autoFields = fields?.filter((field) => {
        return field.options?.increment === "auto";
    });

    const autoNew = {};
    autoFields?.forEach((field) => {
        const fieldKey = field.key;
        const values = entities
            ?.map((entity) => parseInt(entity[fieldKey]))
            .filter((value) => !isNaN(value) && isFinite(value)); // Filter out NaN and Infinity
        const max = values?.length > 0 ? Math.max(...values) : 0;
        const fieldValue = max + 1;
        autoNew[fieldKey] = fieldValue.toString();
    });

    return autoNew;
}