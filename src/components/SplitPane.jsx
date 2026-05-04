import React, { useRef, useState, useCallback, useEffect } from 'react';
import useRafThrottle from '../hooks/useRafThrottle';

/**
 * SplitPane — 可拖动的垂直分隔面板
 *
 * 将垂直空间分割为上下两个区域，中间带可拖动的分隔条。
 * 支持最小高度限制，防止某个面板被完全压缩。
 *
 * @param {Object} props
 * @param {React.ReactNode} props.top     - 上方面板内容
 * @param {React.ReactNode} props.bottom  - 下方面板内容
 * @param {number} [props.defaultRatio=0.5] - 初始比例（0~1），默认 0.5
 * @param {number} [props.minTopHeight=80]   - 上方面板最小高度（px）
 * @param {number} [props.minBottomHeight=80]- 下方面板最小高度（px）
 * @param {string} [props.className]         - 额外类名
 * @param {Object} [props.style]             - 额外样式
 */
const SplitPane = ({
    top,
    bottom,
    defaultRatio = 0.5,
    minTopHeight = 80,
    minBottomHeight = 80,
    className = '',
    style,
}) => {
    const containerRef = useRef(null);
    const [ratio, setRatio] = useState(defaultRatio);
    const [isDragging, setIsDragging] = useState(false);

    // 拖动逻辑
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const updateRatio = useRafThrottle((clientY) => {
        if (!isDragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const containerHeight = rect.height;
        if (containerHeight <= 0) return;

        const offsetY = clientY - rect.top;
        let newRatio = offsetY / containerHeight;

        // 计算实际像素值，确保不低于最小高度
        const topPx = newRatio * containerHeight;
        const bottomPx = (1 - newRatio) * containerHeight;

        if (topPx < minTopHeight) {
            newRatio = minTopHeight / containerHeight;
        } else if (bottomPx < minBottomHeight) {
            newRatio = 1 - minBottomHeight / containerHeight;
        }

        setRatio(Math.max(0, Math.min(1, newRatio)));
    });

    const handleMouseMove = useCallback((e) => {
        updateRatio(e.clientY);
    }, [updateRatio]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // 全局监听 mouseup / mousemove 防止拖动过快丢失事件
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // 拖动时禁止选中文本
    useEffect(() => {
        if (isDragging) {
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'row-resize';
        } else {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
        return () => {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                flex: 1,
                overflow: 'hidden',
                ...style,
            }}
        >
            {/* 上方面板 */}
            <div
                style={{
                    flex: `0 0 calc(${ratio * 100}% - 5px)`,
                    minHeight: minTopHeight,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {top}
            </div>

            {/* 可拖动分隔条 */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    flex: '0 0 10px',
                    cursor: 'row-resize',
                    background: isDragging ? '#1677ff' : '#e8e8e8',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: isDragging ? 'none' : 'background 0.2s',
                    userSelect: 'none',
                    position: 'relative',
                    zIndex: 10,
                }}
            >
                {/* 分隔条上的小横杠装饰 */}
                <div
                    style={{
                        width: 30,
                        height: 3,
                        background: isDragging ? '#fff' : '#bfbfbf',
                        borderRadius: 2,
                        transition: isDragging ? 'none' : 'background 0.2s',
                    }}
                />
            </div>

            {/* 下方面板 */}
            <div
                style={{
                    flex: `0 0 calc(${(1 - ratio) * 100}% - 5px)`,
                    minHeight: minBottomHeight,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {bottom}
            </div>
        </div>
    );
};

export default SplitPane;
