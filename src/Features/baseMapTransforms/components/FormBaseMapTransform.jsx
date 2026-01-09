import FormGenericV2 from "Features/form/components/FormGenericV2"

export default function FormBaseMapTransform({ baseMapTransform, onChange }) {

    // template

    const template = {
        fields: [
            {
                key: "name",
                type: "text",
                label: "Nom de la commande",
                options: {
                    showAsSection: true,
                    fullWidth: true,
                }
            },
            {
                key: "prompt",
                type: "text",
                label: "Prompt",
                options: {
                    fullWidth: true,
                    multiline: true,
                    showAsSection: true,
                }
            }
        ]
    }

    // render

    return <FormGenericV2 template={template} item={baseMapTransform} onItemChange={onChange} />
}