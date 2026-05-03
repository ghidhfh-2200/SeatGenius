/**
 * 全局唯一数字ID生成器
 * 
 * ID生成策略：
 * - 使用单调递增计数器，从0开始
 * - 每次分配ID时记录日志：{ id, type, parentId, timestamp }
 * - ID在整个教室范围内唯一，不依赖元素类型
 * - nextId 持久化存储在教室数据中，保证跨会话稳定性
 * - 兼容旧数据格式：加载时自动将nextId设置为当前最大ID+1
 */

/**
 * 生成一个新ID（不记录日志，用于初始化等场景）
 * @param {number} nextId - 当前计数器值
 * @returns {number} 新ID
 */
export const generateId = (nextId) => {
    return nextId;
};

/**
 * 生成新ID并记录日志
 * @param {number} nextId - 当前计数器值
 * @param {string} type - 元素类型 (big_group/small_group/seat/...)
 * @param {number|null} parentId - 父元素ID
 * @param {Array} logs - 现有日志数组（会被修改）
 * @returns {{ id: number, nextId: number }} 新ID和更新后的计数器
 */
export const generateIdWithLog = (nextId, type, parentId = null, logs = []) => {
    const id = nextId;
    const logEntry = {
        id,
        type,
        parentId,
        timestamp: new Date().toISOString()
    };
    logs.push(logEntry);
    return { id, nextId: nextId + 1 };
};

/**
 * 批量生成子元素ID
 * @param {number} nextId - 当前计数器值
 * @param {string} type - 子元素类型
 * @param {number} parentId - 父元素ID
 * @param {number} count - 生成数量
 * @param {Array} logs - 日志数组
 * @returns {{ ids: number[], nextId: number }}
 */
export const batchGenerateIds = (nextId, type, parentId, count, logs = []) => {
    const ids = [];
    let current = nextId;
    for (let i = 0; i < count; i++) {
        const entry = {
            id: current,
            type,
            parentId,
            timestamp: new Date().toISOString()
        };
        logs.push(entry);
        ids.push(current);
        current++;
    }
    return { ids, nextId: current };
};

/**
 * 从元素数组中计算最大ID，用于初始化nextId
 * @param {Array} elements - 元素数组
 * @returns {number} 最大ID+1（如果无元素则返回0）
 */
export const computeNextId = (elements) => {
    return elements.reduce((maxId, item) => {
        const numericId = Number(item.id);
        return Number.isFinite(numericId) ? Math.max(maxId, numericId + 1) : maxId;
    }, 0);
};

/**
 * 从旧格式big_group中迁移数据到新格式
 * 旧格式：big_group.smallGroups = [{ sgId, customId, membersPerColumn, color }]
 * 新格式：small_group和seat作为独立elements
 * @param {Array} elements - 原始元素数组
 * @param {number} startNextId - 起始计数器
 * @param {Array} logs - 日志数组
 * @returns {{ elements: Array, nextId: number, logs: Array }}
 */
export const migrateOldFormat = (elements, startNextId = 0, logs = []) => {
    const newElements = [];
    let nextId = startNextId;

    for (const el of elements) {
        if (el.type === 'big_group' && Array.isArray(el.smallGroups) && el.smallGroups.length > 0) {
            // 保留big_group本体，移除smallGroups字段
            const { smallGroups, ...bigGroup } = el;
            // 确保big_group有数字ID
            if (!Number.isFinite(Number(bigGroup.id))) {
                const { id, ...rest } = bigGroup;
                bigGroup.id = nextId;
                logs.push({ id: nextId, type: 'big_group', parentId: null, timestamp: new Date().toISOString() });
                nextId++;
                Object.assign(bigGroup, rest);
            }
            newElements.push(bigGroup);

            // 为每个smallGroup创建独立对象
            for (const sg of smallGroups) {
                const sgId = nextId;
                logs.push({ id: sgId, type: 'small_group', parentId: Number(bigGroup.id), timestamp: new Date().toISOString() });
                nextId++;

                const newSg = {
                    id: sgId,
                    type: 'small_group',
                    name: `小组 ${sgId}`,
                    parentId: Number(bigGroup.id),
                    membersPerColumn: Number(sg.membersPerColumn) || 6,
                    color: sg.color || '#ff4d4f'
                };
                newElements.push(newSg);

                // 为每个座位创建独立对象
                const seatCount = Number(sg.membersPerColumn) || 6;
                for (let s = 0; s < seatCount; s++) {
                    const seatId = nextId;
                    logs.push({ id: seatId, type: 'seat', parentId: sgId, timestamp: new Date().toISOString() });
                    nextId++;

                    newElements.push({
                        id: seatId,
                        type: 'seat',
                        name: `座位 ${seatId}`,
                        parentId: sgId,
                        color: sg.color || '#ff4d4f'
                    });
                }
            }
        } else {
            // 非big_group元素，直接保留
            // 确保有数字ID
            if (!Number.isFinite(Number(el.id))) {
                const newEl = { ...el, id: nextId };
                logs.push({ id: nextId, type: el.type, parentId: null, timestamp: new Date().toISOString() });
                nextId++;
                newElements.push(newEl);
            } else {
                newElements.push({ ...el });
            }
        }
    }

    return { elements: newElements, nextId, logs };
};

/**
 * 从元素数组中获取一个元素的所有子元素
 * @param {Array} elements - 元素数组
 * @param {number} parentId - 父元素ID
 * @returns {Array} 子元素数组
 */
export const getChildren = (elements, parentId) => {
    return elements.filter(el => el.parentId === parentId);
};

/**
 * 构建Ant Design Tree组件所需的数据结构
 * @param {Array} elements - 所有元素数组
 * @param {Object} typeNames - 类型名称映射
 * @returns {Array} Tree data
 */
export const buildTreeData = (elements, typeNames) => {
    const bigGroups = elements.filter(e => e.type === 'big_group');
    const smallGroups = elements.filter(e => e.type === 'small_group');
    const seats = elements.filter(e => e.type === 'seat');

    // 构建children map
    const sgMap = {};
    smallGroups.forEach(sg => {
        if (!sgMap[sg.parentId]) sgMap[sg.parentId] = [];
        sgMap[sg.parentId].push(sg);
    });

    const seatMap = {};
    seats.forEach(s => {
        if (!seatMap[s.parentId]) seatMap[s.parentId] = [];
        seatMap[s.parentId].push(s);
    });

    return bigGroups.map(bg => ({
        title: `${bg.name || typeNames?.big_group || '大组'} (ID: ${bg.id})`,
        key: `bg-${bg.id}`,
        type: 'big_group',
        id: bg.id,
        origin: bg,
        children: (sgMap[bg.id] || []).map(sg => ({
            title: `${sg.name || typeNames?.small_group || '小组'} (ID: ${sg.id})`,
            key: `sg-${sg.id}`,
            type: 'small_group',
            id: sg.id,
            origin: sg,
            children: (seatMap[sg.id] || []).map(s => ({
                title: `${s.name || typeNames?.seat || '座位'} (ID: ${s.id})`,
                key: `s-${s.id}`,
                type: 'seat',
                id: s.id,
                origin: s,
                isLeaf: true
            }))
        }))
    }));
};
