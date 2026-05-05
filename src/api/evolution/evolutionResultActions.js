export const resolveClassroomSgidByName = async (invoke, name) => {
    if (!name) return '';
    try {
        const records = await invoke('get_dashboard_records');
        const list = Array.isArray(records) ? records : [];
        const exact = list.find((item) => item?.name === name && !item?.is_broken);
        if (exact?.sgid) return exact.sgid;
        const fuzzy = list.find((item) => String(item?.name || '').includes(name) && !item?.is_broken);
        return fuzzy?.sgid || '';
    } catch {
        return '';
    }
};

export const normalizeSeatOrder = (seatOrder, classroom) => {
    const raw = seatOrder || {};
    const seatIds = (classroom?.elements || [])
        .filter((item) => item.type === 'seat')
        .map((item) => String(item.id));
    const rawKeys = Object.keys(raw);

    const looksIndexed = rawKeys.length > 0
        && rawKeys.every((key) => /^\d+$/.test(String(key)))
        && seatIds.length > 0
        && rawKeys.some((key) => !seatIds.includes(String(key)));

    if (!looksIndexed) return raw;

    const mapped = {};
    seatIds.forEach((seatId, index) => {
        const studentName = raw[String(index)] ?? raw[index];
        if (studentName) mapped[seatId] = studentName;
    });
    return mapped;
};

export const createEvolutionResultHandlers = (deps) => {
    const {
        highlightSeat,
        studentToSeatIdMapRef,
        exportName,
        status,
        classroom,
        location,
        editableSeatOrder,
        setExporting,
        setExportModalOpen,
        setExportName,
        setEditableSeatOrder,
        setIsSeatOrderDirty,
        invoke,
        message,
    } = deps;

    const handleItemMouseEnter = (studentName) => {
        const seatId = studentToSeatIdMapRef.current?.[studentName];
        if (seatId) {
            highlightSeat(seatId);
        }
    };

    const handleItemMouseLeave = () => {
        highlightSeat(null);
    };

    const handleExport = async () => {
        const name = exportName.trim();
        if (!name) {
            message.warning('请输入座位表名称');
            return;
        }

        setExporting(true);
        try {
            const svgElement = document.querySelector('.evolution-result-svg');
            const previewSvg = svgElement ? new XMLSerializer().serializeToString(svgElement) : null;

            await invoke('export_seat_table', {
                payload: {
                    name,
                    classroom_name: status?.classroom_name || classroom?.name || '未命名教室',
                    classroom_sgid: status?.classroom_sgid || location.state?.classroomSgid || classroom?.sgid || '',
                    seat_order: editableSeatOrder,
                    preview_svg: previewSvg,
                },
            });

            message.success(`座位表「${name}」已导出成功！`);
            setExportModalOpen(false);
            setExportName('');
        } catch (err) {
            message.error('导出失败：' + String(err));
        } finally {
            setExporting(false);
        }
    };

    const handleSeatChange = (studentName, nextSeatId) => {
        setEditableSeatOrder((prev) => {
            const next = { ...(prev || {}) };
            const currentSeatId = Object.keys(next).find((id) => next[id] === studentName);

            if (currentSeatId === nextSeatId) return next;

            const existingStudent = next[nextSeatId];
            if (currentSeatId) {
                delete next[currentSeatId];
            }

            if (existingStudent && currentSeatId) {
                next[currentSeatId] = existingStudent;
            }

            next[nextSeatId] = studentName;
            return next;
        });
        setIsSeatOrderDirty(true);
    };

    return {
        handleItemMouseEnter,
        handleItemMouseLeave,
        handleExport,
        handleSeatChange,
    };
};
