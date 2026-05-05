export const buildLabelSubmission = ({ values, initialColor, initialFactor, initialWeight }) => ({
    value: String(values?.value || '').trim(),
    color: values?.color || initialColor,
    factor: values?.factor || initialFactor,
    weight: Number(values?.weight ?? initialWeight),
});

export const createLabelModalHandlers = ({
    form,
    initialColor,
    initialFactor,
    initialWeight,
    onOk,
    setSubmitting,
}) => ({
    handleOk: async () => {
        try {
            const values = await form.validateFields();
            const submission = buildLabelSubmission({ values, initialColor, initialFactor, initialWeight });
            const value = submission.value;
            if (!value) return;

            setSubmitting(true);
            await onOk?.({
                ...submission,
            });
            form.resetFields();
        } finally {
            setSubmitting(false);
        }
    },
});
