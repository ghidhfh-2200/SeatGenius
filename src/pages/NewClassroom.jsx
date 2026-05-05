import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import useRafState from "../hooks/useRafState";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout, Typography, Card, Button, Tabs, Checkbox, Input, message, Tree, Tag, Modal } from "antd";
import { invoke } from "@tauri-apps/api/core";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./NewClassroom.css";
import CreatePanel from "../components/EditSeatTable/CreatePanel";
import EditComponentModal from "../components/EditSeatTable/EditComponentModal";
import ExportModal from "../components/EditSeatTable/ExportModal";
import FabricClassroomCanvas from "../components/NewClassroom/FabricClassroomCanvas";
import { showDeleteSelectedConfirm, showIdLogsInfo, showModeSwitchConfirm } from "../components/NewClassroom/modalHelpers.jsx";
import { renderSeatElements } from "../api/newclassroom/renderSvg.jsx";
import { normalizeClassroomPayload } from "../api/newclassroom/ClassroomLoader.js";
import {
    computeNextId,
    buildTreeData,
    migrateOldFormat,
    generateIdWithLog,
    batchGenerateIds,
} from "../api/newclassroom/idGenerator.js";
import { createNewClassroomHandlers } from "../api/newclassroom/newClassroomActions";

const { Content, Sider } = Layout;
const { Text } = Typography;

const TYPE_NAMES = {
    platform: "讲台",
    desk: "课桌",
    chair: "座位",
    window: "窗户",
    door: "门",
    multimedia: "多媒体",
    reserved: "保留空位",
    big_group: "大组",
    small_group: "小组",
    seat: "座位",
    aisle: "走廊"
};

const TYPE_ICONS = {
    big_group: "fa-object-group",
    small_group: "fa-users",
    seat: "fa-chair",
    platform: "fa-chalkboard-teacher",
    aisle: "fa-road",
    window: "fa-window-maximize",
    door: "fa-door-closed",
    multimedia: "fa-tv"
};

const FALLBACK_CONFIG = {
    MULTIMEDIA_WIDTH: 200,
    MULTIMEDIA_HEIGHT: 20,
    MULTIMEDIA_RX: 4,
    CHAIR_WIDTH: 36,
    CHAIR_HEIGHT: 36,
    CHAIR_RX: 18,
    DESK_WIDTH: 140,
    DESK_HEIGHT: 60,
    DESK_RX: 6,
    PLATFORM_WIDTH: 260,
    PLATFORM_HEIGHT: 80,
    PLATFORM_RX: 8,
    WINDOW_WIDTH: 140,
    WINDOW_HEIGHT: 14,
    WINDOW_RX: 2,
    RESERVED_WIDTH: 140,
    RESERVED_HEIGHT: 70,
    RESERVED_RX: 6,
    BIG_GROUP_HEIGHT: 420,
    BIG_GROUP_RX: 10,
    BIG_GROUP_PADDING: 12,
    BIG_GROUP_GAP: 16,
    BIG_GROUP_SG_WIDTH: 80,
    AISLE_WIDTH: 40,
    AISLE_HEIGHT: 420,
    AISLE_RX: 6,
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 800
};

const CANVAS_HEIGHT = FALLBACK_CONFIG.CANVAS_HEIGHT;

const defaultColors = {
    chair: "#ff4d4f", platform: "#1677ff", desk: "#52c41a",
    window: "#13c2c2", door: "#fa8c16", multimedia: "#722ed1",
    reserved: "#d9d9d9", big_group: "#d9d9d9", small_group: "#ff4d4f",
    seat: "#ff4d4f", aisle: "#f0f0f0"
};

const NewClassroom = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activePanel, setActivePanel] = useState('create');
    const [mode, setMode] = useState('classic');
    const [panelWidth, setPanelWidth] = useRafState(() => Math.round(window.innerWidth * 0.4));
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [isCompactTabs, setIsCompactTabs] = useState(false);
    const [elements, setElements] = useState([]);
    const [config, setConfig] = useState(FALLBACK_CONFIG);
    const [canvasWidth, setCanvasWidth] = useState(FALLBACK_CONFIG.CANVAS_WIDTH);
    const [savedElements, setSavedElements] = useState([]);
    const [nextId, setNextId] = useState(0);
    const [idLogs, setIdLogs] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportName, setExportName] = useState("");
    const [exportLoading, setExportLoading] = useState(false);
    const [hoveredItemId, setHoveredItemId] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedListIds, setSelectedListIds] = useState([]);
    const [canvasRenderKey, setCanvasRenderKey] = useState(0);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [selectedTreeKey, setSelectedTreeKey] = useState(null);
    const isResizingRef = useRef(false);
    const classroomLoadedRef = useRef(false);
    const nextIdRef = useRef(0);
    const idLogsRef = useRef([]);

    const svgRef = useRef(null);
    const fabricCanvasRef = useRef(null);
    const crosshairHRef = useRef(null);
    const crosshairVRef = useRef(null);
    const coordsRef = useRef(null);
    const crosshairGroupRef = useRef(null);

    // --- ID 生成工具函数 ---
    const allocId = useCallback((type, parentId = null) => {
        const logs = [...idLogsRef.current];
        const currentNextId = nextIdRef.current;
        const result = generateIdWithLog(currentNextId, type, parentId, logs);
        idLogsRef.current = logs;
        nextIdRef.current = result.nextId;
        setNextId(result.nextId);
        setIdLogs(logs);
        return result.id;
    }, [nextId, idLogs]);

    const allocBatchIds = useCallback((type, parentId, count) => {
        const logs = [...idLogsRef.current];
        const currentNextId = nextIdRef.current;
        const result = batchGenerateIds(currentNextId, type, parentId, count, logs);
        idLogsRef.current = logs;
        nextIdRef.current = result.nextId;
        setNextId(result.nextId);
        setIdLogs(logs);
        return result.ids;
    }, [nextId, idLogs]);

    // --- 获取子元素 ---
    const getChildElements = useCallback((parentId) => {
        return elements.filter(el => el.parentId === parentId);
    }, [elements]);

    // --- 构建树数据 ---
    const treeData = useMemo(() => {
        return buildTreeData(elements, TYPE_NAMES);
    }, [elements]);

    // 自动展开所有节点
    useEffect(() => {
        const keys = [];
        treeData.forEach(bg => {
            keys.push(bg.key);
            (bg.children || []).forEach(sg => {
                keys.push(sg.key);
            });
        });
        setExpandedKeys(keys);
    }, [treeData]);

    useEffect(() => {
        let active = true;

        invoke("get_default_config")
            .then((data) => {
                if (!active || !data || classroomLoadedRef.current) return;
                const nextConfig = { ...FALLBACK_CONFIG, ...data };
                setConfig(nextConfig);
                setCanvasWidth(nextConfig.CANVAS_WIDTH || FALLBACK_CONFIG.CANVAS_WIDTH);
            })
            .catch((error) => {
                console.error("读取默认配置失败", error);
                message.error('读取默认配置失败：' + String(error));
            });

        return () => {
            active = false;
        };
    }, []);

    // 加载教室
    useEffect(() => {
        const classroomSgid = location.state?.sgid;
        if (!classroomSgid) return;

        let active = true;
        classroomLoadedRef.current = true;

        invoke("load_classroom", { sgid: classroomSgid })
            .then((payload) => {
                if (!active || !payload) return;

                const normalized = normalizeClassroomPayload(payload, FALLBACK_CONFIG);
                let loadedElements = normalized.elements;
                let loadedLogs = normalized.idLogs || [];

                // 检查是否需要从旧格式迁移
                const needsMigration = loadedElements.some(
                    e => e.type === 'big_group' && Array.isArray(e.smallGroups) && e.smallGroups.length > 0
                );

                if (needsMigration) {
                    const migrated = migrateOldFormat(loadedElements, 0, [...loadedLogs]);
                    loadedElements = migrated.elements;
                    loadedLogs = migrated.logs;
                    setNextId(migrated.nextId);
                    nextIdRef.current = migrated.nextId;
                    idLogsRef.current = loadedLogs;
                } else {
                    const computedNextId = computeNextId(loadedElements);
                    setNextId(computedNextId);
                    nextIdRef.current = computedNextId;
                    idLogsRef.current = loadedLogs;
                }

                setElements(loadedElements);
                setIdLogs(loadedLogs);
                setSavedElements(loadedElements);
                setMode(normalized.mode);
                setConfig(normalized.config);
                setCanvasWidth(normalized.canvasWidth);
                setSelectedItem(null);
                setSelectedListIds([]);
                setCanvasRenderKey(prev => prev + 1);
                message.success(`已加载 ${normalized.name || "教室"}`);
            })
            .catch((error) => {
                console.error("加载教室失败", error);
                message.error("加载教室失败，请检查文件是否存在：" + String(error));
            });

        return () => {
            active = false;
        };
    }, [location.state]);

    const {
        handleSvgMouseMove,
        handleSvgMouseLeave,
        handleMouseMove,
        handleMouseUp,
        handleModeChange,
        handleCreate,
        handleTreeSelect,
        handleItemClick,
        handleModalCancel,
        handleModalOk,
        handleResizeMouseDown,
        toggleCompactTabs,
        togglePanelCollapsed,
        handleBackToHome,
        handleOpenExport,
        handleConfirmExport,
        handleDeleteSelected,
        handleTreeCheck,
        handleSelectAll
    } = useMemo(() => createNewClassroomHandlers({
        svgRef,
        fabricCanvasRef,
        crosshairHRef,
        crosshairVRef,
        coordsRef,
        crosshairGroupRef,
        isResizingRef,
        mode,
        elements,
        savedElements,
        selectedItem,
        exportName,
        isPanelCollapsed,
        allocId,
        getChildElements,
        setPanelWidth,
        setMode,
        setIsPanelCollapsed,
        setIsCompactTabs,
        setIsModalVisible,
        setSelectedItem,
        setElements,
        setSavedElements,
        setExportName,
        setIsExportModalVisible,
        setExportLoading,
        setSelectedListIds,
        setNextId,
        nextIdRef,
        idLogsRef,
        canvasWidth,
        config,
        CANVAS_HEIGHT,
        message,
        invoke,
        navigate,
        showModeSwitchConfirm,
        showDeleteSelectedConfirm,
        showIdLogsInfo
    }), [
        svgRef,
        fabricCanvasRef,
        crosshairHRef,
        crosshairVRef,
        coordsRef,
        crosshairGroupRef,
        isResizingRef,
        mode,
        elements,
        savedElements,
        selectedItem,
        exportName,
        isPanelCollapsed,
        allocId,
        getChildElements,
        setPanelWidth,
        setMode,
        setIsPanelCollapsed,
        setIsCompactTabs,
        setIsModalVisible,
        setSelectedItem,
        setElements,
        setSavedElements,
        setExportName,
        setIsExportModalVisible,
        setExportLoading,
        setSelectedListIds,
        setNextId,
        nextIdRef,
        idLogsRef,
        canvasWidth,
        config,
        CANVAS_HEIGHT,
        message,
        invoke,
        navigate,
        showModeSwitchConfirm,
        showDeleteSelectedConfirm,
        showIdLogsInfo
    ]);

    useEffect(() => {
        const onMouseMove = (event) => {
            handleMouseMove(event);
        };

        const onMouseUp = () => {
            handleMouseUp();
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    // 检查一个节点是否被选中（用于显示勾选状态）
    const isNodeChecked = (nodeId) => {
        return selectedListIds.includes(Number(nodeId));
    };

    // 树节点渲染
    const renderTreeTitle = (node) => {
        const iconClass = TYPE_ICONS[node.type] || "fa-cube";
        const typeName = TYPE_NAMES[node.type] || node.type;
        const isChecked = isNodeChecked(node.id);
        const badgeColor = node.origin?.color || defaultColors[node.type] || "#999";

        return (
            <div
                className="seat-tree-node"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 0',
                    cursor: 'pointer'
                }}
            >
                <Checkbox
                    checked={isChecked}
                    onChange={(e) => {
                        e.stopPropagation();
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleTreeCheck(node.id, !isChecked);
                    }}
                    style={{ marginRight: 2 }}
                />
                <span
                    style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        backgroundColor: badgeColor,
                        flexShrink: 0
                    }}
                />
                <i className={`fas ${iconClass}`} style={{ fontSize: 12, width: 16, textAlign: 'center', color: badgeColor }} />
                <span style={{ fontSize: 13, fontWeight: node.type === 'big_group' ? 600 : 400 }}>
                    {node.origin?.name || typeName}
                </span>
                <Tag
                    style={{
                        fontSize: 11,
                        lineHeight: '18px',
                        padding: '0 6px',
                        marginLeft: 'auto',
                        flexShrink: 0
                    }}
                >
                    ID: {node.id}
                </Tag>
            </div>
        );
    };

    const isIconOnly = isCompactTabs || isPanelCollapsed;

    // 构建对象列表面板
    const renderObjectListPanel = () => {
        // 非大组/小组/seat的独立元素列表
        const otherElements = elements.filter(
            e => !['big_group', 'small_group', 'seat'].includes(e.type)
        );

        return (
            <div className="seat-panel-body" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottom: "1px solid #f0f0f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
                    <Checkbox
                        indeterminate={selectedListIds.length > 0 && selectedListIds.length < elements.length}
                        checked={elements.length > 0 && selectedListIds.length === elements.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                    >
                        全选
                    </Checkbox>
                    <Button
                        danger
                        size="small"
                        disabled={selectedListIds.length === 0}
                        onClick={handleDeleteSelected}
                    >
                        删除选中 ({selectedListIds.length})
                    </Button>
                </div>

                {/* ID日志查看按钮 */}
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        type="link"
                        size="small"
                        onClick={() => {
                            showIdLogsInfo({
                                idLogs,
                                typeNames: TYPE_NAMES,
                            });
                        }}
                    >
                        <i className="fas fa-history" style={{ marginRight: 4 }} />
                        ID日志
                    </Button>
                </div>

                <div className="custom-scroll seat-list-scroll" style={{ flex: 1, padding: '8px' }}>
                    {/* 层级树视图 */}
                    {treeData.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>
                                <i className="fas fa-sitemap" style={{ marginRight: 4 }} />
                                大组结构
                            </Text>
                            <Tree
                                treeData={treeData.map(bgNode => ({
                                    key: bgNode.key,
                                    ...bgNode,
                                    title: renderTreeTitle(bgNode),
                                    children: bgNode.children?.map(sgNode => ({
                                        key: sgNode.key,
                                        ...sgNode,
                                        title: renderTreeTitle(sgNode),
                                        children: sgNode.children?.map(sNode => ({
                                            key: sNode.key,
                                            ...sNode,
                                            title: renderTreeTitle(sNode)
                                        }))
                                    }))
                                }))}
                defaultExpandedKeys={expandedKeys}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys)}
                selectedKeys={selectedTreeKey ? [selectedTreeKey] : []}
                onSelect={(keys, info) => {
                    if (keys.length > 0) {
                        setSelectedTreeKey(keys[0]);
                        handleTreeSelect(keys, info);
                    } else {
                        setSelectedTreeKey(null);
                    }
                }}
                blockNode
                showIcon={false}
                style={{ fontSize: 13 }}
            />
        </div>
    )}

    {/* 其他独立元素列表 */}
    {otherElements.length > 0 && (
        <div>
            <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>
                <i className="fas fa-cube" style={{ marginRight: 4 }} />
                其他组件
            </Text>
            {otherElements.map((item) => {
                const isChecked = selectedListIds.includes(item.id);
                return (
                    <div
                        key={item.id}
                        className="seat-list-item"
                        onMouseEnter={() => setHoveredItemId(item.id)}
                        onMouseLeave={() => setHoveredItemId(null)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 4px',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                        onClick={() => handleItemClick(item)}
                    >
                        <Checkbox
                            checked={isChecked}
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                            onChange={(e) => {
                                e.stopPropagation();
                                if (e.target.checked) {
                                    setSelectedListIds(prev => [...prev, item.id]);
                                } else {
                                    setSelectedListIds(prev => prev.filter(id => id !== item.id));
                                }
                            }}
                        />
                        <span style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            backgroundColor: item.color || defaultColors[item.type] || '#999',
                            flexShrink: 0
                        }} />
                        <Text strong style={{ fontSize: 13 }}>{item.name}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
                            ({TYPE_NAMES[item.type] || item.type} - ID: {item.id})
                        </Text>
                    </div>
                );
            })}
        </div>
    )}

    {elements.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260, color: '#999', flexDirection: 'column' }}>
            <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
            <div>暂无对象，请先创建组件</div>
        </div>
    )}
</div>
</div>
);
};

// 面板切换项 — 用于右侧 Tabs
const panelItems = [
{
    key: "create",
    label: (
        <span className="seat-tab-label">
            <i className="fas fa-plus" />
            <span className="seat-tab-text">新建组件</span>
        </span>
    ),
    children: <CreatePanel onCreate={handleCreate} mode={mode} onModeChange={handleModeChange} />
},
{
    key: "list",
    label: (
        <span className="seat-tab-label">
            <i className="fas fa-list-ul" />
            <span className="seat-tab-text">对象列表</span>
        </span>
    ),
    children: renderObjectListPanel()
}
];

return (
    <Layout className="seat-layout">
        <Content className="seat-content">
            <div className="seat-page-toolbar">
                <Button onClick={handleBackToHome}>返回主页</Button>
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: 16 }}>
                    <span style={{ marginRight: 8 }}>画布宽度:</span>
                    <Input
                        type="number"
                        value={canvasWidth}
                        onChange={(e) => setCanvasWidth(Number(e.target.value))}
                        style={{ width: 80 }}
                        step={100}
                    />
                </div>
                <Button onClick={handleOpenExport} style={{ marginLeft: "auto" }}>导出</Button>
            </div>
            <Card
        className="seat-canvas-card"
        styles={{ body: { width: "100%", height: "100%", display: "flex", padding: 0, position: "relative" } }}
    >
                {mode === "classic" ? (
                    <>
                        <svg
                            key={canvasRenderKey}
                            ref={svgRef}
                            onMouseMove={(e) => handleSvgMouseMove(e.clientX, e.clientY)}
                            onMouseLeave={handleSvgMouseLeave}
                            className="seat-canvas-svg"
                            xmlns="http://www.w3.org/2000/svg"
                            width="100%"
                            height="100%"
                            viewBox={`0 0 ${canvasWidth} ${CANVAS_HEIGHT}`}
                            preserveAspectRatio="xMidYMid meet"
                        >
                            <rect className="seat-canvas-rect" width="100%" height="100%" fill="transparent" />
                            {elements.length === 0 && (
                                <text className="seat-canvas-text" x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                                    SVG 画布区域
                                </text>
                            )}
                            {renderSeatElements(elements, {
                                canvasWidth: canvasWidth,
                                canvasHeight: CANVAS_HEIGHT,
                                typeNames: TYPE_NAMES,
                                hoveredItemId: hoveredItemId,
                                config
                            })}
                            <g ref={crosshairGroupRef} className="seat-crosshair" pointerEvents="none" style={{ display: "none" }}>
                                <line
                                    ref={crosshairHRef}
                                    x1={0} y1={0}
                                    x2={canvasWidth} y2={0}
                                    stroke="#1890ff" strokeWidth="1" strokeDasharray="4 4" opacity="0.6"
                                />
                                <line
                                    ref={crosshairVRef}
                                    x1={0} y1={0}
                                    x2={0} y2={CANVAS_HEIGHT}
                                    stroke="#1890ff" strokeWidth="1" strokeDasharray="4 4" opacity="0.6"
                                />
                            </g>
                        </svg>
                        <div
                            ref={coordsRef}
                            style={{
                                position: "absolute",
                                bottom: 16,
                                left: 16,
                                background: "rgba(0, 0, 0, 0.6)",
                                color: "#fff",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                pointerEvents: "none",
                                userSelect: "none",
                                display: "none"
                            }}>
                            X: 0 , Y: 0
                        </div>
                    </>
                ) : (
                    <FabricClassroomCanvas
                        ref={fabricCanvasRef}
                        elements={elements}
                        config={config}
                        canvasWidth={canvasWidth}
                        canvasHeight={CANVAS_HEIGHT}
                        onElementsChange={setElements}
                        onSelectItem={(item) => {
                            setSelectedItem(item);
                        }}
                    />
                )}
    </Card>

    <ExportModal
        open={isExportModalVisible}
        exportName={exportName}
        onExportNameChange={setExportName}
        onOk={handleConfirmExport}
        onCancel={() => setIsExportModalVisible(false)}
        exportLoading={exportLoading}
    />
</Content>

<Sider
    width={isPanelCollapsed ? 72 : panelWidth}
    theme="light"
    className={`seat-sider ${isPanelCollapsed ? "seat-sider-collapsed" : ""}`}
>
    <div className="seat-sider-shell">
        <div className={`seat-sider-content ${isIconOnly ? "seat-tabs-icon-only" : ""}`}>
            {!isPanelCollapsed && (
                <div className="seat-resize-handle" onMouseDown={handleResizeMouseDown} />
            )}
            <Tabs
                className="seat-tabs"
                tabPlacement="right"
                activeKey={activePanel}
                onChange={setActivePanel}
                onTabClick={() => {
                    if (isPanelCollapsed) {
                        setIsPanelCollapsed(false);
                    }
                }}
                items={panelItems}
            />
            {/* 右侧工具栏 — 浮动在右下角 */}
            <div className="seat-sider-toolbar">
                {!isPanelCollapsed && (
                    <Button
                        type="text"
                        size="small"
                        className="seat-toolbar-button"
                        onClick={toggleCompactTabs}
                        aria-label={isCompactTabs ? "恢复面板文字" : "仅显示面板图标"}
                    >
                        <i className={`fas ${isCompactTabs ? "fa-eye" : "fa-eye-slash"}`} />
                        <span className="seat-toolbar-button-text">{isCompactTabs ? "显示文字" : "仅图标"}</span>
                    </Button>
                )}
                <Button
                    type="text"
                    size="small"
                    className="seat-toolbar-button"
                    onClick={togglePanelCollapsed}
                    aria-label={isPanelCollapsed ? "展开面板" : "收起面板"}
                >
                    <i className={`fas ${isPanelCollapsed ? "fa-chevron-left" : "fa-chevron-right"}`} />
                    <span className="seat-toolbar-button-text">{isPanelCollapsed ? "展开面板" : "收起面板"}</span>
                </Button>
            </div>
        </div>
    </div>
</Sider>

<EditComponentModal
    selectedItem={selectedItem}
    isModalVisible={isModalVisible}
    onOk={handleModalOk}
    onCancel={handleModalCancel}
    typeNames={TYPE_NAMES}
    mode={mode}
    canvasWidth={canvasWidth}
    canvasHeight={CANVAS_HEIGHT}
    elements={elements}
    onElementsChange={setElements}
    nextId={nextId}
    allocId={allocId}
    allocBatchIds={allocBatchIds}
/>
</Layout>
);
};

export default NewClassroom;
