export const parseNameListText = (text) => {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return lines
        .map((line) => {
            if (line.includes(',')) {
                return line.split(',')[0].trim();
            }
            return line;
        })
        .filter(Boolean);
};

export const readTextFileAsString = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
});

export const parseNameListFile = async (file) => {
    const text = await readTextFileAsString(file);
    return parseNameListText(text);
};

export const isSupportedNameListFile = (file) => {
    const name = String(file?.name || '').toLowerCase();
    const type = String(file?.type || '');
    const isTxt = name.endsWith('.txt') || type === 'text/plain';
    const isCsv = name.endsWith('.csv') || type === 'text/csv';
    return isTxt || isCsv;
};
