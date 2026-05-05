export function createFabricCanvasHandlers({ elementsRef, onSelectItem }) {
    const handleSelect = (evt) => {
        const target = evt?.selected?.[0] || evt?.target;
        const id = target?.data?.id;
        if (id == null) return;
        const item = elementsRef.current.find(e => e.id === id);
        if (item) onSelectItem?.(item);
    };

    const handleClear = () => {
        onSelectItem?.(null);
    };

    return { handleSelect, handleClear };
}
