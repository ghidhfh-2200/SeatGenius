import { invoke } from '@tauri-apps/api/core';

export const saveNamelist = async ({ listName, uploadedNames }) => {
    if (!Array.isArray(uploadedNames) || uploadedNames.length === 0) {
        throw new Error('当前没有可保存的名单');
    }

    const result = await invoke('save_namelist', {
        name: listName,
        names: uploadedNames,
    });

    return result;
};

export const createSaveAsHandlers = ({ listName, uploadedNames, onSaved, onClose, message }) => ({
    handleOk: async () => {
        try {
            const result = await saveNamelist({ listName, uploadedNames });
            message.success('保存成功：' + String(result));
            onSaved?.();
            onClose();
        } catch (err) {
            console.error('保存名单失败', err);
            message.error(String(err).includes('当前没有可保存的名单') ? String(err) : '保存名单失败：' + String(err));
        }
    },
});
