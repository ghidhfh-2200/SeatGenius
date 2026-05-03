import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import './EvolutionResult.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Alert, Button, Card, Col, Layout, message, Row, Spin, Space, Tag, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { normalizeClassroomPayload } from '../api/newclassroom/ClassroomLoader';
import { renderSeatElements } from '../api/newclassroom/renderSvg.jsx';
import { resolveClassroomSgidByName, normalizeSeatOrder } from '../api/evolution/evolutionResultActions';
import ExportSeatTableModal from '../components/EvolutionResult/ExportSeatTableModal';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

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
    CANVAS_HEIGHT: 800,
};

const TYPE_NAMES = {
    platform: '讲台',
    desk: '课桌',
    chair: '座位',
    window: '窗户',
    door: '门',
    multimedia: '多媒体',
    reserved: '保留空位',
    big_group: '大组',
    small_group: '小组',
    seat: '座位',
    aisle: '走廊',
};

const EvolutionResult = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState(location.state?.seatOrder ? {
        state: 'completed',
        classroom_sgid: location.state?.sgid || '',
        classroom_name: location.state?.classroomName || '',
        seat_order: location.state?.seatOrder || {},
        generation: 0,
        best_fitness: 0,
        message: '演化结果已准备好',
    } : null);
    const statusRef = useRef(status);
    const [classroom, setClassroom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState('');
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportName, setExportName] = useState('');
    const [exporting, setExporting] = useState(false);
    const svgRef = useRef(null);
    const prevHoveredSeatRef = useRef(null);

    // 直接 DOM 操作：高亮/取消高亮 SVG 中的座位
    const highlightSeat = useCallback((seatId) => {
        const svg = svgRef.current;
        if (!svg) return;

        // 清除之前的高亮
        if (prevHoveredSeatRef.current) {
            const prevEls = svg.querySelectorAll(`[data-seat-id="${prevHoveredSeatRef.current}"]`);
            prevEls.forEach((el) => {
                el.classList.remove('seat-highlighted');
            });
            prevHoveredSeatRef.current = null;
        }

        if (!seatId) return;

        // 添加新的高亮
        const els = svg.querySelectorAll(`[data-seat-id="${seatId}"]`);
        els.forEach((el) => {
            el.classList.add('seat-highlighted');
        });
        prevHoveredSeatRef.current = seatId;
    }, []);

    // 鼠标进入列表项
    const handleItemMouseEnter = useCallback((studentName) => {
        const seatId = studentToSeatIdMapRef.current?.[studentName];
        if (seatId) {
            highlightSeat(seatId);
        }
    }, [highlightSeat]);

    // 鼠标离开列表项
    const handleItemMouseLeave = useCallback(() => {
        highlightSeat(null);
    }, [highlightSeat]);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    useEffect(() => {
        let active = true;

        const loadResult = async () => {
            try {
                let nextStatus = statusRef.current;
                let classroomSgid = '';
                let loadedFromSeatTable = false;

                // 优先尝试按“座位表 SGID”加载已保存的座位表
                if (location.state?.sgid && !location.state?.seatOrder) {
                    try {
                        const tableData = await invoke('load_seat_table', { sgid: location.state.sgid });
                        if (!active) return;

                        const loadedStatus = {
                            state: 'completed',
                            classroom_sgid: tableData?.classroom_sgid || '',
                            classroom_name: tableData?.classroom_name || '',
                            seat_order: tableData?.seat_order || {},
                            generation: 0,
                            best_fitness: 0,
                            message: '已加载保存的座位表',
                        };
                        setStatus(loadedStatus);
                        statusRef.current = loadedStatus;
                        nextStatus = loadedStatus;
                        loadedFromSeatTable = true;

                        classroomSgid = tableData?.classroom_sgid || '';
                        if (!classroomSgid) {
                            classroomSgid = await resolveClassroomSgidByName(invoke, tableData?.classroom_name || '');
                        }
                    } catch {
                        // 非座位表 SGID 时继续走演化状态流程
                    }
                }

                // 兼容演化流程直接跳转
                if (!nextStatus) {
                    nextStatus = await invoke('get_evolution_status');
                    if (!active) return;
                    setStatus(nextStatus || null);
                }

                if (!classroomSgid) {
                    classroomSgid = location.state?.classroomSgid
                        || (loadedFromSeatTable ? '' : location.state?.sgid)
                        || nextStatus?.classroom_sgid
                        || '';
                }

                if (!classroomSgid) {
                    setClassroom(null);
                    setErrorText('未找到可匹配的教室标识，已加载座位分配数据。');
                    return;
                }

                const payload = await invoke('load_classroom', { sgid: classroomSgid });
                if (!active) return;

                const normalized = normalizeClassroomPayload(payload, FALLBACK_CONFIG);
                setClassroom(normalized);
                setErrorText('');
            } catch (err) {
                if (!active) return;
                setErrorText(String(err));
            } finally {
                if (active) setLoading(false);
            }
        };

        loadResult();

        return () => {
            active = false;
        };
    }, [location.state]);

    // seat_order 现在是座位ID -> 学生姓名的映射对象；兼容旧版按序号输出的数据
    const seatOrder = useMemo(() => status?.seat_order || location.state?.seatOrder || {}, [status, location.state]);
    const normalizedSeatOrder = useMemo(() => normalizeSeatOrder(seatOrder, classroom), [seatOrder, classroom]);
    const seatCount = useMemo(() => {
        return classroom?.elements?.filter((item) => item.type === 'seat').length || 0;
    }, [classroom]);
    const assignedCount = Object.keys(normalizedSeatOrder).length;

    // 导出座位表
    const handleExport = async () => {
        const name = exportName.trim();
        if (!name) {
            message.warning('请输入座位表名称');
            return;
        }

        setExporting(true);
        try {
            // 获取 SVG 预览内容
            const svgElement = document.querySelector('.evolution-result-svg');
            const previewSvg = svgElement ? new XMLSerializer().serializeToString(svgElement) : null;

            const result = await invoke('export_seat_table', {
                payload: {
                    name,
                    classroom_name: status?.classroom_name || classroom?.name || '未命名教室',
                    classroom_sgid: status?.classroom_sgid || location.state?.classroomSgid || classroom?.sgid || '',
                    seat_order: normalizedSeatOrder,
                    preview_svg: previewSvg,
                },
            });

            message.success(`座位表「${name}」已导出成功！`);
            setExportModalOpen(false);
            setExportName('');
        } catch (err) {
            message.error('导出失败：' + String(err));
        } finally {
            setExporting(false);
        }
    };

    // 打开导出弹窗
    const openExportModal = () => {
        const defaultName = (status?.classroom_name || classroom?.name || '座位表') + '-排座结果';
        setExportName(defaultName);
        setExportModalOpen(true);
    };

    // 将 seat_order 映射转为排序后的列表用于显示
    const seatOrderList = useMemo(() => {
        return Object.entries(normalizedSeatOrder)
            .sort(([idA], [idB]) => Number(idA) - Number(idB))
            .map(([seatId, studentName]) => ({ seatId, studentName }));
    }, [normalizedSeatOrder]);

    // 构建学生姓名 -> 座位ID 的反向映射，通过 ref 存储供 DOM 操作使用
    const studentToSeatIdMapRef = useRef({});
    useEffect(() => {
        const map = {};
        Object.entries(normalizedSeatOrder).forEach(([seatId, studentName]) => {
            map[studentName] = seatId;
        });
        studentToSeatIdMapRef.current = map;
    }, [normalizedSeatOrder]);

    // 判断是否从 Dashboard 进入（没有 seatOrder 即为 Dashboard 来源，仅支持查看）
    const fromDashboard = useMemo(() => {
        return !!(location.state?.sgid && !location.state?.seatOrder);
    }, [location.state]);

    return (
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f6f8fc 0%, #eef3f9 100%)' }}>
            <Content style={{ padding: 16 }}>
                <Card
                    title={<Title level={4} style={{ margin: 0 }}>遗传算法座位结果</Title>}
                    extra={fromDashboard ? (
                        <Button onClick={() => navigate('/')}>返回</Button>
                    ) : (
                        <Button icon={<ExportOutlined />} onClick={openExportModal}>导出座位表</Button>
                    )}
                >
                    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                        <Space wrap>
                            <Text strong>教室：</Text>
                            <Tag color="blue">{status?.classroom_name || classroom?.name || '未指定'}</Tag>
                            <Tag color="gold">已分配：{assignedCount}/{seatCount || seatOrderList.length}</Tag>
                        </Space>

                        {errorText && (
                            <Alert type="error" showIcon title="加载结果失败" description={errorText} />
                        )}

                        {loading ? (
                            <Spin size="large" description="正在载入教室与座位结果..." />
                        ) : classroom ? (
                            <Row gutter={[16, 16]}>
                                <Col xs={24} lg={17}>
                                    <Card
                                        size="small"
                                        title="座位表"
                                        styles={{ body: { padding: 12 } }}
                                        style={{ height: '100%' }}
                                    >
                                        <div
                                            style={{
                                                width: '100%',
                                                minHeight: 620,
                                                borderRadius: 12,
                                                overflow: 'hidden',
                                                border: '1px solid #e6eaf2',
                                                background: 'linear-gradient(180deg, #ffffff 0%, #fafcff 100%)',
                                            }}
                                        >
                                            <svg
                                                ref={svgRef}
                                                className="evolution-result-svg"
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="100%"
                                                height="100%"
                                                viewBox={`0 0 ${classroom.canvasWidth || FALLBACK_CONFIG.CANVAS_WIDTH} ${classroom.canvasHeight || FALLBACK_CONFIG.CANVAS_HEIGHT}`}
                                                preserveAspectRatio="xMidYMid meet"
                                            >
                                                <rect width="100%" height="100%" fill="transparent" />
                                                {renderSeatElements(classroom.elements || [], {
                                                    canvasWidth: classroom.canvasWidth || FALLBACK_CONFIG.CANVAS_WIDTH,
                                                    canvasHeight: classroom.canvasHeight || FALLBACK_CONFIG.CANVAS_HEIGHT,
                                                    typeNames: TYPE_NAMES,
                                                    config: classroom.config || FALLBACK_CONFIG,
                                                    seatAssignments: normalizedSeatOrder,
                                                })}
                                            </svg>
                                        </div>
                                    </Card>
                                </Col>

                                <Col xs={24} lg={7}>
                                    <Card size="small" title="学生列表" style={{ height: '100%' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {seatOrderList.length > 0 ? seatOrderList.map(({ seatId, studentName }) => (
                                                <div
                                                    key={seatId}
                                                    className="student-list-item"
                                                    data-student-name={studentName}
                                                    onMouseEnter={() => handleItemMouseEnter(studentName)}
                                                    onMouseLeave={handleItemMouseLeave}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: 8,
                                                        padding: '4px 8px',
                                                        borderRadius: 6,
                                                        cursor: 'pointer',
                                                        transition: 'background 0.15s',
                                                    }}
                                                >
                                                    <Tag color="blue" style={{ marginTop: 2, flexShrink: 0 }}>{seatId}</Tag>
                                                    <Text>{studentName}</Text>
                                                </div>
                                            )) : (
                                                <Text type="secondary">暂无座位分配结果</Text>
                                            )}
                                        </div>
                                    </Card>
                                </Col>
                            </Row>
                        ) : (
                            <Alert type="warning" showIcon title="没有可显示的教室数据" description="请重新运行演化任务或返回上一步检查教室是否已成功加载。" />
                        )}
                    </Space>
                </Card>

                <ExportSeatTableModal
                    open={exportModalOpen}
                    exporting={exporting}
                    exportName={exportName}
                    assignedCount={assignedCount}
                    onChangeName={setExportName}
                    onOk={handleExport}
                    onCancel={() => {
                        setExportModalOpen(false);
                        setExportName('');
                    }}
                />
            </Content>
        </Layout>
    );
};

export default EvolutionResult;
