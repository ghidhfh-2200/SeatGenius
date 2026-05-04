export const factorOptions = [
    { value: 'height', label: '身高相对值（0~1）' },
    { value: 'gender', label: '性别（男=0，女=1）' },
    { value: 'gender_gap', label: '性别隔阂度（用于同桌匹配，0~1）' },
    { value: 'social', label: '社交活跃度（0~1）' },
    { value: 'daydream', label: '上课走神（0~1）' },
    { value: 'sleep', label: '上课睡觉（0~1）' },
    { value: 'mobility', label: '行动自由度（0~1）' },
    { value: 'sensitivity', label: '视听敏感度（0~1）' },
    { value: 'score', label: '成绩（0~1）' },
];

export const factorLabelMap = Object.fromEntries(factorOptions.map((item) => [item.value, item.label]));

export const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const randomColor = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;

export const normalizeWeight = (value, fallback = 0.5) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(1, Math.max(0, numeric));
};

export const createDefaultFactors = (defaultWeight = 0.5) =>
    Object.fromEntries(factorOptions.map((factor) => [factor.value, defaultWeight]));

export const normalizeLoadedLabels = (payload) => {
    const raw = Array.isArray(payload?.labels) ? payload.labels : [];

    return raw
        .map((item) => ({
            id: createId(),
            name: String(item?.name || '').trim(),
            color: item?.color || randomColor(),
            factor: item?.factor || factorOptions[0].value,
            weight: normalizeWeight(item?.weight ?? 0.5),
        }))
        .filter((item) => item.name);
};
