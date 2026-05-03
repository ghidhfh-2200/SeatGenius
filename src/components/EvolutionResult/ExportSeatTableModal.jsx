import React from 'react';
import { Input, Modal, Space, Typography } from 'antd';

const ExportSeatTableModal = ({
    open,
    exporting,
    exportName,
    assignedCount,
    onChangeName,
    onOk,
    onCancel,
}) => {
    return (
        <Modal
            title="导出座位表"
            open={open}
            onOk={onOk}
            onCancel={onCancel}
            confirmLoading={exporting}
            okText="确认导出"
            cancelText="取消"
        >
            <Space orientation="vertical" style={{ width: '100%' }}>
                <Typography.Text>请为导出的座位表命名：</Typography.Text>
                <Input
                    placeholder="请输入座位表名称"
                    value={exportName}
                    onChange={(e) => onChangeName?.(e.target.value)}
                    onPressEnter={onOk}
                />
                <Typography.Text type="secondary">
                    将导出 {assignedCount} 个学生的座位分配结果到数据目录。
                </Typography.Text>
            </Space>
        </Modal>
    );
};

export default ExportSeatTableModal;
