export const buildPreviewSrc = (record) => {
    if (!record?.preview_svg) return null;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(record.preview_svg)}`;
};

export const filterBrokenRecordTitle = (record, fallbackTitle) => {
    if (record?.is_broken) {
        return record.problem_message || '此数据存在问题';
    }
    return fallbackTitle;
};
