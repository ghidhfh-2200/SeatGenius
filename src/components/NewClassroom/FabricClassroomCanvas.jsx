import React, { forwardRef, useEffect, useImperativeHandle, useRef, useMemo } from "react";
import { fabric } from "fabric";
import { createFabricCanvasHandlers } from "../../api/newclassroom/fabricCanvasActions";

const getConfigNumber = (config, key, fallback) => {
    const value = Number(config?.[key]);
    return Number.isFinite(value) ? value : fallback;
};

const getElementSize = (item, config = {}) => {
    switch (item.type) {
        case "chair":
            return {
                width: getConfigNumber(config, "CHAIR_WIDTH", 36),
                height: getConfigNumber(config, "CHAIR_HEIGHT", 36),
                rx: getConfigNumber(config, "CHAIR_RX", 18)
            };
        case "desk":
            return {
                width: item.width || getConfigNumber(config, "DESK_WIDTH", 140),
                height: item.height || getConfigNumber(config, "DESK_HEIGHT", 60),
                rx: getConfigNumber(config, "DESK_RX", 6)
            };
        case "platform":
            return {
                width: item.width || getConfigNumber(config, "PLATFORM_WIDTH", 260),
                height: item.height || getConfigNumber(config, "PLATFORM_HEIGHT", 80),
                rx: getConfigNumber(config, "PLATFORM_RX", 8)
            };
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
            return {
                width: item.width || getConfigNumber(config, "MULTIMEDIA_WIDTH", 200),
                height: item.height || getConfigNumber(config, "MULTIMEDIA_HEIGHT", 20),
                rx: getConfigNumber(config, "MULTIMEDIA_RX", 4)
            };
        case "reserved":
            return {
                width: item.width || getConfigNumber(config, "RESERVED_WIDTH", 140),
                height: item.height || getConfigNumber(config, "RESERVED_HEIGHT", 70),
                rx: getConfigNumber(config, "RESERVED_RX", 6)
            };
        case "aisle":
            return {
                width: item.width || getConfigNumber(config, "AISLE_WIDTH", 40),
                height: item.height || getConfigNumber(config, "AISLE_HEIGHT", 420),
                rx: getConfigNumber(config, "AISLE_RX", 6)
            };
        default:
            return { width: item.width || 120, height: item.height || 60, rx: 6 };
    }
};

const getDefaultPosition = (item, size, canvasWidth, canvasHeight) => {
    if (item.side) {
        const rel = Number.isFinite(Number(item.relativePos)) ? Number(item.relativePos) : 50;
        const isVertical = ["left", "right"].includes(item.side);
        const relPos = isVertical ? (rel / 100) * canvasHeight : (rel / 100) * canvasWidth;
        switch (item.side) {
            case "left":
                return { x: 20, y: relPos };
            case "right":
                return { x: canvasWidth - size.width - 20, y: relPos };
            case "front":
                return { x: relPos, y: 20 };
            case "back":
                return { x: relPos, y: canvasHeight - size.height - 20 };
            default:
                break;
        }
    }

    const centerX = (canvasWidth - size.width) / 2;
    const centerY = (canvasHeight - size.height) / 2;
    return { x: centerX, y: centerY };
};

const loadSvgObject = (svgString) => new Promise((resolve) => {
    const loadFn = fabric.loadSVGFromString || fabric.util.loadSVGFromString;
    loadFn(svgString, (objects, options) => {
        if (!objects || objects.length === 0) {
            resolve(null);
            return;
        }
        const group = fabric.util.groupSVGElements(objects, options);
        resolve(group || objects[0]);
    });
});

/**
 * 根据 item 数据创建 Fabric 对象（不添加到画布）
 */
const createFabricObject = async (item, config, canvasWidth, canvasHeight) => {
    const size = getElementSize(item, config);
    const fill = item.color || "#999";

    let x = Number.isFinite(Number(item.x)) ? Number(item.x) : undefined;
    let y = Number.isFinite(Number(item.y)) ? Number(item.y) : undefined;
    if (x === undefined || y === undefined) {
        const pos = getDefaultPosition(item, size, canvasWidth, canvasHeight);
        x = pos.x;
        y = pos.y;
    }

    let obj = null;

    if (item.shape) {
        obj = await loadSvgObject(item.shape);
        if (obj) {
            const bounds = obj.getBoundingRect(true);
            const targetW = Number.isFinite(Number(item.width)) ? Number(item.width) : size.width;
            const targetH = Number.isFinite(Number(item.height)) ? Number(item.height) : size.height;
            const scaleX = targetW / Math.max(1, bounds.width);
            const scaleY = targetH / Math.max(1, bounds.height);
            const scale = Math.min(scaleX, scaleY);
            obj.scale(scale);
            obj.set({ left: x, top: y, originX: "left", originY: "top" });
        }
    }

    if (!obj) {
        if (item.type === "chair") {
            const r = size.width / 2;
            obj = new fabric.Circle({
                left: x,
                top: y,
                radius: r,
                fill,
                stroke: "rgba(0,0,0,0.15)",
                strokeWidth: 1.5,
                originX: "left",
                originY: "top"
            });
        } else {
            obj = new fabric.Rect({
                left: x,
                top: y,
                width: size.width,
                height: size.height,
                rx: size.rx || 0,
                ry: size.rx || 0,
                fill,
                stroke: "rgba(0,0,0,0.15)",
                strokeWidth: 1.5,
                originX: "left",
                originY: "top"
            });
        }
    }

    obj.set({
        selectable: true,
        hasControls: true,
        hasBorders: true,
        lockRotation: false,
        lockScalingX: false,
        lockScalingY: false
    });

    if (Number.isFinite(Number(item.rotation))) {
        obj.rotate(Number(item.rotation));
    }

    obj.set({ data: { id: item.id, type: item.type, shape: item.shape } });
    return obj;
};

const FabricClassroomCanvas = forwardRef(({
    elements,
    config,
    canvasWidth,
    canvasHeight,
    onElementsChange,
    onSelectItem
}, ref) => {
    const canvasEl = useRef(null);
    const canvasRef = useRef(null);
    const isApplyingRef = useRef(false);
    const elementsRef = useRef(elements);
    const objectMapRef = useRef(new Map()); // id -> fabric.Object
    const renderVersionRef = useRef(0);      // 递增版本号，用于跳过旧渲染
    const suppressClearRef = useRef(false);

    useImperativeHandle(ref, () => ({
        exportSVG() {
            if (!canvasRef.current) return "";
            return canvasRef.current.toSVG();
        },
        getCanvas() {
            return canvasRef.current;
        }
    }));

    // 初始化画布（仅一次）
    useEffect(() => {
        const canvas = new fabric.Canvas(canvasEl.current, {
            backgroundColor: "#fff",
            preserveObjectStacking: true,
            selection: true,
            hoverCursor: "pointer"
        });
        canvasRef.current = canvas;

        return () => {
            canvas.dispose();
            canvasRef.current = null;
            objectMapRef.current.clear();
        };
    }, []);

    // 保持 elementsRef 同步
    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    // 选中事件处理
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const handlers = createFabricCanvasHandlers({ elementsRef, onSelectItem });

        const handleSelect = handlers.handleSelect;
        const handleClear = (evt) => {
            if (suppressClearRef.current) return;
            handlers.handleClear(evt);
        };

        canvas.on("selection:created", handleSelect);
        canvas.on("selection:updated", handleSelect);
        canvas.on("selection:cleared", handleClear);

        return () => {
            canvas.off("selection:created", handleSelect);
            canvas.off("selection:updated", handleSelect);
            canvas.off("selection:cleared", handleClear);
        };
    }, [onSelectItem]);

    // 画布尺寸变化
    useEffect(() => {
        if (!canvasRef.current) return;
        canvasRef.current.setWidth(canvasWidth);
        canvasRef.current.setHeight(canvasHeight);
        canvasRef.current.requestRenderAll();
    }, [canvasWidth, canvasHeight]);

    // 核心：增量更新画布对象，避免全量 clear()
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const version = ++renderVersionRef.current;

        const filtered = elements.filter(e => !["small_group", "seat"].includes(e.type));
        const newIds = new Set(filtered.map(e => e.id));
        const existingIds = new Set(objectMapRef.current.keys());

        // 1. 移除不再存在的对象
        for (const id of existingIds) {
            if (!newIds.has(id)) {
                const obj = objectMapRef.current.get(id);
                if (obj) {
                    canvas.remove(obj);
                    obj.off();
                }
                objectMapRef.current.delete(id);
            }
        }

        // 2. 更新/添加对象
        const updatePromises = filtered.map(async (item) => {
            // 检查是否已被新版本取消
            if (renderVersionRef.current !== version) return;

            const existing = objectMapRef.current.get(item.id);
            if (existing) {
                // 检测形状是否变化（SVG 形状编辑后需要重建对象）
                const prevShape = existing.data?.shape;
                const shapeChanged = item.shape !== prevShape;

                if (shapeChanged) {
                    // 形状变化：移除旧对象，创建新对象
                    const wasActive = canvas.getActiveObject() === existing;
                    if (wasActive) suppressClearRef.current = true;
                    canvas.remove(existing);
                    existing.off();
                    objectMapRef.current.delete(item.id);

                    const obj = await createFabricObject(item, config, canvasWidth, canvasHeight);
                    if (renderVersionRef.current !== version) {
                        if (wasActive) suppressClearRef.current = false;
                        return;
                    }
                    if (!obj) {
                        if (wasActive) suppressClearRef.current = false;
                        return;
                    }

                    obj.on("modified", (evt) => {
                        if (!onElementsChange || isApplyingRef.current) return;
                        const action = evt?.transform?.action;
                        const isScaleAction = typeof action === "string" && action.startsWith("scale");
                        if (isScaleAction && (obj.scaleX !== 1 || obj.scaleY !== 1)) {
                            const w = obj.getScaledWidth();
                            const h = obj.getScaledHeight();
                            if (obj.set) {
                                obj.set({ scaleX: 1, scaleY: 1 });
                                if (obj.width !== undefined) obj.set({ width: w });
                                if (obj.height !== undefined) obj.set({ height: h });
                            }
                        }
                        const scaledW = obj.getScaledWidth();
                        const scaledH = obj.getScaledHeight();
                        const nextX = obj.originX === "center" ? (obj.left - scaledW / 2) : obj.left;
                        const nextY = obj.originY === "center" ? (obj.top - scaledH / 2) : obj.top;
                        const nextRotation = Number.isFinite(obj.angle) ? obj.angle : 0;

                        isApplyingRef.current = true;
                        onElementsChange(prev => prev.map(e => (
                            e.id === item.id
                                ? {
                                    ...e,
                                    x: nextX,
                                    y: nextY,
                                    rotation: nextRotation,
                                    ...(isScaleAction ? { width: scaledW, height: scaledH } : {})
                                }
                                : e
                        )));
                        isApplyingRef.current = false;
                    });

                    canvas.add(obj);
                    objectMapRef.current.set(item.id, obj);
                    if (wasActive) {
                        canvas.setActiveObject(obj);
                        onSelectItem?.(item);
                        suppressClearRef.current = false;
                    }
                } else {
                    // 更新已有对象的位置/尺寸/旋转
                    const size = getElementSize(item, config);
                    let x = Number.isFinite(Number(item.x)) ? Number(item.x) : undefined;
                    let y = Number.isFinite(Number(item.y)) ? Number(item.y) : undefined;
                    if (x === undefined || y === undefined) {
                        const pos = getDefaultPosition(item, size, canvasWidth, canvasHeight);
                        x = pos.x;
                        y = pos.y;
                        if (onElementsChange) {
                            isApplyingRef.current = true;
                            onElementsChange(prev => prev.map(e => (
                                e.id === item.id ? { ...e, x, y } : e
                            )));
                            isApplyingRef.current = false;
                        }
                    }

                    const needsMove = existing.left !== x || existing.top !== y;
                    const needsResize = existing.width !== size.width || existing.height !== size.height;
                    const needsRotate = Number.isFinite(Number(item.rotation)) && existing.angle !== Number(item.rotation);
                    const needsFill = existing.fill !== (item.color || "#999");

                    if (needsMove) {
                        existing.set({ left: x, top: y });
                    }
                    if (needsResize) {
                        existing.set({ width: size.width, height: size.height, rx: size.rx || 0, ry: size.rx || 0 });
                    }
                    if (needsRotate) {
                        existing.rotate(Number(item.rotation));
                    }
                    if (needsFill) {
                        existing.set({ fill: item.color || "#999" });
                    }

                    // 更新 data 中的 shape 引用
                    if (existing.data?.shape !== item.shape) {
                        existing.set({ data: { ...existing.data, shape: item.shape } });
                    }
                }
            } else {
                // 创建新对象
                const obj = await createFabricObject(item, config, canvasWidth, canvasHeight);
                if (renderVersionRef.current !== version) return;
                if (!obj) return;

                // 绑定 modified 事件
                obj.on("modified", (evt) => {
                    if (!onElementsChange || isApplyingRef.current) return;
                    const action = evt?.transform?.action;
                    const isScaleAction = typeof action === "string" && action.startsWith("scale");
                    // 仅在缩放时重置缩放，避免拖动时尺寸被强制变化
                    if (isScaleAction && (obj.scaleX !== 1 || obj.scaleY !== 1)) {
                        const w = obj.getScaledWidth();
                        const h = obj.getScaledHeight();
                        if (obj.set) {
                            obj.set({ scaleX: 1, scaleY: 1 });
                            if (obj.width !== undefined) obj.set({ width: w });
                            if (obj.height !== undefined) obj.set({ height: h });
                        }
                    }
                    const scaledW = obj.getScaledWidth();
                    const scaledH = obj.getScaledHeight();
                    const nextX = obj.originX === "center" ? (obj.left - scaledW / 2) : obj.left;
                    const nextY = obj.originY === "center" ? (obj.top - scaledH / 2) : obj.top;
                    const nextRotation = Number.isFinite(obj.angle) ? obj.angle : 0;

                    isApplyingRef.current = true;
                    onElementsChange(prev => prev.map(e => (
                        e.id === item.id
                            ? {
                                ...e,
                                x: nextX,
                                y: nextY,
                                rotation: nextRotation,
                                ...(isScaleAction ? { width: scaledW, height: scaledH } : {})
                            }
                            : e
                    )));
                    isApplyingRef.current = false;
                });

                canvas.add(obj);
                objectMapRef.current.set(item.id, obj);
            }
        });

        Promise.all(updatePromises).then(() => {
            if (renderVersionRef.current === version) {
                canvas.requestRenderAll();
            }
        });
    }, [elements, config, canvasWidth, canvasHeight, onElementsChange]);

    return (
        <div className="seat-canvas-fabric">
            <canvas ref={canvasEl} />
        </div>
    );
});

export default FabricClassroomCanvas;
