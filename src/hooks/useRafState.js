import { useCallback, useEffect, useRef, useState } from 'react';

const useRafState = (initialState) => {
    const frameRef = useRef(0);
    const pendingRef = useRef(null);
    const [state, setState] = useState(initialState);

    useEffect(() => {
        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    const setRafState = useCallback((value) => {
        pendingRef.current = value;
        if (frameRef.current) return;

        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = 0;
            setState((prev) => {
                const nextValue = pendingRef.current;
                pendingRef.current = null;
                return typeof nextValue === 'function' ? nextValue(prev) : nextValue;
            });
        });
    }, []);

    return [state, setRafState];
};

export default useRafState;
