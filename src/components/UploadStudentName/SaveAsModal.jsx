import React from "react";
import { Modal, Input, message } from "antd";
import { saveNamelist } from "../../api/uploadStudentName/saveAsActions";

const SaveAsModal = ({
    open,
    listName,
    onListNameChange,
    uploadedNames,
    onClose,
    onSaved,
}) => {
    const handleOk = async () => {
        try {
            const result = await saveNamelist({ listName, uploadedNames });
            message.success("保存成功：" + String(result));
            onSaved?.();
            onClose();
        } catch (err) {
            console.error("保存名单失败", err);
            message.error(String(err).includes('当前没有可保存的名单') ? String(err) : "保存名单失败：" + String(err));
        }
    };

    return (
        <Modal
            title="另存为"
            open={open}
            onCancel={onClose}
            onOk={handleOk}
        >
            <Input
                value={listName}
                onChange={(e) => onListNameChange(e.target.value)}
            />
        </Modal>
    );
};

export default SaveAsModal;
