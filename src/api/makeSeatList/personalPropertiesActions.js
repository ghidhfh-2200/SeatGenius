import { createDefaultFactors, normalizeWeight } from './factorUtils';

export const createPersonalPropertiesHandlers = (deps) => {
    const {
        selectedName,
        currentFactors,
        allData,
        labels,
        setCurrentFactors,
        setAllData,
        setLabelLoadOpen,
        message,
        onSave,
        onCancel,
    } = deps;

    const handleFactorChange = (factorKey, value) => {
        setCurrentFactors(prev => ({ ...prev, [factorKey]: value }));
    };

    const handleSavePerson = () => {
        if (!selectedName || !currentFactors) return;

        setAllData(prev => {
            const idx = prev.findIndex(d => d.name === selectedName);
            const entry = { name: selectedName, factors: { ...currentFactors } };
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = entry;
                return next;
            }
            return [...prev, entry];
        });
        message.success(`已保存「${selectedName}」的个人属性`);
    };

    const handleLoadFromLabel = () => {
        if (!labels || labels.length === 0) {
            message.warning('暂无可用标签，请先在标签编辑器中创建标签');
            return;
        }
        setLabelLoadOpen(true);
    };

    const confirmLoadLabel = (label) => {
        if (!currentFactors) return;
        setCurrentFactors(prev => ({
            ...prev,
            [label.factor]: normalizeWeight(label.weight ?? 0.5),
        }));
        setLabelLoadOpen(false);
        message.success(`已从标签「${label.name}」加载权重 ${label.weight?.toFixed(2) || 0.5}`);
    };

    const handleResetFactors = () => {
        if (!selectedName) return;
        setCurrentFactors(createDefaultFactors());
    };

    const handleRemovePerson = () => {
        if (!selectedName) return;
        setAllData(prev => prev.filter(d => d.name !== selectedName));
        setCurrentFactors(createDefaultFactors());
        message.success(`已移除「${selectedName}」的数据`);
    };

    const handleSaveAll = () => {
        let updated = allData;

        if (selectedName && currentFactors) {
            const idx = allData.findIndex(d => d.name === selectedName);
            const entry = { name: selectedName, factors: { ...currentFactors } };
            if (idx >= 0) {
                updated = [...allData];
                updated[idx] = entry;
            } else {
                updated = [...allData, entry];
            }
            setAllData(updated);
        }

        onSave?.(updated);
        onCancel?.();
    };

    return {
        handleFactorChange,
        handleSavePerson,
        handleLoadFromLabel,
        confirmLoadLabel,
        handleResetFactors,
        handleRemovePerson,
        handleSaveAll,
    };
};
