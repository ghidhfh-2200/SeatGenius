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
