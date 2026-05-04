export const ADJACENCY_TYPES = [
    {
        key: 'deskmate',
        label: '同桌',
        desc: '左右相邻的两人',
        subTypes: [
            { key: 'same_gender', label: '同性别', desc: '同桌两人性别相同', defaultValue: 0.7 },
            { key: 'diff_gender', label: '异性', desc: '同桌两人性别不同', defaultValue: 0.3 },
            { key: 'social_near', label: '社交亲近', desc: '同桌两人社交属性接近', defaultValue: 0.8 },
            { key: 'social_far', label: '社交疏远', desc: '同桌两人社交属性差异大', defaultValue: 0.3 },
            { key: 'score_gap', label: '成绩互助', desc: '同桌两人成绩差异较大', defaultValue: 0.7 },
        ],
    },
    {
        key: 'neighbor',
        label: '前后排',
        desc: '前后相邻的两人',
        subTypes: [
            { key: 'neighbor_same_gender', label: '同性别', desc: '前后两人性别相同', defaultValue: 0.6 },
            { key: 'neighbor_diff_gender', label: '异性', desc: '前后两人性别不同', defaultValue: 0.4 },
            { key: 'neighbor_social_near', label: '社交亲近', desc: '前后两人社交属性接近', defaultValue: 0.7 },
            { key: 'neighbor_social_far', label: '社交疏远', desc: '前后两人社交属性差异大', defaultValue: 0.3 },
            { key: 'neighbor_score_gap', label: '成绩互助', desc: '前后两人成绩差异较大', defaultValue: 0.6 },
        ],
    },
];

export const ROW_ZONES = [
    { key: 'front', label: '前排', desc: '靠近讲台的第1~2排', color: '#ff4d4f' },
    { key: 'mid_front', label: '中前', desc: '第3~4排', color: '#fa8c16' },
    { key: 'middle', label: '中排', desc: '中间第5~6排', color: '#1677ff' },
    { key: 'mid_back', label: '中后', desc: '第7~8排', color: '#722ed1' },
    { key: 'back', label: '后排', desc: '最后2排', color: '#13c2c2' },
];

export const COL_ZONES = [
    { key: 'left', label: '左侧', desc: '靠窗/走廊左侧', color: '#52c41a' },
    { key: 'center', label: '中间', desc: '教室中央区域', color: '#eb2f96' },
    { key: 'right', label: '右侧', desc: '靠窗/走廊右侧', color: '#fa541c' },
];

export const SPECIAL_POSITIONS = [
    { key: 'platform_near', label: '靠近讲台', desc: '紧邻讲台的前排座位', defaultValue: 0.8 },
    { key: 'window_side', label: '靠窗位置', desc: '窗户旁边的座位', defaultValue: 0.3 },
    { key: 'door_side', label: '靠门位置', desc: '门附近的座位', defaultValue: 0.2 },
    { key: 'corner', label: '角落位置', desc: '教室角落的座位', defaultValue: 0.1 },
];

export const FACTOR_OPTIONS = [
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

export const FACTOR_LABEL_MAP = Object.fromEntries(FACTOR_OPTIONS.map((factor) => [factor.value, factor.label]));

export const FACTOR_CONDITION_TEMPLATES = [
    { key: 'height', label: '身高', unit: '', thresholds: [0.3, 0.6] },
    { key: 'gender', label: '性别', unit: '', thresholds: [] },
    { key: 'gender_gap', label: '性别隔阂度', unit: '', thresholds: [0.3, 0.6] },
    { key: 'social', label: '社交活跃度', unit: '', thresholds: [0.3, 0.6] },
    { key: 'daydream', label: '上课走神', unit: '', thresholds: [0.3, 0.6] },
    { key: 'sleep', label: '上课睡觉', unit: '', thresholds: [0.3, 0.6] },
    { key: 'mobility', label: '行动自由度', unit: '', thresholds: [0.3, 0.6] },
    { key: 'sensitivity', label: '视听敏感度', unit: '', thresholds: [0.3, 0.6] },
    { key: 'score', label: '成绩', unit: '', thresholds: [0.3, 0.7] },
];

export const createDefaultPositionRewards = () => {
    const rewards = {};
    for (const row of ROW_ZONES) {
        for (const col of COL_ZONES) {
            rewards[`${row.key}_${col.key}`] = 0.5;
        }
    }
    return rewards;
};

export const createDefaultSpecialRewards = () => {
    const rewards = {};
    for (const item of SPECIAL_POSITIONS) {
        rewards[item.key] = item.defaultValue;
    }
    return rewards;
};

export const createDefaultAdjacencyRewards = () => ({
    same_gender: 0.7,
    diff_gender: 0.3,
    social_near: 0.8,
    social_far: 0.3,
    score_gap: 0.7,
    neighbor_same_gender: 0.6,
    neighbor_diff_gender: 0.4,
    neighbor_social_near: 0.7,
    neighbor_social_far: 0.3,
    neighbor_score_gap: 0.6,
});

export const createDefaultFactorRangeRewards = (factorKey) => {
    const template = FACTOR_CONDITION_TEMPLATES.find((item) => item.key === factorKey);
    if (!template) return [];

    if (factorKey === 'gender') {
        return [
            { min: 0, max: 0, label: '男性', reward: 0.5, id: `gender-male-${Date.now()}` },
            { min: 1, max: 1, label: '女性', reward: 0.5, id: `gender-female-${Date.now()}` },
        ];
    }

    const thresholds = template.thresholds;
    const low = thresholds[0] || 0.3;
    const high = thresholds[1] || 0.6;

    return [
        { min: 0, max: low, label: `低（0~${low.toFixed(2)}）`, reward: 0.3, id: `${factorKey}-0-${low}-${Date.now()}` },
        { min: low, max: high, label: `中（${low.toFixed(2)}~${high.toFixed(2)}）`, reward: 0.5, id: `${factorKey}-${low}-${high}-${Date.now()}` },
        { min: high, max: 1, label: `高（${high.toFixed(2)}~1）`, reward: 0.8, id: `${factorKey}-${high}-1-${Date.now()}` },
    ];
};

export const normalizeValue = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0.5;
};

export const getConfigNumber = (config, key, fallback) => {
    const value = Number(config?.[key]);
    return Number.isFinite(value) ? value : fallback;
};

export const getElementSize = (item, config = {}) => {
    switch (item?.type) {
        case 'platform':
            return {
                width: item.width || getConfigNumber(config, 'PLATFORM_WIDTH', 260),
                height: item.height || getConfigNumber(config, 'PLATFORM_HEIGHT', 80),
            };
        case 'big_group':
            return {
                width: item.width || 240,
                height: item.height || getConfigNumber(config, 'BIG_GROUP_HEIGHT', 420),
            };
        case 'aisle':
            return {
                width: item.width || getConfigNumber(config, 'AISLE_WIDTH', 40),
                height: item.height || getConfigNumber(config, 'AISLE_HEIGHT', 420),
            };
        default:
            return {
                width: item?.width || 80,
                height: item?.height || 60,
            };
    }
};

export const resolveClassroomPosition = (item, elements = [], config = {}) => {
    const itemX = Number(item?.x);
    const itemY = Number(item?.y);
    if (Number.isFinite(itemX) && Number.isFinite(itemY)) {
        return { x: itemX, y: itemY };
    }

    if (item?.type === 'big_group' || item?.type === 'aisle') {
        const platform = elements.find((element) => element.type === 'platform');
        const platformY = platform ? Number(platform.y) : NaN;
        const platformTopY = Number.isFinite(platformY) ? platformY : 20;
        const platformBottomY = platform ? (platformTopY + getElementSize(platform, config).height) : 20;
        const defaultStartY = platformBottomY + 40;
        let currentX = 24;

        for (const element of elements) {
            if (element.id === item.id) break;
            if (element.type === 'big_group' || element.type === 'aisle') {
                const elementX = Number(element.x);
                const actualX = Number.isFinite(elementX) ? elementX : currentX;
                const size = getElementSize(element, config);
                currentX = actualX + size.width + 8;
            }
        }

        return { x: currentX, y: defaultStartY };
    }

    return { x: 0, y: 0 };
};

export const parseConditions = (conditions) => {
    if (!Array.isArray(conditions)) return [];
    return conditions.filter(Boolean);
};
