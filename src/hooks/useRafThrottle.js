import { useCallback, useEffect, useRef } from 'react';

const useRafThrottle = (callback) => {
    const frameRef = useRef(0);
    const lastArgsRef = useRef(null);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    return useCallback((...args) => {
        lastArgsRef.current = args;
        if (frameRef.current) return;
        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = 0;
            const latestArgs = lastArgsRef.current;
            lastArgsRef.current = null;
            if (latestArgs) {
                callbackRef.current(...latestArgs);
            }
        });
    }, []);
};

export default useRafThrottle;
