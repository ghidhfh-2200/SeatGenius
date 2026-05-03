import { normalizeLoadedLabels } from './factorUtils';

export const buildRewardConfigEntry = (data) => ({
    _isRewardConfig: true,
    id: 'reward-config',
    name: '奖励配置（综合）',
    positionRewards: data?.positionRewards || {},
    specialRewards: data?.specialRewards || {},
    factorRewards: data?.factorRewards || {},
    adjacencyRewards: data?.adjacencyRewards || {},
    customConditions: data?.customConditions || [],
    seatRewards: data?.seatRewards || {},
    seatIds: data?.seatIds || [],
    classroomSgid: data?.classroomSgid,
});

export const buildRewardCalculationPayload = (rewardConfig, personalAttrs = []) => ({
    reward_config: {
        position_rewards: rewardConfig?.positionRewards || {},
        special_rewards: rewardConfig?.specialRewards || {},
        factor_rewards: rewardConfig?.factorRewards || {},
        adjacency_rewards: rewardConfig?.adjacencyRewards || {},
        seat_rewards: rewardConfig?.seatRewards || {},
        custom_conditions: (rewardConfig?.customConditions || []).map((item) => ({
            name: item.name,
            reward: item.reward,
        })),
    },
    students: personalAttrs.map((person) => ({
        name: person.name,
        factors: person.factors || {},
    })),
    seat_layout: (() => {
        const seatRewards = rewardConfig?.seatRewards || {};
        const totalSeats = Object.keys(seatRewards).length;
        return totalSeats > 0
            ? { total_seats: totalSeats }
            : { rows: 5, cols: 3, total_seats: 15 };
    })(),
});

export const buildEvolutionPayload = ({
    classroom,
    names = [],
    personalAttrs = [],
    conditions = [],
    rewardConfig,
}) => ({
    classroom_sgid: classroom?.sgid || '',
    classroom_name: classroom?.name || '未命名教室',
    names,
    personal_attrs: personalAttrs,
    conditions,
    seat_ids: rewardConfig?.seatIds || Object.keys(rewardConfig?.seatRewards || {}),
    generations: 1000,
    pop_size: 300,
    mutpb: 0.3,
    cxpb: 0.8,
});

export const buildProfileData = ({ rewardConfig, names = [], personalAttrs = [], conditions = [], labels = [] }) => ({
    position_rewards: rewardConfig?.positionRewards || {},
    special_rewards: rewardConfig?.specialRewards || {},
    factor_rewards: rewardConfig?.factorRewards || {},
    adjacency_rewards: rewardConfig?.adjacencyRewards || {},
    seat_rewards: rewardConfig?.seatRewards || {},
    classroom_sgid: rewardConfig?.classroomSgid || null,
    names,
    personal_attrs: personalAttrs,
    conditions,
    labels,
});

export const applyLoadedProfileData = (data) => ({
    names: Array.isArray(data?.names) ? data.names : null,
    personalAttrs: Array.isArray(data?.personal_attrs) ? data.personal_attrs : null,
    conditions: Array.isArray(data?.conditions) ? data.conditions : null,
    labels: Array.isArray(data?.labels) ? normalizeLoadedLabels({ labels: data.labels }) : null,
});

export const getRewardConfigStats = (item) => {
    if (!item?._isRewardConfig) return null;
    return {
        factorCount: Object.keys(item.factorRewards || {}).length,
        adjacencyCount: Object.keys(item.adjacencyRewards || {}).length,
        customCount: (item.customConditions || []).length,
        seatCount: Object.keys(item.seatRewards || {}).length,
    };
};
