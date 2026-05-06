import { Modal } from "antd";

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
            Modal.confirm({
                title: "确认删除",
                okText: "确认",
                cancelText: "取消",
                content: "确定要删除该条目吗？",
                okButtonProps: {danger: true},
                onOk: () => {
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

            })
        }
    },
    loadRecords: async () => {
        setLoading(true);
        try {
            const [classroomData, seatTableData] = await Promise.all([
                invoke('get_dashboard_records'),
                invoke('get_seat_tables'),
            ]);
            const classroomRecords = Array.isArray(classroomData) ? classroomData : [];
            const seatTableRecords = Array.isArray(seatTableData) ? seatTableData : [];
            setClassrooms(classroomRecords);
            setSeatTables(seatTableRecords);
        } catch (error) {
            console.error('读取仪表盘数据失败', error);
            message.error('读取仪表盘数据失败：' + String(error));
            setClassrooms([]);
            setSeatTables([]);
        } finally {
            setLoading(false);
        }
    }
});
