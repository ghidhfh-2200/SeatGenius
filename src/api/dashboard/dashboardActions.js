export const buildPreviewSrc = (record) => {
    if (!record?.preview_svg) return null;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(record.preview_svg)}`;
};

export const filterBrokenRecordTitle = (record, fallbackTitle) => {
    if (record?.is_broken) {
        return record.problem_message || '此数据存在问题';
    }
    return fallbackTitle;
};

export const createDashboardHandlers = ({ invoke, message, setLoading, setSeatTables, setClassrooms }) => ({
    handleAction: (key, item, isSeatTable = false) => {
        if (key === 'delete') {
            setLoading(true);
            const command = isSeatTable ? 'delete_seat_table' : 'delete_classroom';
            const stateUpdater = isSeatTable ? setSeatTables : setClassrooms;
            invoke(command, { sgid: item.sgid })
                .then(() => {
                    stateUpdater(prev => prev.filter(record => record.sgid !== item.sgid));
                    message.success('删除成功');
                })
                .catch(err => {
                    console.error('删除失败', err);
                    message.error('删除失败：' + String(err));
                })
                .finally(() => setLoading(false));
        }
    },
});
