export const buildLabelSubmission = ({ values, initialColor, initialFactor, initialWeight }) => ({
    value: String(values?.value || '').trim(),
    color: values?.color || initialColor,
    factor: values?.factor || initialFactor,
    weight: Number(values?.weight ?? initialWeight),
});
