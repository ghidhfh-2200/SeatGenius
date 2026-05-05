export function createShapeEditorHandlers({ fcRef, freeDraw, setFreeDraw, onSaveShape, onClose, message }) {
    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const handleAddRect = () => fcRef.current?.addRect && fcRef.current.addRect();
    const handleAddCircle = () => fcRef.current?.addCircle && fcRef.current.addCircle();
    const handleAddPolygon = () => fcRef.current?.addPolygon && fcRef.current.addPolygon();
    const handleClear = () => fcRef.current?.clear && fcRef.current.clear();
    const handleDelete = () => fcRef.current?.deleteActive && fcRef.current.deleteActive();

    const toggleFree = () => {
        const next = !freeDraw;
        setFreeDraw(next);
        fcRef.current?.toggleFreeDrawing && fcRef.current.toggleFreeDrawing(next);
    };

    const handleSaveShape = async () => {
        const svg = await (fcRef.current?.exportCroppedSVG?.() || fcRef.current?.exportSVG?.());
        if (svg) {
            if (onSaveShape) onSaveShape(svg);
            message.success('形状已保存');
            onClose && onClose();
        } else {
            message.error('没有形状可保存');
        }
    }

    const handleExportJSON = () => {
        const json = fcRef.current?.exportJSON && fcRef.current.exportJSON();
        const win = window.open('about:blank');
        if (win) {
            win.document.write('<pre>' + escapeHtml(json) + '</pre>');
            win.document.title = 'Canvas JSON';
        }
    }

    const handleLoadJSON = async () => {
        const txt = prompt('Paste canvas JSON here');
        if (txt) {
            try {
                fcRef.current?.loadJSON && fcRef.current.loadJSON(txt);
                message.success('JSON已加载');
            } catch (e) {
                message.error('JSON加载失败');
            }
        }
    }

    const handleLoadSVG = async () => {
        const txt = prompt('Paste SVG XML here');
        if (txt) {
            try {
                fcRef.current?.loadSVG && fcRef.current.loadSVG(txt);
                message.success('SVG已加载');
            } catch (e) {
                message.error('SVG加载失败');
            }
        }
    }

    return {
        handleAddRect,
        handleAddCircle,
        handleAddPolygon,
        handleClear,
        handleDelete,
        toggleFree,
        handleSaveShape,
        handleExportJSON,
        handleLoadJSON,
        handleLoadSVG
    };
}
