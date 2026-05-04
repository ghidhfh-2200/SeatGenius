import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout, Typography, Card, Button, Tabs, Checkbox, Input, message, Tree, Tag } from "antd";
import { invoke } from "@tauri-apps/api/core";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./NewClassroom.css";
import CreatePanel from "../components/EditSeatTable/CreatePanel";
import EditComponentModal from "../components/EditSeatTable/EditComponentModal";
import ExportModal from "../components/EditSeatTable/ExportModal";
import SplitPane from "../components/SplitPane";
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
    const [panelWidth, setPanelWidth] = useState(() => Math.round(window.innerWidth * 0.4));
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

    const handleSvgMouseMove = (e) => {
        if (!svgRef.current || !crosshairHRef.current || !crosshairVRef.current || !coordsRef.current || !crosshairGroupRef.current) return;
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svgRef.current.getScreenCTM().inverse());

        const x = Math.round(svgP.x);
        const y = Math.round(svgP.y);

        crosshairHRef.current.setAttribute("y1", svgP.y);
        crosshairHRef.current.setAttribute("y2", svgP.y);
        crosshairVRef.current.setAttribute("x1", svgP.x);
        crosshairVRef.current.setAttribute("x2", svgP.x);

        coordsRef.current.textContent = `X: ${x} , Y: ${y}`;

        crosshairGroupRef.current.style.display = "block";
        coordsRef.current.style.display = "block";
    };

    const handleSvgMouseLeave = () => {
        if (!crosshairGroupRef.current || !coordsRef.current) return;
        crosshairGroupRef.current.style.display = "none";
        coordsRef.current.style.display = "none";
    };

    useEffect(() => {
        const handleMouseMove = (event) => {
            if (!isResizingRef.current) return;

            const minWidth = 280;
            const maxWidth = 560;
            const nextWidth = window.innerWidth - event.clientX;
            const clampedWidth = Math.min(maxWidth, Math.max(minWidth, nextWidth));
            setPanelWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const handleModeChange = (newMode) => {
        if (elements.length > 0) {
            showModeSwitchConfirm({
                onOk: () => {
                    setElements([]);
                    setSavedElements([]);
                    setNextId(0);
                    nextIdRef.current = 0;
                    setIdLogs([]);
                    idLogsRef.current = [];
                    setMode(newMode);
                }
            });
        } else {
            setMode(newMode);
            setSavedElements([]);
        }
    };

    // 创建新元素
    const handleCreate = (type) => {
        const newId = allocId(type);

        const isSidePositional = ["window", "door"].includes(type);
        const isMultimedia = type === "multimedia";
        const isClassicAutoPos = ["big_group", "aisle"].includes(type);

        const newItem = {
            id: newId,
            name: `${TYPE_NAMES[type] || "组件"} (新)`,
            type: type,
            color: defaultColors[type] || "#000",
            ...(!isSidePositional && !isClassicAutoPos ? { x: 0, y: 0 } : {}),
            ...(isSidePositional ? { side: "left", relativePos: 50 } : {}),
            ...(type !== "chair" && type !== "platform" && !isSidePositional && !isClassicAutoPos ? { width: 100, height: 50 } : {}),
            ...(type === "multimedia" ? { rotation: 0, side: "front", relativePos: 50 } : {}),
        };

        if (type === "platform" && mode === "classic") {
            newItem.width = config.PLATFORM_WIDTH || FALLBACK_CONFIG.PLATFORM_WIDTH;
            newItem.height = config.PLATFORM_HEIGHT || FALLBACK_CONFIG.PLATFORM_HEIGHT;
        }

        if (type === "multimedia") {
            newItem.width = config.MULTIMEDIA_WIDTH || FALLBACK_CONFIG.MULTIMEDIA_WIDTH;
            newItem.height = config.MULTIMEDIA_HEIGHT || FALLBACK_CONFIG.MULTIMEDIA_HEIGHT;
            newItem.rx = config.MULTIMEDIA_RX || FALLBACK_CONFIG.MULTIMEDIA_RX;
        }

        if (type === "multimedia" && mode === "classic") {
            delete newItem.y;
            delete newItem.height;
            delete newItem.rotation;
            delete newItem.side;
            delete newItem.relativePos;
        }

        if (type === "big_group") {
            setSelectedItem(newItem);
            setIsModalVisible(true);
            return;
        }

        // 进入草稿态：仅打开编辑弹窗，确认后再写入 elements
        setSelectedItem(newItem);
        setIsModalVisible(true);
    };

    // 从树节点点击
    const handleTreeSelect = (selectedKeys, info) => {
        if (!info.node || !info.node.origin) return;
        const item = info.node.origin;
        setSelectedItem(item);
        setIsModalVisible(true);
    };

    const handleItemClick = (item) => {
        setSelectedItem(item);
        setIsModalVisible(true);
    };

    const handleModalCancel = () => {
        setIsModalVisible(false);
        setSelectedItem(null);
    };

    const handleModalOk = (values, extra = null) => {
        if (selectedItem?.type === 'big_group') {
            const existingBigGroup = elements.find(e => e.id === selectedItem.id && e.type === 'big_group');
            const sgItems = Array.isArray(extra?.smallGroups)
                ? extra.smallGroups
                : (Array.isArray(selectedItem.smallGroups) ? selectedItem.smallGroups : []);

            const bigGroupPayload = {
                ...selectedItem,
                ...values,
            };

            if (sgItems.length > 0) {
                const newElements = [bigGroupPayload];
                sgItems.forEach((sg) => {
                    newElements.push({
                        ...sg,
                        parentId: bigGroupPayload.id,
                        type: 'small_group',
                    });
                    (sg.seats || []).forEach((seat) => {
                        newElements.push({
                            ...seat,
                            parentId: sg.id,
                            type: 'seat',
                        });
                    });
                });

                setElements(prev => {
                    const rest = existingBigGroup
                        ? prev.filter(e => e.id !== bigGroupPayload.id && !(e.parentId === bigGroupPayload.id) && !sgItems.some(sg => sg.id === e.parentId))
                        : prev;
                    return [...rest, ...newElements];
                });
            } else {
                setElements(prev => {
                    if (!existingBigGroup) return [...prev, { ...bigGroupPayload }];
                    return prev.map(e => e.id === bigGroupPayload.id ? { ...e, ...bigGroupPayload } : e);
                });
            }
            setIsModalVisible(false);
            return;
        }

        setElements(prev => {
            const exists = prev.find(e => e.id === values.id);
            if (exists) {
                return prev.map(e => e.id === values.id ? { ...e, ...values } : e);
            }
            return [...prev, { ...selectedItem, ...values }];
        });
        setIsModalVisible(false);
    };

    const handleResizeMouseDown = (event) => {
        event.preventDefault();
        if (isPanelCollapsed) return;
        isResizingRef.current = true;
    };

    const toggleCompactTabs = () => {
        if (isPanelCollapsed) {
            setIsPanelCollapsed(false);
        }
        setIsCompactTabs(prev => !prev);
    };

    const togglePanelCollapsed = () => {
        setIsPanelCollapsed(prev => !prev);
    };

    const handleOpenExport = () => {
        if (elements.length === 0) {
            message.warning("当前没有可导出的对象");
            return;
        }

        setExportName(selectedItem?.name || "");
        setIsExportModalVisible(true);
    };

    const handleConfirmExport = async () => {
        const classroomName = exportName.trim();
        if (!classroomName) {
            message.warning("请输入教室名称");
            return;
        }

        if (!svgRef.current) {
            message.error("画布尚未准备好，无法导出");
            return;
        }

        const exportElements = savedElements.length > 0 ? savedElements : elements;
        const preview_svg = new XMLSerializer().serializeToString(svgRef.current);

        setExportLoading(true);
        try {
            const result = await invoke("export_classroom", {
                payload: {
                    name: classroomName,
                    classroom_data: {
                        name: classroomName,
                        mode,
                        canvasWidth,
                        canvasHeight: CANVAS_HEIGHT,
                        elements: exportElements,
                        config,
                        idLogs: idLogsRef.current  // 保存ID日志到教室数据中
                    },
                    preview_svg
                }
            });

            setSavedElements(exportElements);
            setIsExportModalVisible(false);
            message.success(`导出成功：${result?.data_file || classroomName}`);
        } catch (error) {
            console.log(error)
            console.error("导出失败", error);
            message.error("导出失败，请检查 Rust 端日志：" + String(error));
        } finally {
            setExportLoading(false);
        }
    };

    // 删除选中元素（包括级联删除子元素）
    const handleDeleteSelected = () => {
        if (selectedListIds.length === 0) return;

        // 收集所有要删除的ID（包括子元素）
        const idsToDelete = new Set(selectedListIds);
        selectedListIds.forEach(id => {
            // 如果是big_group，删除所有子small_group和seat
            const children = getChildElements(id);
            children.forEach(child => {
                idsToDelete.add(child.id);
                // 如果是small_group，删除其seat子元素
                const grandchildren = getChildElements(child.id);
                grandchildren.forEach(gc => idsToDelete.add(gc.id));
            });
            // 如果是small_group，删除其seat子元素
            const seatChildren = getChildElements(id);
            seatChildren.forEach(sc => idsToDelete.add(sc.id));
        });

        showDeleteSelectedConfirm({
            selectedCount: selectedListIds.length,
            onOk: () => {
                setElements(prev => prev.filter(e => !idsToDelete.has(e.id)));
                setSelectedListIds([]);
            }
        });
    };

    // 切换树节点选中（用于批量删除时的勾选）
    const handleTreeCheck = (nodeId, checked) => {
        const id = Number(nodeId);
        if (checked) {
            // 选中时，同时选中该节点及其所有子节点
            const idsToAdd = [id];
            const children = getChildElements(id);
            children.forEach(child => {
                idsToAdd.push(child.id);
                const grandchildren = getChildElements(child.id);
                grandchildren.forEach(gc => idsToAdd.push(gc.id));
            });
            setSelectedListIds(prev => {
                const newSet = new Set([...prev, ...idsToAdd]);
                return Array.from(newSet);
            });
        } else {
            // 取消选中时，移除该节点及其所有子节点
            const idsToRemove = new Set([id]);
            const children = getChildElements(id);
            children.forEach(child => {
                idsToRemove.add(child.id);
                const grandchildren = getChildElements(child.id);
                grandchildren.forEach(gc => idsToRemove.add(gc.id));
            });
            setSelectedListIds(prev => prev.filter(id => !idsToRemove.has(id)));
        }
    };

    // 全选/取消全选
    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedListIds(elements.map(el => el.id));
        } else {
            setSelectedListIds([]);
        }
    };

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
                                    ...bgNode,
                                    title: renderTreeTitle(bgNode),
                                    children: bgNode.children?.map(sgNode => ({
                                        ...sgNode,
                                        title: renderTreeTitle(sgNode),
                                        children: sgNode.children?.map(sNode => ({
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

const renderPanelContent = () => {
    if (activePanel === 'create') {
        return <CreatePanel onCreate={handleCreate} mode={mode} onModeChange={handleModeChange} />;
    }
    return renderObjectListPanel();
};

return (
    <Layout className="seat-layout">
        <Content className="seat-content">
            <div className="seat-page-toolbar">
                <Button onClick={() => navigate('/')}>返回主页</Button>
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
        <svg
            key={canvasRenderKey}
            ref={svgRef}
            onMouseMove={handleSvgMouseMove}
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
        <div className="seat-sider-content">
            {!isPanelCollapsed && (
                <div className="seat-resize-handle" onMouseDown={handleResizeMouseDown} />
            )}
            {isPanelCollapsed ? (
                <Tabs
                    className={`seat-tabs ${isIconOnly ? "seat-tabs-icon-only" : ""}`}
                    tabPlacement="right"
                    activeKey={activePanel}
                    onChange={setActivePanel}
                    onTabClick={() => {
                        if (isPanelCollapsed) {
                            setIsPanelCollapsed(false);
                        }
                    }}
                    items={panelItems}
                    tabBarExtraContent={{
                        right: (
                            <div className="seat-sider-toolbar">
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
                        )
                    }}
                />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px', flexShrink: 0 }}>
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
                    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        <SplitPane
                            defaultRatio={0.5}
                            minTopHeight={100}
                            minBottomHeight={100}
                            top={
                                <div style={{ height: '100%', overflow: 'auto', padding: '8px' }}>
                                    <CreatePanel onCreate={handleCreate} mode={mode} onModeChange={handleModeChange} />
                                </div>
                            }
                            bottom={
                                <div style={{ height: '100%', overflow: 'auto', padding: '8px' }}>
                                    {renderObjectListPanel()}
                                </div>
                            }
                        />
                    </div>
                </div>
            )}
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
