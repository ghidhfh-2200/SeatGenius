export const createStartEvolutionHandlers = ({ classroom, onOk }) => ({
    handleOk: () => {
        if (classroom) {
            onOk?.(classroom);
        }
    },
});
