const getNumber = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeClassroomPayload = (payload, fallbackConfig = {}) => {
    const classroomData = payload?.classroom_data || payload?.classroomData || {};
    const config = {
        ...fallbackConfig,
        ...(classroomData.config || {})
    };

    const elements = Array.isArray(classroomData.elements) ? classroomData.elements : [];
    const canvasWidth = getNumber(classroomData.canvasWidth, config.CANVAS_WIDTH || fallbackConfig.CANVAS_WIDTH || 1200);
    const canvasHeight = getNumber(classroomData.canvasHeight, config.CANVAS_HEIGHT || fallbackConfig.CANVAS_HEIGHT || 800);
    const mode = classroomData.mode || 'classic';
    const name = classroomData.name || payload?.name || '';
    const idLogs = Array.isArray(classroomData.idLogs) ? classroomData.idLogs : [];

    return {
        sgid: payload?.sgid || '',
        name,
        mode,
        canvasWidth,
        canvasHeight,
        config,
        elements,
        savedElements: elements,
        previewSvg: payload?.preview_svg || null,
        isBroken: Boolean(payload?.is_broken),
        problemMessage: payload?.problem_message || null,
        createTime: payload?.create_time || '',
        idLogs  // 传递ID日志
    };
};

export { normalizeClassroomPayload };
