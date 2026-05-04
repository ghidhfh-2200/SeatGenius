import React from "react";
import { Modal, Form, Input } from "antd";

const ExportModal = ({
    open,
    exportName,
    onExportNameChange,
    onOk,
    onCancel,
    exportLoading,
}) => {
    return (
        <Modal
            title="导出教室"
            open={open}
            forceRender
            onOk={onOk}
            onCancel={onCancel}
            okText="导出"
            cancelText="取消"
            confirmLoading={exportLoading}
            centered
            destroyOnHidden
        >
            <Form layout="vertical">
                <Form.Item label="教室名称" required>
                    <Input
                        value={exportName}
                        onChange={(e) => onExportNameChange(e.target.value)}
                        placeholder="请输入导出名称"
                        maxLength={64}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default ExportModal;
