import { Modal } from "antd";

const DEFAULT_COLORS = {
    chair: "#ff4d4f",
    platform: "#1677ff",
    desk: "#52c41a",
    window: "#13c2c2",
    door: "#fa8c16",
    multimedia: "#722ed1",
    reserved: "#d9d9d9",
    big_group: "#d9d9d9",
    small_group: "#ff4d4f",
    seat: "#ff4d4f",
    aisle: "#f0f0f0"
};

export function createNewClassroomHandlers(deps) {
    const {
        svgRef,
        fabricCanvasRef,
        crosshairHRef,
        crosshairVRef,
        coordsRef,
        crosshairGroupRef,
        isResizingRef,
        mode,
        elements,
        savedElements,
        selectedListIds,
        selectedItem,
        exportName,
        isPanelCollapsed,
        allocId,
        getChildElements,
        setPanelWidth,
        setMode,
        setIsPanelCollapsed,
        setIsCompactTabs,
        setIsModalVisible,
        setSelectedItem,
        setElements,
        setSavedElements,
        setExportName,
        setIsExportModalVisible,
        setExportLoading,
        setSelectedListIds,
        setNextId,
        nextIdRef,
        idLogsRef,
        canvasWidth,
        config,
        CANVAS_HEIGHT,
        message,
        invoke,
        navigate,
        showModeSwitchConfirm,
        showDeleteSelectedConfirm,
        showIdLogsInfo
    } = deps;

    const handleSvgMouseMove = (clientX, clientY) => {
        if (!svgRef?.current || !crosshairHRef?.current || !crosshairVRef?.current || !coordsRef?.current || !crosshairGroupRef?.current) return;
        const pt = svgRef.current.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const svgP = pt.matrixTransform(svgRef.current.getScreenCTM().inverse());

        const x = Math.round(svgP.x);
        const y = Math.round(svgP.y);

        crosshairHRef.current.setAttribute("y1", svgP.y);
        crosshairHRef.current.setAttribute("y2", svgP.y);
        crosshairVRef.current.setAttribute("x1", svgP.x);
        crosshairVRef.current.setAttribute("x2", svgP.x);

        coordsRef.current.textContent = `X: ${x} , Y: ${y}`;
        crosshairGroupRef.current.style.display = "block";
        coordsRef.current.style.display = "block";
    };

    const handleSvgMouseLeave = () => {
        if (!crosshairGroupRef?.current || !coordsRef?.current) return;
        crosshairGroupRef.current.style.display = "none";
        coordsRef.current.style.display = "none";
    };

    const handleMouseMove = (event) => {
        if (!isResizingRef?.current) return;
        const minWidth = 280;
        const maxWidth = 560;
        const nextWidth = window.innerWidth - event.clientX;
        const clampedWidth = Math.min(maxWidth, Math.max(minWidth, nextWidth));
        setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
        isResizingRef.current = false;
    };

    const handleModeChange = (newMode) => {
        if (elements.length > 0) {
            showModeSwitchConfirm({
                onOk: () => {
                    setElements([]);
                    setSavedElements([]);
                    setNextId(0);
                    nextIdRef.current = 0;
                    idLogsRef.current = [];
                    setMode(newMode);
                }
            });
        } else {
            setMode(newMode);
            setSavedElements([]);
        }
    };

    const handleCreate = (type) => {
        const newId = allocId(type);
        const isSidePositional = ["window", "door"].includes(type);
        const isMultimedia = type === "multimedia";
        const isClassicAutoPos = ["big_group", "aisle"].includes(type);

        const newItem = {
            id: newId,
            name: `${type} (新)`,
            type,
            color: DEFAULT_COLORS[type] || "#000",
            ...(!isSidePositional && !isClassicAutoPos && mode === "classic" ? { x: 0, y: 0 } : {}),
            ...(isSidePositional ? { side: "left", relativePos: 50 } : {}),
            ...(type !== "chair" && type !== "platform" && !isSidePositional && !isClassicAutoPos ? { width: 100, height: 50 } : {}),
            ...(type === "multimedia" ? { rotation: 0, side: "front", relativePos: 50 } : {}),
        };

        if (mode !== "classic" && ["platform", "desk"].includes(type)) {
            newItem.width = config[`${type.toUpperCase()}_WIDTH`];
            newItem.height = config[`${type.toUpperCase()}_HEIGHT`];
        }

        if (type === "platform" && mode === "classic") {
            newItem.width = config.PLATFORM_WIDTH;
            newItem.height = config.PLATFORM_HEIGHT;
        }

        if (isMultimedia) {
            newItem.width = config.MULTIMEDIA_WIDTH;
            newItem.height = config.MULTIMEDIA_HEIGHT;
            newItem.rx = config.MULTIMEDIA_RX;
        }

        if (isMultimedia && mode === "classic") {
            delete newItem.y;
            delete newItem.height;
            delete newItem.rotation;
            delete newItem.side;
            delete newItem.relativePos;
        }

        if (mode !== "classic") {
            setElements(prev => [...prev, newItem]);
            setSelectedItem(newItem);
            return;
        }

        if (type === "big_group") {
            setSelectedItem(newItem);
            setIsModalVisible(true);
            return;
        }

        setSelectedItem(newItem);
        setIsModalVisible(true);
    };

    const handleTreeSelect = (selectedKeys, info) => {
        if (!info.node || !info.node.origin) return;
        setSelectedItem(info.node.origin);
        setIsModalVisible(true);
    };

    const handleItemClick = (item) => {
        setSelectedItem(item);
        setIsModalVisible(true);
    };

    const handleModalCancel = () => {
        setIsModalVisible(false);
        setSelectedItem(null);
    };

    const handleModalOk = (values, extra = null) => {
        if (!selectedItem) {
            setIsModalVisible(false);
            return;
        }

        if (selectedItem.type === 'big_group') {
            const existingBigGroup = elements.find(e => e.id === selectedItem.id && e.type === 'big_group');
            const sgItems = Array.isArray(extra?.smallGroups)
                ? extra.smallGroups
                : (Array.isArray(selectedItem.smallGroups) ? selectedItem.smallGroups : []);

            const bigGroupPayload = { ...selectedItem, ...values };

            if (sgItems.length > 0) {
                const newElements = [bigGroupPayload];
                sgItems.forEach((sg) => {
                    newElements.push({ ...sg, parentId: bigGroupPayload.id, type: 'small_group' });
                    (sg.seats || []).forEach((seat) => {
                        newElements.push({ ...seat, parentId: sg.id, type: 'seat' });
                    });
                });

                setElements(prev => {
                    const rest = existingBigGroup
                        ? prev.filter(e => e.id !== bigGroupPayload.id && !(e.parentId === bigGroupPayload.id) && !sgItems.some(sg => sg.id === e.parentId))
                        : prev;
                    return [...rest, ...newElements];
                });
            } else {
                setElements(prev => {
                    if (!existingBigGroup) return [...prev, { ...bigGroupPayload }];
                    return prev.map(e => e.id === bigGroupPayload.id ? { ...e, ...bigGroupPayload } : e);
                });
            }
            setIsModalVisible(false);
            return;
        }

        setElements(prev => {
            const exists = prev.find(e => e.id === values.id);
            if (exists) {
                return prev.map(e => e.id === values.id ? { ...e, ...values } : e);
            }
            return [...prev, { ...selectedItem, ...values }];
        });
        setIsModalVisible(false);
    };

    const handleResizeMouseDown = (event) => {
        event.preventDefault();
        if (isPanelCollapsed) return;
        isResizingRef.current = true;
    };

    const toggleCompactTabs = () => {
        if (isPanelCollapsed) setIsPanelCollapsed(false);
        setIsCompactTabs(prev => !prev);
    };

    const togglePanelCollapsed = () => {
        setIsPanelCollapsed(prev => !prev);
    };

    const handleBackToHome = () => {
        const hasUnsavedChanges = elements.length > 0 && JSON.stringify(elements) !== JSON.stringify(savedElements);
        if (hasUnsavedChanges) {
            Modal.confirm({
                title: '是否退出？',
                content: '画布中有未保存的元素，退出将丢失当前进度。',
                okText: '确认退出',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk: () => navigate('/')
            });
        } else {
            navigate('/');
        }
    };

    const handleOpenExport = () => {
        if (elements.length === 0) {
            message.warning("当前没有可导出的对象");
            return;
        }

        setExportName(selectedItem?.name || "");
        setIsExportModalVisible(true);
    };

    const handleConfirmExport = async () => {
        const classroomName = exportName.trim();
        if (!classroomName) {
            message.warning("请输入教室名称");
            return;
        }

        if (mode === "classic" && !svgRef.current) {
            message.error("画布尚未准备好，无法导出");
            return;
        }
        if (mode !== "classic" && !fabricCanvasRef.current) {
            message.error("画布尚未准备好，无法导出");
            return;
        }

        const exportElements = savedElements.length > 0 ? savedElements : elements;
        const preview_svg = mode === "classic"
            ? new XMLSerializer().serializeToString(svgRef.current)
            : fabricCanvasRef.current?.exportSVG?.();

        if (!preview_svg) {
            message.error("导出失败：画布内容为空或无法生成预览");
            return;
        }

        setExportLoading(true);
        try {
            const result = await invoke("export_classroom", {
                payload: {
                    name: classroomName,
                    classroom_data: {
                        name: classroomName,
                        mode,
                        canvasWidth,
                        canvasHeight: CANVAS_HEIGHT,
                        elements: exportElements,
                        config,
                        idLogs: idLogsRef.current,
                    },
                    preview_svg,
                }
            });

            setSavedElements(exportElements);
            setIsExportModalVisible(false);
            message.success(`导出成功：${result?.data_file || classroomName}`);
        } catch (error) {
            console.error("导出失败", error);
            message.error("导出失败，请检查 Rust 端日志：" + String(error));
        } finally {
            setExportLoading(false);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedListIds.length === 0) return;

        const idsToDelete = new Set(selectedListIds);
        selectedListIds.forEach(id => {
            const children = getChildElements(id);
            children.forEach(child => {
                idsToDelete.add(child.id);
                const grandchildren = getChildElements(child.id);
                grandchildren.forEach(gc => idsToDelete.add(gc.id));
            });
            const seatChildren = getChildElements(id);
            seatChildren.forEach(sc => idsToDelete.add(sc.id));
        });

        showDeleteSelectedConfirm({
            selectedCount: selectedListIds.length,
            onOk: () => {
                setElements(prev => prev.filter(e => !idsToDelete.has(e.id)));
                setSelectedListIds([]);
            }
        });
    };

    const handleTreeCheck = (nodeId, checked) => {
        const id = Number(nodeId);
        if (checked) {
            const idsToAdd = [id];
            const children = getChildElements(id);
            children.forEach(child => {
                idsToAdd.push(child.id);
                const grandchildren = getChildElements(child.id);
                grandchildren.forEach(gc => idsToAdd.push(gc.id));
            });
            setSelectedListIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
        } else {
            const idsToRemove = new Set([id]);
            const children = getChildElements(id);
            children.forEach(child => {
                idsToRemove.add(child.id);
                const grandchildren = getChildElements(child.id);
                grandchildren.forEach(gc => idsToRemove.add(gc.id));
            });
            setSelectedListIds(prev => prev.filter(itemId => !idsToRemove.has(itemId)));
        }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedListIds(elements.map(el => el.id));
        } else {
            setSelectedListIds([]);
        }
    };

    return {
        handleSvgMouseMove,
        handleSvgMouseLeave,
        handleMouseMove,
        handleMouseUp,
        handleModeChange,
        handleCreate,
        handleTreeSelect,
        handleItemClick,
        handleModalCancel,
        handleModalOk,
        handleResizeMouseDown,
        toggleCompactTabs,
        togglePanelCollapsed,
        handleBackToHome,
        handleOpenExport,
        handleConfirmExport,
        handleDeleteSelected,
        handleTreeCheck,
        handleSelectAll,
    };
}
