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
