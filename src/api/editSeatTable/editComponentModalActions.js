import { Modal } from "antd";

export function createEditComponentModalHandlers(deps) {
    const {
        selectedItem,
        isDraftBigGroup,
        draftSmallGroups,
        setDraftSmallGroups,
        elements,
        onElementsChange,
        allocId,
        canvasWidth,
        canvasHeight,
        form,
        editingSgId,
        setSgModalVisible,
        setEditingSgId
    } = deps;

    const getChildSeats = (sgId) => {
        return elements.filter(e => e.type === 'seat' && e.parentId === sgId);
    };

    const getDraftSeats = (sgId) => {
        const sg = draftSmallGroups.find(item => item.id === sgId);
        return Array.isArray(sg?.seats) ? sg.seats : [];
    };

    const handleAddSg = (values) => {
        if (!allocId) return;

        const newSgId = allocId('small_group', selectedItem.id);
        const sgItem = {
            id: newSgId,
            type: 'small_group',
            name: values.name || `小组 ${newSgId}`,
            parentId: selectedItem.id,
            membersPerColumn: Number(values.membersPerColumn) || 6,
            color: values.color || '#ff4d4f'
        };

        const seatCount = Number(values.membersPerColumn) || 6;
        const seats = Array.from({ length: seatCount }, () => {
            const seatId = allocId('seat', newSgId);
            return {
                id: seatId,
                type: 'seat',
                name: `座位 ${seatId}`,
                parentId: newSgId,
                color: values.color || '#ff4d4f'
            };
        });

        if (isDraftBigGroup) {
            setDraftSmallGroups(prev => [...prev, { ...sgItem, seats }]);
        } else if (onElementsChange) {
            onElementsChange(prev => [...prev, sgItem, ...seats]);
        }

        setSgModalVisible?.(false);
        setEditingSgId?.(null);
    };

    const handleEditSg = (values) => {
        if (!isDraftBigGroup && !onElementsChange) return;

        const sgId = selectedItem?.type === 'small_group' ? selectedItem.id : deps.editingSgId;
        const newMembersPerColumn = Number(values.membersPerColumn) || 6;
        const currentSeats = isDraftBigGroup ? getDraftSeats(sgId) : getChildSeats(sgId);

        const applyUpdate = (prev) => {
            const updated = prev.map(e => {
                if (e.id === sgId && e.type === 'small_group') {
                    return {
                        ...e,
                        name: values.name || e.name,
                        membersPerColumn: newMembersPerColumn,
                        color: values.color || e.color
                    };
                }
                return e;
            });

            if (currentSeats.length !== newMembersPerColumn) {
                if (currentSeats.length > newMembersPerColumn) {
                    const removeIds = new Set(currentSeats.slice(newMembersPerColumn).map(s => s.id));
                    return updated.filter(e => !removeIds.has(e.id));
                }
                const newSeats = [];
                for (let s = currentSeats.length; s < newMembersPerColumn; s++) {
                    const newSeatId = allocId('seat', sgId);
                    newSeats.push({
                        id: newSeatId,
                        type: 'seat',
                        name: `座位 ${newSeatId}`,
                        parentId: sgId,
                        color: values.color || '#ff4d4f'
                    });
                }
                return [...updated, ...newSeats];
            }

            return updated;
        };

        if (isDraftBigGroup) {
            setDraftSmallGroups(prev => prev.map(sg => {
                if (sg.id !== sgId) return sg;

                let nextSeats = Array.isArray(sg.seats) ? [...sg.seats] : [];
                if (nextSeats.length > newMembersPerColumn) {
                    nextSeats = nextSeats.slice(0, newMembersPerColumn);
                } else if (nextSeats.length < newMembersPerColumn) {
                    for (let s = nextSeats.length; s < newMembersPerColumn; s++) {
                        const newSeatId = allocId('seat', sgId);
                        nextSeats.push({
                            id: newSeatId,
                            type: 'seat',
                            name: `座位 ${newSeatId}`,
                            parentId: sgId,
                            color: values.color || sg.color || '#ff4d4f'
                        });
                    }
                }

                return {
                    ...sg,
                    name: values.name || sg.name,
                    membersPerColumn: newMembersPerColumn,
                    color: values.color || sg.color,
                    seats: nextSeats,
                };
            }));
        } else {
            onElementsChange(applyUpdate);
        }

        setSgModalVisible?.(false);
        setEditingSgId?.(null);
    };

    const handleDeleteSg = (sgId) => {
        if (!isDraftBigGroup && !onElementsChange) return;

        Modal.confirm({
            title: '删除确认',
            content: '删除小组将同时删除该小组下的所有座位，确定继续吗？',
            okText: '确定',
            okType: 'danger',
            cancelText: '取消',
            onOk: () => {
                if (isDraftBigGroup) {
                    setDraftSmallGroups(prev => prev.filter(sg => sg.id !== sgId));
                } else {
                    onElementsChange(prev => {
                        const seatIds = new Set(prev.filter(e => e.type === 'seat' && e.parentId === sgId).map(s => s.id));
                        seatIds.add(sgId);
                        return prev.filter(e => !seatIds.has(e.id));
                    });
                }
            }
        });
    };

    const handleCenterPos = (type) => {
        if (!selectedItem) return;
        const w = form.getFieldValue("width") || 100;
        const h = form.getFieldValue("height") || 50;
        let x = form.getFieldValue("x") || 0;
        let y = form.getFieldValue("y") || 0;

        switch (type) {
            case "top":
                x = (canvasWidth - w) / 2;
                y = 20;
                break;
            case "bottom":
                x = (canvasWidth - w) / 2;
                y = canvasHeight - h - 20;
                break;
            case "left":
                x = 20;
                y = (canvasHeight - h) / 2;
                break;
            case "right":
                x = canvasWidth - w - 20;
                y = (canvasHeight - h) / 2;
                break;
            case "center":
                x = (canvasWidth - w) / 2;
                y = (canvasHeight - h) / 2;
                break;
            default:
                break;
        }
        form.setFieldsValue({ x, y });
    };

    const handleAddSingleSeat = (sgId) => {
        if (!allocId) return;
        const seatId = allocId('seat', sgId);
        const sg = isDraftBigGroup
            ? draftSmallGroups.find(e => e.id === sgId)
            : elements.find(e => e.id === sgId && e.type === 'small_group');

        const seat = {
            id: seatId,
            type: 'seat',
            name: `座位 ${seatId}`,
            parentId: sgId,
            color: sg?.color || '#ff4d4f'
        };

        if (isDraftBigGroup) {
            setDraftSmallGroups(prev => prev.map(item => item.id === sgId
                ? { ...item, seats: [...(item.seats || []), seat] }
                : item));
            return;
        }

        if (onElementsChange) {
            onElementsChange(prev => [...prev, seat]);
        }
    };

    const handleDeleteSeat = (seatId) => {
        if (isDraftBigGroup) {
            setDraftSmallGroups(prev => prev.map(sg => ({
                ...sg,
                seats: (sg.seats || []).filter(seat => seat.id !== seatId),
            })));
            return;
        }
        if (!onElementsChange) return;
        onElementsChange(prev => prev.filter(e => e.id !== seatId));
    };

    const handleSyncSeatColors = (sgId, color) => {
        if (isDraftBigGroup) {
            setDraftSmallGroups(prev => prev.map(sg => {
                if (sg.id !== sgId) return sg;
                return {
                    ...sg,
                    color,
                    seats: (sg.seats || []).map(seat => ({ ...seat, color })),
                };
            }));
            return;
        }
        if (!onElementsChange) return;
        onElementsChange(prev => prev.map(e => {
            if ((e.id === sgId && e.type === 'small_group') ||
                (e.parentId === sgId && e.type === 'seat')) {
                return { ...e, color };
            }
            return e;
        }));
    };

    return {
        handleAddSg,
        handleEditSg,
        handleDeleteSg,
        handleCenterPos,
        handleAddSingleSeat,
        handleDeleteSeat,
        handleSyncSeatColors
    };
}
