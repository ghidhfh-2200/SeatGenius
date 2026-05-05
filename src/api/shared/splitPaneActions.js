export const createSplitPaneHandlers = ({ setIsDragging, updateRatio }) => ({
    handleMouseDown: (e) => {
        e.preventDefault();
        setIsDragging(true);
    },
    handleMouseMove: (e) => {
        updateRatio(e.clientY);
    },
    handleMouseUp: () => {
        setIsDragging(false);
    },
});
