import React from "react";
import { Modal, Input, message } from "antd";
import { createSaveAsHandlers } from "../../api/uploadStudentName/saveAsActions";

const SaveAsModal = ({
    open,
    listName,
    onListNameChange,
    uploadedNames,
    onClose,
    onSaved,
}) => {
    const { handleOk } = React.useMemo(
        () => createSaveAsHandlers({ listName, uploadedNames, onSaved, onClose, message }),
        [listName, uploadedNames, onSaved, onClose, message],
    );

    return (
        <Modal
            title="另存为"
            open={open}
            forceRender
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
