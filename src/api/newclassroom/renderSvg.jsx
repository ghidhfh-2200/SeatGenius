import React from "react";
import { Tooltip } from "antd";

const getConfigNumber = (config, key, fallback) => {
    const value = Number(config?.[key]);
    return Number.isFinite(value) ? value : fallback;
};

const parseRelativePos = (value, max) => {
    if (value === undefined || value === null || value === "") return max / 2;
    // 将输入值作为百分比处理（0-100表示0%-100%）
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        // 如果值在 0-100 之间，按百分比解释；否则按绝对像素值
        if (numeric >= 0 && numeric <= 100) {
            return (numeric / 100) * max;
        }
        return Math.max(0, Math.min(max, numeric));
    }
    if (typeof value === "string" && value.includes("%")) {
        const percent = Number.parseFloat(value);
        return Number.isFinite(percent) ? (percent / 100) * max : max / 2;
    }
    return max / 2;
};

const getElementSize = (item, config = {}) => {
    switch (item.type) {
        case "chair":
            return { width: getConfigNumber(config, "CHAIR_WIDTH", 36), height: getConfigNumber(config, "CHAIR_HEIGHT", 36), rx: getConfigNumber(config, "CHAIR_RX", 18) };
        case "desk":
            return { width: item.width || getConfigNumber(config, "DESK_WIDTH", 140), height: item.height || getConfigNumber(config, "DESK_HEIGHT", 60), rx: getConfigNumber(config, "DESK_RX", 6) };
        case "platform":
            return { width: item.width || getConfigNumber(config, "PLATFORM_WIDTH", 260), height: item.height || getConfigNumber(config, "PLATFORM_HEIGHT", 80), rx: getConfigNumber(config, "PLATFORM_RX", 8) };
        case "window":
        case "door": {
            const isVertical = ["left", "right"].includes(item.side);
            const lLength = item.width || getConfigNumber(config, "WINDOW_WIDTH", 140);
            const lThick = item.height || getConfigNumber(config, "WINDOW_HEIGHT", 14);
            if (isVertical) {
                return { width: lThick, height: lLength, rx: getConfigNumber(config, "WINDOW_RX", 2) };
            }
            return { width: lLength, height: lThick, rx: getConfigNumber(config, "WINDOW_RX", 2) };
        }
        case "multimedia":
            return { width: item.width || getConfigNumber(config, "MULTIMEDIA_WIDTH", 200), height: item.height || getConfigNumber(config, "MULTIMEDIA_HEIGHT", 20), rx: getConfigNumber(config, "MULTIMEDIA_RX", 4) };
        case "reserved":
            return { width: item.width || getConfigNumber(config, "RESERVED_WIDTH", 140), height: item.height || getConfigNumber(config, "RESERVED_HEIGHT", 70), rx: getConfigNumber(config, "RESERVED_RX", 6) };
        case "big_group": {
            const containerPadding = getConfigNumber(config, "BIG_GROUP_PADDING", 12);
            // 计算宽度基于有多少个small_group子元素
            // 但由于渲染时才能获取子元素，这里先返回基础尺寸，后续在渲染函数中可能会重算
            return { width: item.width || 240, height: item.height || getConfigNumber(config, "BIG_GROUP_HEIGHT", 420), rx: getConfigNumber(config, "BIG_GROUP_RX", 10) };
        }
        case "small_group":
            // small_group的大小由父级big_group决定，这里返回占位尺寸
            return { width: item.width || 80, height: item.height || 60, rx: 6 };
        case "seat":
            // 座位作为独立对象，渲染为小矩形（在small_group内部）
            return { width: item.width || 60, height: item.height || 20, rx: 4 };
        case "aisle":
            return { width: item.width || getConfigNumber(config, "AISLE_WIDTH", 40), height: item.height || getConfigNumber(config, "AISLE_HEIGHT", 420), rx: getConfigNumber(config, "AISLE_RX", 6) };
        default:
            return { width: item.width || 120, height: item.height || 60, rx: 6 };
    }
};

/**
 * 计算大组（big_group）的实际渲染宽度
 * getElementSize 对 big_group 返回固定值 240，但实际宽度取决于包含的小组数量和配置，
 * 需要在布局计算时使用实际宽度以保证位置计算的准确性。
 */
const getBigGroupActualWidth = (bigGroup, allElements, config) => {
    if (bigGroup.width) return Number(bigGroup.width);
    const containerPadding = getConfigNumber(config, "BIG_GROUP_PADDING", 12);
    const gap = getConfigNumber(config, "BIG_GROUP_GAP", 16);
    const defaultSgWidth = getConfigNumber(config, "BIG_GROUP_SG_WIDTH", 80);
    const childSmallGroups = allElements.filter(e => e.type === 'small_group' && e.parentId === bigGroup.id);
    const sgCount = childSmallGroups.length || 0;
    const totalContentWidth = sgCount * defaultSgWidth + Math.max(0, sgCount - 1) * gap;
    return containerPadding * 2 + totalContentWidth;
};

const wrapSeatName = (name, maxCharsPerLine = 4, maxLines = 2) => {
    const text = String(name || '空位').trim() || '空位';
    const charsPerLine = Math.max(1, maxCharsPerLine); // 确保至少1个字符
    if (text.length <= charsPerLine) return [text];

    const lines = [];
    for (let i = 0; i < text.length && lines.length < maxLines; i += charsPerLine) {
        lines.push(text.slice(i, i + charsPerLine));
    }

    if (text.length > charsPerLine * maxLines) {
        lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, charsPerLine - 1))}…`;
    }

    return lines;
};

const getElementPosition = (item, size, canvasWidth, canvasHeight, elements, config = {}) => {
    const itemX = (item.x !== undefined && item.x !== null && item.x !== "") ? Number(item.x) : undefined;
    const itemY = (item.y !== undefined && item.y !== null && item.y !== "") ? Number(item.y) : undefined;

    if (itemX !== undefined && !Number.isNaN(itemX) && itemY !== undefined && !Number.isNaN(itemY)) {
        return { x: itemX, y: itemY };
    }

    if (item.side) {
        const isVertical = ["left", "right"].includes(item.side);
        const rel = parseRelativePos(item.relativePos, isVertical ? canvasHeight : canvasWidth);
        switch (item.side) {
            case "left":
                return { x: 20, y: rel };
            case "right":
                return { x: canvasWidth - size.width - 20, y: rel };
            case "front":
                return { x: rel, y: 20 };
            case "back":
                return { x: rel, y: canvasHeight - size.height - 20 };
            default:
                break;
        }
    }

    if (itemX !== undefined && !Number.isNaN(itemX) && (itemY === undefined || Number.isNaN(itemY))) {
        return { x: itemX, y: 20 };
    }

    // small_group和seat的位置由其父级计算，这里不直接计算
    if (item.type === "small_group" || item.type === "seat") {
        return { x: 0, y: 0 }; // 占位，实际位置在渲染函数中计算
    }

    // 默认大组和走廊靠左并且避开讲台，同排依次向右排列
    if (item.type === "big_group" || item.type === "aisle") {
        const platform = elements?.find(e => e.type === "platform");
        const platY = (platform && platform.y !== undefined && platform.y !== null && platform.y !== "") ? Number(platform.y) : 20;
        const platformBottomY = platform ? (platY + (getElementSize(platform).height)) : 20;

        const defaultStartY = platformBottomY + 40;
        let currentX = 12;

        if (elements) {
            for (const el of elements) {
                if (el.id === item.id) break;
                if (["big_group", "aisle"].includes(el.type)) {
                    // 大组使用实际渲染宽度，而非 getElementSize 的固定宽度
                    const elWidth = el.type === "big_group"
                        ? getBigGroupActualWidth(el, elements, config)
                        : getElementSize(el).width;
                    const elX = (el.x !== undefined && el.x !== null && el.x !== "") ? Number(el.x) : undefined;
                    const elActualX = (elX !== undefined && !Number.isNaN(elX)) ? elX : currentX;
                    currentX = elActualX + elWidth + 8;
                }
            }
        }

        return { x: currentX, y: defaultStartY };
    }

    return { x: canvasWidth / 2, y: canvasHeight / 2 };
};

/**
 * 计算big_group的子元素布局
 */
const calcBigGroupLayout = (bigGroup, childSmallGroups, allElements, config) => {
    const containerPadding = getConfigNumber(config, "BIG_GROUP_PADDING", 12);
    const gap = getConfigNumber(config, "BIG_GROUP_GAP", 16);
    const defaultSgWidth = getConfigNumber(config, "BIG_GROUP_SG_WIDTH", 80);
    const sgCount = childSmallGroups.length || 0;

    // 计算大组实际宽度
    const totalContentWidth = sgCount * defaultSgWidth + Math.max(0, sgCount - 1) * gap;
    const bigGroupWidth = bigGroup.width || (containerPadding * 2 + totalContentWidth);
    const bigGroupHeight = bigGroup.height || getConfigNumber(config, "BIG_GROUP_HEIGHT", 420);

    // 获取大组位置
    const bgSize = { width: bigGroupWidth, height: bigGroupHeight, rx: getConfigNumber(config, "BIG_GROUP_RX", 10) };
    const bgPos = getElementPosition(bigGroup, bgSize, config.CANVAS_WIDTH || 1200, config.CANVAS_HEIGHT || 800, allElements, config);

    const sgH = Math.max(0, bigGroupHeight - containerPadding * 2);

    // 计算每个小组的位置和每个座位的位置
    const sgLayouts = childSmallGroups.map((sg, i) => {
        const sgX = bgPos.x + containerPadding + i * (defaultSgWidth + gap);
        const sgY = bgPos.y + containerPadding;
        const rows = Number(sg.membersPerColumn) || 2;
        const rowGap = 8;

        const seatWidth = Math.min(70, defaultSgWidth - 8);
        const startX = sgX + (defaultSgWidth - seatWidth) / 2;

        const innerPadding = 8;
        const availH = sgH - innerPadding * 2;
        const computedSeatH = (availH - (rows - 1) * rowGap) / rows;
        const seatHeight = Math.min(120, Math.max(16, computedSeatH));

        const totalRowHeight = rows * seatHeight + (rows - 1) * rowGap;
        const startY = sgY + (sgH - totalRowHeight) / 2;

        // 获取该小组的座位
        const seats = Array.isArray(sg.seats) && sg.seats.length > 0
            ? sg.seats
            : allElements.filter(e => e.type === 'seat' && e.parentId === sg.id);

        const seatLayouts = seats.map((seat, row) => ({
            seat,
            x: startX,
            y: startY + row * (seatHeight + rowGap),
            width: seatWidth,
            height: seatHeight
        }));

        return {
            sg,
            x: sgX,
            y: sgY,
            width: defaultSgWidth,
            height: sgH,
            seatLayouts
        };
    });

    return {
        bigGroup,
        pos: bgPos,
        size: bgSize,
        sgLayouts
    };
};

const renderSeatElements = (elements, options) => {
    const { canvasWidth, canvasHeight, typeNames, hoveredItemId, config, seatAssignments = {}, mode = 'classic' } = options;

    const getAssignedStudentName = (seatId) => {
        if (seatAssignments == null) return '空位';

        if (Object.prototype.hasOwnProperty.call(seatAssignments, seatId)) {
            const value = seatAssignments[seatId];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return value;
            }
        }

        return '空位';
    };

    // 如果是复杂模式，按元素坐标直接渲染（complex 模式的数据结构与 classic 不同）
    if (mode === 'complex') {
        return elements.map((item) => {
            const size = getElementSize(item, config);
            const fill = item.color || "#999";
            const label = item.name || typeNames?.[item.type] || "组件";

            const pos = getElementPosition(item, size, canvasWidth, canvasHeight, elements, config);

            if (item.type === 'seat' || item.type === 'chair') {
                const seatId = String(item.id);
                const studentName = (seatAssignments && Object.prototype.hasOwnProperty.call(seatAssignments, seatId)) ? seatAssignments[seatId] : '空位';
                const seatTooltipTitle = `座位 ID: ${seatId}\n学生姓名: ${studentName}`;

                return (
                    <g key={item.id} style={{ cursor: 'pointer' }}>
                        <title>{seatTooltipTitle}</title>
                        {item.type === 'chair' ? (
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={size.width / 2}
                                fill={fill}
                                stroke={"rgba(0,0,0,0.15)"}
                                strokeWidth="1.5"
                                data-element-id={item.id}
                                data-element-type={item.type}
                                data-seat-id={seatId}
                                data-student-name={studentName}
                            />
                        ) : (
                            <rect
                                x={pos.x}
                                y={pos.y}
                                width={size.width}
                                height={size.height}
                                rx={size.rx || 4}
                                fill={fill}
                                stroke={"rgba(0,0,0,0.15)"}
                                strokeWidth="1"
                                data-element-id={item.id}
                                data-element-type={item.type}
                                data-seat-id={seatId}
                                data-student-name={studentName}
                            />
                        )}
                    </g>
                );
            }

            // 其他元素（desk/platform/aisle/window等）按默认方式渲染
            return (
                <g key={item.id} style={{ cursor: 'pointer' }}>
                    <title>{`${label} (ID: ${item.id})`}</title>
                    <rect
                        x={pos.x}
                        y={pos.y}
                        width={size.width}
                        height={size.height}
                        rx={size.rx || 4}
                        fill={fill}
                        stroke={"rgba(0,0,0,0.15)"}
                        strokeWidth="1"
                        data-element-id={item.id}
                        data-element-type={item.type}
                    />
                </g>
            );
        });
    }

    // 分离不同类型元素
    const bigGroups = elements.filter(e => e.type === 'big_group');
    const smallGroups = elements.filter(e => e.type === 'small_group');
    const seats = elements.filter(e => e.type === 'seat');
    const otherElements = elements.filter(e => !['big_group', 'small_group', 'seat'].includes(e.type));

    const renderedIds = new Set();

    return elements.map((item) => {
        // 跳过已经渲染的子元素（big_group的子元素由big_group统一渲染）
        if (item.type === 'small_group' || item.type === 'seat') {
            return null;
        }

        const size = getElementSize(item, config);
        const fill = item.color || "#999";
        const label = item.name || typeNames?.[item.type] || "组件";
        const isHovered = hoveredItemId === item.id;

        // 在外部作用域声明pos，供hover效果使用
        let pos = null;
        let content = null;
        const strokeColor = item.type === "aisle" ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.15)";

        if (item.type === "chair") {
            pos = getElementPosition(item, size, canvasWidth, canvasHeight, elements, config);
            content = (
                <g>
                    <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={size.width / 2}
                        fill={fill}
                        stroke={strokeColor}
                        strokeWidth="1.5"
                    />
                </g>
            );
        } else if (item.type === "big_group") {
            // 获取该大组下的所有小组
            const childSmallGroups = smallGroups.filter(sg => sg.parentId === item.id);
            const layout = calcBigGroupLayout(item, childSmallGroups, elements, {
                ...config,
                CANVAS_WIDTH: canvasWidth,
                CANVAS_HEIGHT: canvasHeight
            });
            pos = layout.pos;

            content = (
                <g>
                    {/* 大组外框 */}
                    <rect
                        x={layout.pos.x}
                        y={layout.pos.y}
                        width={layout.size.width}
                        height={layout.size.height}
                        rx={layout.size.rx}
                        fill={fill}
                        stroke={fill}
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        fillOpacity={0.05}
                    />
                    {/* 渲染每个小组及其座位 */}
                    {layout.sgLayouts.map((sgLayout) => (
                        <g key={`sg-${sgLayout.sg.id}`}>
                            {/* 小组背景 */}
                            <rect
                                x={sgLayout.x}
                                y={sgLayout.y}
                                width={sgLayout.width}
                                height={sgLayout.height}
                                fill={sgLayout.sg.color || "#ffffff"}
                                fillOpacity={0.3}
                                rx={6}
                                stroke={sgLayout.sg.color || "#ccc"}
                                strokeWidth="1.5"
                            />
                            {/* 座位 - 使用 seatAssignments 映射按座位ID查找学生 */}
                            {sgLayout.seatLayouts.map((seatLayout) => {
                                const seatId = String(seatLayout.seat.id);
                                // 从映射中查找该座位的学生姓名，如果没找到则为空位
                                const studentName = getAssignedStudentName(seatId);
                                const seatTooltipTitle = `座位 ID: ${seatLayout.seat.id}\n学生姓名: ${studentName}`;

                                return (
                                    <g key={`seat-${seatLayout.seat.id}`} style={{ cursor: "pointer" }}>
                                        <title>{seatTooltipTitle}</title>
                                        <rect
                                            x={seatLayout.x}
                                            y={seatLayout.y}
                                            width={seatLayout.width}
                                            height={seatLayout.height}
                                            fill={seatLayout.seat.color || fill}
                                            rx={4}
                                            stroke="rgba(0,0,0,0.1)"
                                            strokeWidth="1"
                                            data-element-id={seatLayout.seat.id}
                                            data-element-type="seat"
                                            data-seat-id={seatId}
                                            data-student-name={studentName}
                                        />
                                    </g>
                                );
                            })}
                        </g>
                    ))}
                </g>
            );
        } else {
            pos = getElementPosition(item, size, canvasWidth, canvasHeight, elements, config);
            const isAisle = item.type === "aisle";
            const aisleFill = isAisle && item.color ? item.color : (isAisle ? "rgba(0,0,0,0.15)" : fill);
            content = (
                <g>
                    <rect
                        x={pos.x}
                        y={pos.y}
                        width={size.width}
                        height={size.height}
                        rx={size.rx}
                        fill={aisleFill}
                        stroke={isAisle && item.color ? item.color : strokeColor}
                        strokeWidth="1.5"
                        strokeDasharray={isAisle ? "6 4" : "none"}
                        opacity={isAisle ? 0.8 : 1}
                    />
                </g>
            );
        }

        return (
            <Tooltip title={`${label} (ID: ${item.id})`} key={item.id} placement="top">
                <g style={{ cursor: "pointer" }}>
                    {content}
                    {isHovered && item.type === "chair" && pos && (
                        <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={size.width / 2 + 4}
                            fill="transparent"
                            stroke="#1890ff"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            pointerEvents="none"
                        />
                    )}
                    {isHovered && item.type !== "chair" && item.type !== "big_group" && pos && (
                        <rect
                            x={pos.x - 4}
                            y={pos.y - 4}
                            width={size.width + 8}
                            height={size.height + 8}
                            rx={size.rx + 2}
                            fill="transparent"
                            stroke="#1890ff"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            pointerEvents="none"
                        />
                    )}
                </g>
            </Tooltip>
        );
    });
};

export { renderSeatElements };
