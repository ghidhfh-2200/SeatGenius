import {
    createDefaultPositionRewards,
    createDefaultSpecialRewards,
    createDefaultAdjacencyRewards,
    createDefaultFactorRangeRewards,
    normalizeValue,
    resolveClassroomPosition,
} from './conditionUtils';

const calculateRow = (y) => Math.floor(y / 80) + 1;
const calculateCol = (x) => Math.floor(x / 80) + 1;

const identifySeats = (elements, config = {}) => {
    const seats = [];
    const seatTypes = ['seat', 'chair'];

    elements.forEach(el => {
        if (seatTypes.includes(el.type)) {
            const pos = resolveClassroomPosition(el, elements, config);
            seats.push({
                id: el.id,
                type: el.type,
                x: pos.x,
                y: pos.y,
                width: el.width || 0,
                height: el.height || 0,
                label: `${el.type}_${el.id}`,
                row: calculateRow(pos.y),
                col: calculateCol(pos.x),
            });
        }
    });

    return seats.sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    });
};

const getRowZone = (row) => {
    if (row <= 2) return 'front';
    if (row <= 4) return 'mid_front';
    if (row <= 6) return 'middle';
    if (row <= 8) return 'mid_back';
    return 'back';
};

const getColZone = (col, seats) => {
    const totalCols = Math.max(...seats.map(s => s.col));
    const third = Math.ceil(totalCols / 3);
    if (col <= third) return 'left';
    if (col <= third * 2) return 'center';
    return 'right';
};

export const createConditionSettingsHandlers = (deps) => {
    const {
        conditions,
        positionRewards,
        specialRewards,
        factorRewards,
        adjacencyRewards,
        seatRewards,
        seats,
        selectedClassroom,
        selectedFactor,
        editingFactorRange,
        factorRangeForm,
        onSave,
        onCancel,
        invoke,
        message,
        setClassroomLoading,
        setClassrooms,
        setSelectedClassroom,
        setSeats,
        setSeatRewards,
        setPositionRewards,
        setSpecialRewards,
        setFactorRewards,
        setAdjacencyRewards,
        setSelectedFactor,
        setFactorRangeModalOpen,
        setEditingFactorRange,
    } = deps;

    const loadClassrooms = async () => {
        setClassroomLoading(true);
        try {
            const data = await invoke('get_dashboard_records');
            const classroomRecords = Array.isArray(data) ? data : [];
            const classroomsOnly = classroomRecords.filter(record => record.data_file_exists !== false);
            setClassrooms(classroomsOnly);
        } catch (error) {
            console.error('加载教室列表失败', error);
            message.error('加载教室列表失败：' + String(error));
        } finally {
            setClassroomLoading(false);
        }
    };

    const handleSelectClassroom = async (classroom) => {
        setSelectedClassroom(classroom);
        setSeats([]);
        setSeatRewards({});
        setClassroomLoading(true);
        try {
            const payload = await invoke('load_classroom', { sgid: classroom.sgid });
            const classroomData = payload?.classroom_data || {};
            const elements = classroomData.elements || [];
            const config = classroomData.config || {};

            if (!elements || elements.length === 0) {
                message.warning('该教室数据中没有找到任何元素');
                return;
            }

            const identifiedSeats = identifySeats(elements, config);
            setSeats(identifiedSeats);

            if (identifiedSeats.length === 0) {
                message.warning('未识别到座位元素，请确认教室中包含 seat/chair/desk 类型的元素');
                return;
            }

            const initialRewards = {};
            identifiedSeats.forEach(seat => {
                initialRewards[seat.id] = 0.5;
            });
            setSeatRewards(initialRewards);

            message.success(`成功识别 ${identifiedSeats.length} 个座位`);
        } catch (error) {
            console.error('识别座位失败', error);
            message.error('识别座位失败：' + String(error));
        } finally {
            setClassroomLoading(false);
        }
    };

    const handleSeatRewardChange = (seatId, value) => {
        setSeatRewards(prev => ({
            ...prev,
            [seatId]: normalizeValue(value),
        }));
    };

    const handleBatchSetRewards = (value) => {
        const newRewards = {};
        seats.forEach(seat => {
            newRewards[seat.id] = normalizeValue(value);
        });
        setSeatRewards(newRewards);
        message.success(`已将所有座位奖励值设置为 ${value.toFixed(2)}`);
    };

    const handleBatchSetByZone = (rowZone, colZone, value) => {
        const newRewards = { ...seatRewards };
        seats.forEach(seat => {
            const seatRowZone = getRowZone(seat.row);
            const seatColZone = getColZone(seat.col, seats);
            if (seatRowZone === rowZone && seatColZone === colZone) {
                newRewards[seat.id] = normalizeValue(value);
            }
        });
        setSeatRewards(newRewards);
        message.success(`已将 ${rowZone}-${colZone} 区域座位奖励值设置为 ${value.toFixed(2)}`);
    };

    const handlePositionChange = (key, value) => {
        setPositionRewards(prev => ({ ...prev, [key]: normalizeValue(value) }));
    };

    const handleSpecialChange = (key, value) => {
        setSpecialRewards(prev => ({ ...prev, [key]: normalizeValue(value) }));
    };

    const handleSelectFactor = (factorKey) => {
        setSelectedFactor(factorKey);
        if (!factorRewards[factorKey]) {
            setFactorRewards(prev => ({
                ...prev,
                [factorKey]: createDefaultFactorRangeRewards(factorKey),
            }));
        }
    };

    const handleAddFactorRange = () => {
        if (!selectedFactor) return;
        setEditingFactorRange(null);
        factorRangeForm.resetFields();
        factorRangeForm.setFieldsValue({
            min: 0,
            max: 1,
            label: '',
            reward: 0.5,
        });
        setFactorRangeModalOpen(true);
    };

    const handleEditFactorRange = (rangeIndex) => {
        const ranges = factorRewards[selectedFactor] || [];
        const range = ranges[rangeIndex];
        if (!range) return;
        setEditingFactorRange(rangeIndex);
        factorRangeForm.setFieldsValue({
            min: range.min,
            max: range.max,
            label: range.label,
            reward: range.reward,
        });
        setFactorRangeModalOpen(true);
    };

    const handleDeleteFactorRange = (rangeIndex) => {
        if (!selectedFactor) return;
        setFactorRewards(prev => ({
            ...prev,
            [selectedFactor]: (prev[selectedFactor] || []).filter((_, i) => i !== rangeIndex),
        }));
    };

    const handleSaveFactorRange = () => {
        if (!selectedFactor) return;
        const values = factorRangeForm.getFieldsValue();
        const min = Number(values.min);
        const max = Number(values.max);
        const label = String(values.label || '').trim();
        const reward = normalizeValue(values.reward);

        if (min < 0 || min > 1 || max < 0 || max > 1) {
            message.warning('区间值范围应在 0~1 之间');
            return;
        }
        if (min > max) {
            message.warning('最小值不能大于最大值');
            return;
        }
        if (!label) {
            message.warning('请输入区间标签');
            return;
        }

        const newRange = { min, max, label, reward, id: `${selectedFactor}-${min}-${max}-${Date.now()}` };

        setFactorRewards(prev => {
            const current = [...(prev[selectedFactor] || [])];
            if (editingFactorRange !== null) {
                current[editingFactorRange] = newRange;
            } else {
                current.push(newRange);
            }
            return { ...prev, [selectedFactor]: current };
        });

        setFactorRangeModalOpen(false);
        setEditingFactorRange(null);
        factorRangeForm.resetFields();
    };

    const handleAdjacencyChange = (key, value) => {
        setAdjacencyRewards(prev => ({ ...prev, [key]: normalizeValue(value) }));
    };

    const handleSave = () => {
        const data = {
            positionRewards,
            specialRewards,
            factorRewards,
            adjacencyRewards,
            seatRewards,
            seatIds: seats.map(seat => String(seat.id)),
            classroomSgid: selectedClassroom?.sgid || null,
        };
        onSave?.(data);
        onCancel?.();
    };

    const handleResetAll = () => {
        setPositionRewards(createDefaultPositionRewards());
        setSpecialRewards(createDefaultSpecialRewards());
        setFactorRewards({});
        setAdjacencyRewards(createDefaultAdjacencyRewards());
        setSeatRewards({});
        setSeats([]);
        setSelectedClassroom(null);
        message.success('已重置所有奖励值');
    };

    return {
        loadClassrooms,
        handleSelectClassroom,
        handleSeatRewardChange,
        handleBatchSetRewards,
        handleBatchSetByZone,
        handlePositionChange,
        handleSpecialChange,
        handleSelectFactor,
        handleAddFactorRange,
        handleEditFactorRange,
        handleDeleteFactorRange,
        handleSaveFactorRange,
        handleAdjacencyChange,
        handleSave,
        handleResetAll,
    };
};
