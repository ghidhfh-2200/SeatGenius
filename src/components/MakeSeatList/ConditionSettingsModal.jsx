import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Col,
    Divider,
    Empty,
    Form,
    Image,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Row,
    Select,
    Slider,
    Space,
    Table,
    Tabs,
    Tag,
    Tooltip,
    Typography,
    message,
} from 'antd';
import {
    AimOutlined,
    ApartmentOutlined,
    DeleteOutlined,
    EditOutlined,
    PlusOutlined,
    SettingOutlined,
    UserOutlined,
    TeamOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import {
    FACTOR_OPTIONS,
    FACTOR_LABEL_MAP,
    ADJACENCY_TYPES,
    createDefaultPositionRewards,
    createDefaultSpecialRewards,
    createDefaultAdjacencyRewards,
    normalizeValue,
} from '../../api/makeSeatList/conditionUtils';
import { createConditionSettingsHandlers } from '../../api/makeSeatList/conditionSettingsActions';

const { Text, Title } = Typography;

// ==================== 组件定义 ====================

/**
 * ConditionSettingsModal — 条件设置（遗传算法奖励值设置器）
 *
 * Props:
 *   open       : boolean          — 模态框是否打开
 *   conditions : array            — 现有条件列表 [{ id, name, reward, ... }]
 *   onSave     : (data) => void   — 保存回调，返回完整配置数据
 *   onCancel   : () => void       — 取消回调
 */
const ConditionSettingsModal = ({
    open,
    conditions = [],
    onSave,
    onCancel,
}) => {
    // ========== 当前选中的奖励分类 ==========
    const [activeTab, setActiveTab] = useState('position');

    // ========== 1. 位置奖励 ==========
    const [positionRewards, setPositionRewards] = useState(createDefaultPositionRewards());
    const [specialRewards, setSpecialRewards] = useState(createDefaultSpecialRewards());

    // ========== 2. 个人因子奖励 ==========
    const [factorRewards, setFactorRewards] = useState({}); // { factorKey: [ {min, max, label, reward, id}, ... ] }
    const [selectedFactor, setSelectedFactor] = useState(null);

    // ========== 3. 相邻关系奖励 ==========
    const [adjacencyRewards, setAdjacencyRewards] = useState(createDefaultAdjacencyRewards());

    // ========== 因子区间编辑弹窗 ==========
    const [factorRangeModalOpen, setFactorRangeModalOpen] = useState(false);
    const [editingFactorRange, setEditingFactorRange] = useState(null); // { factorKey, rangeIndex }
    const [factorRangeForm] = Form.useForm();

    // ========== 教室加载相关 ==========
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClassroom, setSelectedClassroom] = useState(null);
    const [classroomLoading, setClassroomLoading] = useState(false);
    const [seats, setSeats] = useState([]); // 识别出的座位列表
    const [seatRewards, setSeatRewards] = useState({}); // { seatId: rewardValue }
    const classroomAutoSelectedRef = useRef(false);

    const handlers = useMemo(
        () => createConditionSettingsHandlers({
            conditions,
            positionRewards,
            specialRewards,
            factorRewards,
            adjacencyRewards,
            seatRewards,
            seats,
            selectedClassroom,
            selectedFactor,
            editingFactorRange,
            factorRangeForm,
            onSave,
            onCancel,
            invoke,
            message,
            setClassroomLoading,
            setClassrooms,
            setSelectedClassroom,
            setSeats,
            setSeatRewards,
            setPositionRewards,
            setSpecialRewards,
            setFactorRewards,
            setAdjacencyRewards,
            setSelectedFactor,
            setFactorRangeModalOpen,
            setEditingFactorRange,
        }),
        [
            conditions,
            positionRewards,
            specialRewards,
            factorRewards,
            adjacencyRewards,
            seatRewards,
            seats,
            selectedClassroom,
            selectedFactor,
            editingFactorRange,
            factorRangeForm,
            onSave,
            onCancel,
            message,
            invoke,
        ],
    );

    const {
        loadClassrooms,
        handleSelectClassroom,
        handleSeatRewardChange,
        handleBatchSetRewards,
        handleBatchSetByZone,
        handlePositionChange,
        handleSpecialChange,
        handleSelectFactor,
        handleAddFactorRange,
        handleEditFactorRange,
        handleDeleteFactorRange,
        handleSaveFactorRange,
        handleAdjacencyChange,
        handleSave,
        handleResetAll,
    } = handlers;

    useEffect(() => {
        if (!open) {
            setClassrooms([]);
            setSelectedClassroom(null);
            setSeats([]);
            setSeatRewards({});
            classroomAutoSelectedRef.current = false;
            return;
        }

        loadClassrooms();
    }, [open]);

    useEffect(() => {
        if (!open || classroomAutoSelectedRef.current || classrooms.length === 0 || selectedClassroom) {
            return;
        }

        const rewardConfig = conditions.find(c => c._isRewardConfig);
        const classroomSgid = rewardConfig?.classroomSgid;
        if (!classroomSgid) {
            return;
        }

        const matched = classrooms.find(c => c.sgid === classroomSgid);
        if (!matched) {
            return;
        }

        classroomAutoSelectedRef.current = true;
        handleSelectClassroom(matched);
    }, [open, classrooms, conditions, selectedClassroom]);


    // ========== 颜色辅助 ==========

    const getRewardColor = (value) => {
        if (value >= 0.8) return '#f5222d';
        if (value >= 0.6) return '#fa8c16';
        if (value >= 0.4) return '#1677ff';
        if (value >= 0.2) return '#52c41a';
        return '#8c8c8c';
    };

    const getRewardBgColor = (value) => {
        if (value >= 0.8) return '#fff1f0';
        if (value >= 0.6) return '#fff7e6';
        if (value >= 0.4) return '#e6f4ff';
        if (value >= 0.2) return '#f6ffed';
        return '#fafafa';
    };

    // ==================== 各 Tab 内容 ====================

    /** Tab 1：位置奖励 — 基于教室的座位权重设置 */
    const PositionRewardsTab = () => (
        <div>
            {/* ===== 第一步：选择教室 ===== */}
            <Card
                size="small"
                title={
                    <Space>
                        <CheckCircleOutlined />
                        <span>第一步：选择教室</span>
                    </Space>
                }
                style={{ marginBottom: 16 }}
            >
                <Space orientation="vertical" style={{ width: '100%' }}>
                    {/* 工具栏 */}
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={loadClassrooms}
                            loading={classroomLoading}
                            size="small"
                        >
                            刷新列表
                        </Button>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            已存储 {classrooms.length} 个教室
                        </Text>
                    </Space>

                    {/* 教室选择下拉 */}
                    <Select
                        style={{ width: '100%' }}
                        placeholder="请选择一个教室..."
                        loading={classroomLoading}
                        value={selectedClassroom?.sgid || undefined}
                        onChange={(sgid) => {
                            const classroom = classrooms.find(c => c.sgid === sgid);
                            if (classroom) handleSelectClassroom(classroom);
                        }}
                        options={classrooms.map(c => ({
                            value: c.sgid,
                            label: `${c.name || '未命名'} (${c.create_time || ''})`,
                        }))}
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label || '').toLowerCase().includes(input.toLowerCase())
                        }
                        notFoundContent={classroomLoading ? '加载中...' : '暂无可用教室'}
                    />
                </Space>
            </Card>

            {/* ===== 第二步（已选教室后显示）：教室预览与座位识别 ===== */}
            {selectedClassroom && (
                <Card
                    size="small"
                    title={
                        <Space>
                            <AimOutlined />
                            <span>第二步：座位识别与权重设置</span>
                            <Tag color="blue">{seats.length} 个座位</Tag>
                        </Space>
                    }
                    extra={
                        <Space>
                            <Button size="small" onClick={() => setSeatRewards({})}>
                                重置权重
                            </Button>
                            <Button size="small" onClick={() => handleBatchSetRewards(0.5)}>
                                全部设为 0.5
                            </Button>
                        </Space>
                    }
                    style={{ marginBottom: 16 }}
                >
                    {/* 教室预览缩略图 */}
                    <Card size="small" title="教室预览" style={{ marginBottom: 12 }}>
                        <div style={{
                            background: '#fafafa',
                            borderRadius: 6,
                            padding: 8,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: 120,
                            overflow: 'auto',
                        }}>
                            {selectedClassroom.preview_svg ? (
                                <div
                                    style={{ maxWidth: '100%', maxHeight: 200 }}
                                    dangerouslySetInnerHTML={{
                                        __html: selectedClassroom.preview_svg
                                    }}
                                />
                            ) : (
                                <Text type="secondary">无预览图</Text>
                            )}
                        </div>
                    </Card>

                    {/* 座位权重设置表格 */}
                    {seats.length > 0 ? (
                        <div style={{ maxHeight: 400, overflow: 'auto' }}>
                            <Table
                                size="small"
                                bordered
                                dataSource={seats}
                                rowKey="id"
                                pagination={false}
                                columns={[
                                    {
                                        title: '序号',
                                        key: 'index',
                                        width: 50,
                                        render: (_, __, idx) => idx + 1,
                                    },
                                    {
                                        title: '座位ID',
                                        dataIndex: 'id',
                                        key: 'id',
                                        width: 80,
                                        render: (id) => (
                                            <Text code style={{ fontSize: 11 }}>{id}</Text>
                                        ),
                                    },
                                    {
                                        title: '类型',
                                        dataIndex: 'type',
                                        key: 'type',
                                        width: 60,
                                        render: (type) => (
                                            <Tag color={type === 'seat' ? 'blue' : type === 'chair' ? 'red' : 'green'}>
                                                {type}
                                            </Tag>
                                        ),
                                    },
                                    {
                                        title: '位置坐标',
                                        key: 'position',
                                        width: 140,
                                        render: (_, record) => (
                                            <Text style={{ fontSize: 12 }}>
                                                ({Math.round(record.x)}, {Math.round(record.y)})
                                            </Text>
                                        ),
                                    },
                                    {
                                        title: '权重（奖励值）',
                                        dataIndex: 'reward',
                                        key: 'reward',
                                        width: 220,
                                        render: (_, record) => {
                                            const value = seatRewards[record.id] ?? 0.5;
                                            return (
                                                <Space>
                                                    <Slider
                                                        min={0} max={1} step={0.01}
                                                        value={value}
                                                        onChange={(val) => handleSeatRewardChange(record.id, val)}
                                                        tooltip={{ formatter: (v) => v?.toFixed(2) }}
                                                        style={{ width: 120, margin: 0 }}
                                                    />
                                                    <InputNumber
                                                        min={0} max={1} step={0.01}
                                                        value={value}
                                                        onChange={(val) => handleSeatRewardChange(record.id, val)}
                                                        style={{ width: 65 }}
                                                        size="small"
                                                    />
                                                </Space>
                                            );
                                        },
                                    },
                                ]}
                            />
                        </div>
                    ) : (
                        <Empty description="未识别到座位元素">
                            <Text type="secondary">
                                请确认教室中包含 {['seat', 'chair', 'desk'].join('、')} 类型的元素
                            </Text>
                        </Empty>
                    )}
                </Card>
            )}

            {/* 未选择教室时的提示 */}
            {!selectedClassroom && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    background: '#fafafa',
                    borderRadius: 8,
                    border: '1px dashed #d9d9d9',
                }}>
                    <AimOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                    <Text type="secondary" style={{ marginBottom: 8 }}>
                        请先在上方选择一个已存储的教室
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        系统将自动识别教室中的座位，并允许您为每个座位设置权重
                    </Text>
                </div>
            )}
        </div>
    );

    /** Tab 2：个人因子奖励 */
    const FactorRewardsTab = () => (
        <div>
            <Row gutter={16}>
                {/* 左侧：因子选择 */}
                <Col span={8}>
                    <Card
                        size="small"
                        title="选择因子"
                        styles={{ body: { padding: '8px 12px', maxHeight: 400, overflow: 'auto' } }}
                    >
                        <Space orientation="vertical" style={{ width: '100%' }}>
                            {FACTOR_OPTIONS.map(factor => {
                                const hasConfig = !!factorRewards[factor.value];
                                return (
                                    <Button
                                        key={factor.value}
                                        type={selectedFactor === factor.value ? 'primary' : hasConfig ? 'dashed' : 'default'}
                                        block
                                        icon={<UserOutlined />}
                                        onClick={() => handleSelectFactor(factor.value)}
                                        style={{
                                            textAlign: 'left',
                                            height: 'auto',
                                            padding: '6px 12px',
                                            justifyContent: 'flex-start',
                                        }}
                                    >
                                        <Space orientation="vertical" size={0} style={{ textAlign: 'left' }}>
                                            <Text style={{ fontSize: 13, lineHeight: 1.4 }}>{factor.label}</Text>
                                            {hasConfig && (
                                                <Text style={{ fontSize: 11, color: '#52c41a' }}>✓ 已配置 {factorRewards[factor.value].length} 个区间</Text>
                                            )}
                                        </Space>
                                    </Button>
                                );
                            })}
                        </Space>
                    </Card>
                </Col>

                {/* 右侧：区间配置 */}
                <Col span={16}>
                    {selectedFactor ? (
                        <Card
                            size="small"
                            title={
                                <Space>
                                    <span>{FACTOR_LABEL_MAP[selectedFactor] || selectedFactor}</span>
                                    <Tag color="blue">值区间奖励配置</Tag>
                                </Space>
                            }
                            extra={
                                <Button
                                    type="primary"
                                    ghost
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={handleAddFactorRange}
                                >
                                    添加区间
                                </Button>
                            }
                            styles={{ body: { padding: '8px 12px' } }}
                        >
                            {(factorRewards[selectedFactor] || []).length > 0 ? (
                                <div style={{ maxHeight: 360, overflow: 'auto' }}>
                                    <Table
                                        size="small"
                                        bordered
                                        dataSource={factorRewards[selectedFactor]}
                                        rowKey="id"
                                        pagination={false}
                                        columns={[
                                            {
                                                title: '区间标签',
                                                dataIndex: 'label',
                                                key: 'label',
                                                width: 140,
                                                render: (label) => <Text strong>{label}</Text>,
                                            },
                                            {
                                                title: '最小值',
                                                dataIndex: 'min',
                                                key: 'min',
                                                width: 70,
                                                render: (val) => val.toFixed(2),
                                            },
                                            {
                                                title: '最大值',
                                                dataIndex: 'max',
                                                key: 'max',
                                                width: 70,
                                                render: (val) => val.toFixed(2),
                                            },
                                            {
                                                title: '奖励值',
                                                dataIndex: 'reward',
                                                key: 'reward',
                                                width: 90,
                                                render: (reward) => (
                                                    <Tag color={reward >= 0.5 ? 'blue' : 'default'}>
                                                        {normalizeValue(reward).toFixed(2)}
                                                    </Tag>
                                                ),
                                            },
                                            {
                                                title: '操作',
                                                key: 'action',
                                                width: 120,
                                                render: (_, __, idx) => (
                                                    <Space>
                                                        <Button type="link" size="small" icon={<EditOutlined />}
                                                            onClick={() => handleEditFactorRange(idx)}>编辑</Button>
                                                        <Popconfirm title="删除该区间？"
                                                            onConfirm={() => handleDeleteFactorRange(idx)}>
                                                            <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
                                                        </Popconfirm>
                                                    </Space>
                                                ),
                                            },
                                        ]}
                                    />
                                </div>
                            ) : (
                                <Empty description={
                                    <Space orientation="vertical" size="small">
                                        <Text type="secondary">暂无区间配置</Text>
                                        <Button type="primary" ghost size="small" icon={<PlusOutlined />} onClick={handleAddFactorRange}>
                                            添加区间
                                        </Button>
                                    </Space>
                                } />
                            )}
                        </Card>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                            <Empty description="请在左侧选择一个因子">
                                <Text type="secondary">选中后即可配置该因子各取值区间的奖励值</Text>
                            </Empty>
                        </div>
                    )}
                </Col>
            </Row>

            {/* 因子区间编辑弹窗 */}
            <Modal
                title={editingFactorRange !== null ? '编辑值区间' : '添加值区间'}
                open={factorRangeModalOpen}
                forceRender
                onCancel={() => {
                    setFactorRangeModalOpen(false);
                    setEditingFactorRange(null);
                    factorRangeForm.resetFields();
                }}
                onOk={handleSaveFactorRange}
                okText={editingFactorRange !== null ? '保存' : '添加'}
                destroyOnHidden
                centered
            >
                <Form
                    form={factorRangeForm}
                    layout="vertical"
                    initialValues={{ min: 0, max: 1, label: '', reward: 0.5 }}
                >
                    <Form.Item
                        name="label"
                        label="区间标签"
                        rules={[{ required: true, message: '请输入区间标签' }]}
                    >
                        <Input placeholder="如：社交活跃度高、身高偏低..." />
                    </Form.Item>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item
                                name="min"
                                label="最小值（含）"
                                rules={[{ required: true, message: '请输入最小值' }]}
                            >
                                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="max"
                                label="最大值（含）"
                                rules={[{ required: true, message: '请输入最大值' }]}
                            >
                                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item
                        name="reward"
                        label="奖励值（0~1）"
                        rules={[{ required: true, message: '请设置奖励值' }]}
                    >
                        <Slider
                            min={0} max={1} step={0.01}
                            tooltip={{ formatter: (v) => v?.toFixed(2) }}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );

    /** Tab 3：相邻关系奖励 */
    const AdjacencyRewardsTab = () => (
        <div>
            {ADJACENCY_TYPES.map(adjType => (
                <Card
                    key={adjType.key}
                    size="small"
                    title={
                        <Space>
                            <TeamOutlined />
                            <span>{adjType.label}</span>
                            <Tag color="geekblue">{adjType.desc}</Tag>
                        </Space>
                    }
                    style={{ marginBottom: 12 }}
                    styles={{ body: { paddingTop: 8 } }}
                >
                    <Row gutter={[12, 12]}>
                        {adjType.subTypes.map(subType => {
                            const value = adjacencyRewards[subType.key] ?? subType.defaultValue;
                            return (
                                <Col span={12} key={subType.key}>
                                    <div style={{
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        background: getRewardBgColor(value),
                                        border: `1px solid ${getRewardColor(value)}30`,
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: 4,
                                        }}>
                                            <Space>
                                                <Badge color={getRewardColor(value)} />
                                                <Text strong>{subType.label}</Text>
                                            </Space>
                                            <Text strong style={{ fontSize: 15, color: getRewardColor(value) }}>
                                                {value.toFixed(2)}
                                            </Text>
                                        </div>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                            {subType.desc}
                                        </Text>
                                        <Slider
                                            min={0} max={1} step={0.01}
                                            value={value}
                                            onChange={(val) => handleAdjacencyChange(subType.key, val)}
                                            tooltip={{ formatter: (v) => v?.toFixed(2) }}
                                        />
                                    </div>
                                </Col>
                            );
                        })}
                    </Row>
                </Card>
            ))}
        </div>
    );

    // ==================== 主渲染 ====================

    const tabItems = [
        {
            key: 'position',
            label: (
                <span>
                    <AimOutlined /> 位置奖励
                </span>
            ),
            children: <PositionRewardsTab />,
        },
        {
            key: 'factor',
            label: (
                <span>
                    <UserOutlined /> 个人因子奖励
                </span>
            ),
            children: <FactorRewardsTab />,
        },
        {
            key: 'adjacency',
            label: (
                <span>
                    <ApartmentOutlined /> 相邻关系奖励
                </span>
            ),
            children: <AdjacencyRewardsTab />,
        },
    ];

    return (
        <>
            <Modal
                title={
                    <Space>
                        <SettingOutlined />
                        <span>条件设置 — 遗传算法奖励值设置器</span>
                    </Space>
                }
                open={open}
                forceRender
                onCancel={onCancel}
                width={900}
                style={{ top: 20 }}
                styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflow: 'hidden', paddingTop: 12 } }}
                destroyOnHidden
                footer={
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                            <Button onClick={handleResetAll} size="small">重置为默认</Button>
                        </Space>
                        <Space>
                            <Button onClick={onCancel}>取消</Button>
                            <Button type="primary" onClick={handleSave}>
                                保存配置
                            </Button>
                        </Space>
                    </Space>
                }
            >
                <div style={{ height: 'calc(100vh - 220px)', overflow: 'auto', paddingRight: 8 }}>
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={tabItems}
                        size="small"
                        style={{ marginTop: -8 }}
                    />
                </div>
            </Modal>
        </>
    );
};

export default ConditionSettingsModal;
