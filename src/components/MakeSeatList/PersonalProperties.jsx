import React, { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Col,
    Divider,
    Empty,
    Input,
    Modal,
    Row,
    Select,
    Slider,
    Space,
    Table,
    Tag,
    Tooltip,
    Typography,
    message,
} from 'antd';
import {
    CheckCircleFilled,
    DownloadOutlined,
    SearchOutlined,
    UserOutlined,
} from '@ant-design/icons';
import {
    factorOptions,
    factorLabelMap,
    createDefaultFactors,
    normalizeWeight,
} from '../../api/makeSeatList/factorUtils';

const { Text, Title } = Typography;

/**
 * PersonalProperties — 个人属性编辑器（模态框）
 *
 * Props:
 *   open         : boolean   — 模态框是否打开
 *   names        : string[]  — 完整名单列表
 *   labels       : array     — 已保存的标签 [{ name, factor, weight, color }]
 *   savedData    : array     — 已保存的个人数据 [{ name, factors: { ... } }]
 *   onCancel     : () => void
 *   onSave       : (jsonData) => void  — 返回完整的 JSON 数据
 */
const PersonalProperties = ({
    open,
    names = [],
    labels = [],
    savedData = [],
    onCancel,
    onSave,
}) => {
    // 左侧：搜索 & 选中的人
    const [searchText, setSearchText] = useState('');
    const [selectedName, setSelectedName] = useState(null);

    // 右侧：当前编辑中的人的 factor 权重
    const [currentFactors, setCurrentFactors] = useState(null);

    // 所有个人的 factor 数据（JSON 格式）
    const [allData, setAllData] = useState([]);

    // 加载标签弹窗
    const [labelLoadOpen, setLabelLoadOpen] = useState(false);

    // 打开时同步 savedData
    useEffect(() => {
        if (open) {
            setAllData(Array.isArray(savedData) ? savedData : []);
            setSelectedName(null);
            setCurrentFactors(null);
            setSearchText('');
        }
    }, [open, savedData]);

    // 选中的人切换时，同步 currentFactors
    useEffect(() => {
        if (!selectedName) {
            setCurrentFactors(null);
            return;
        }
        const existing = allData.find(d => d.name === selectedName);
        setCurrentFactors(existing?.factors
            ? { ...createDefaultFactors(), ...existing.factors }
            : createDefaultFactors()
        );
    }, [selectedName, allData]);

    // 根据搜索过滤名单
    const filteredNames = useMemo(() => {
        if (!searchText.trim()) return names;
        const q = searchText.trim().toLowerCase();
        return names.filter(n => n.toLowerCase().includes(q));
    }, [names, searchText]);

    // 判断某人是否已有数据
    const hasData = (personName) => allData.some(d => d.name === personName);

    // 更新当前选中人的某个 factor 权重
    const handleFactorChange = (factorKey, value) => {
        setCurrentFactors(prev => ({ ...prev, [factorKey]: value }));
    };

    // 保存当前选中人的数据
    const handleSavePerson = () => {
        if (!selectedName || !currentFactors) return;

        setAllData(prev => {
            const idx = prev.findIndex(d => d.name === selectedName);
            const entry = { name: selectedName, factors: { ...currentFactors } };
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = entry;
                return next;
            }
            return [...prev, entry];
        });
        message.success(`已保存「${selectedName}」的个人属性`);
    };

    // 从标签加载——打开选择弹窗
    const handleLoadFromLabel = () => {
        if (!labels || labels.length === 0) {
            message.warning('暂无可用标签，请先在标签编辑器中创建标签');
            return;
        }
        setLabelLoadOpen(true);
    };

    // 确认从某个标签加载
    const confirmLoadLabel = (label) => {
        if (!currentFactors) return;
        setCurrentFactors(prev => ({
            ...prev,
            [label.factor]: normalizeWeight(label.weight ?? 0.5),
        }));
        setLabelLoadOpen(false);
        message.success(`已从标签「${label.name}」加载权重 ${label.weight?.toFixed(2) || 0.5}`);
    };

    // 重置当前选中人的权重为默认值
    const handleResetFactors = () => {
        if (!selectedName) return;
        setCurrentFactors(createDefaultFactors());
    };

    // 删除当前选中人的数据
    const handleRemovePerson = () => {
        if (!selectedName) return;
        setAllData(prev => prev.filter(d => d.name !== selectedName));
        setCurrentFactors(createDefaultFactors());
        message.success(`已移除「${selectedName}」的数据`);
    };

    // 保存全部 & 关闭
    const handleSaveAll = () => {
        let updated = allData;

        if (selectedName && currentFactors) {
            const idx = allData.findIndex(d => d.name === selectedName);
            const entry = { name: selectedName, factors: { ...currentFactors } };
            if (idx >= 0) {
                updated = [...allData];
                updated[idx] = entry;
            } else {
                updated = [...allData, entry];
            }
            setAllData(updated);
        }

        onSave?.(updated);
        onCancel?.();
    };

    return (
        <>
            <Modal
                title={
                    <Space>
                        <UserOutlined />
                        <span>个人属性编辑器</span>
                    </Space>
                }
                open={open}
                onCancel={() => {
                    // 不保存直接关闭
                    onCancel?.();
                }}
                width="calc(100vw - 64px)"
                    style={{ top: 24 }}
                    styles={{ body: { paddingTop: 12, height: 'calc(100vh - 160px)', overflow: 'hidden' } }}
                destroyOnHidden
                footer={
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text type="secondary">
                            已配置 {allData.length} / {names.length} 人
                        </Text>
                        <Space>
                            <Button onClick={() => {
                                onCancel?.();
                            }}>
                                取消
                            </Button>
                            <Button type="primary" onClick={handleSaveAll}>
                                保存所有数据
                            </Button>
                        </Space>
                    </Space>
                }
            >
                <Row gutter={16} style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
                    {/* ========= 左侧：名单列表（可搜索） ========= */}
                    <Col span={8} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                        <div style={{ marginBottom: 8, flexShrink: 0 }}>
                            <Input
                                prefix={<SearchOutlined />}
                                placeholder="搜索姓名…"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                            />
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                            {filteredNames.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {filteredNames.map((personName) => {
                                        const isSelected = selectedName === personName;
                                        const configured = hasData(personName);
                                        return (
                                            <div
                                                key={personName}
                                                onClick={() => setSelectedName(personName)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: isSelected ? '#e6f4ff' : '#fff',
                                                    transition: 'background 0.2s',
                                                    border: '1px solid #f0f0f0',
                                                    borderRadius: 6,
                                                    padding: '8px 12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 8,
                                                }}
                                            >
                                                <Space>
                                                    <UserOutlined style={{ color: isSelected ? '#1677ff' : '#8c8c8c' }} />
                                                    <Text strong={isSelected}>{personName}</Text>
                                                </Space>
                                                {configured && (
                                                    <Tooltip title="已配置">
                                                        <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
                                                    </Tooltip>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Empty description={searchText ? '未找到匹配的姓名' : '名单为空'} />
                            )}
                        </div>
                    </Col>

                    {/* ========= 右侧：Factor 权重编辑器 ========= */}
                    <Col span={16} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        {selectedName ? (
                            <div style={{ maxHeight: 'calc(80vh - 40px)', overflow: 'auto' }}>
                                {/* 当前编辑的人标题栏（固定不滚动） */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 8,
                                    flexShrink: 0,
                                    paddingBottom: 8,
                                    borderBottom: '1px solid #f0f0f0',
                                }}>
                                    <Space>
                                        <UserOutlined style={{ fontSize: 18, color: '#1677ff' }} />
                                        <Title level={5} style={{ margin: 0 }}>{selectedName}</Title>
                                        {hasData(selectedName) && (
                                            <Tag color="success" icon={<CheckCircleFilled />}>已配置</Tag>
                                        )}
                                    </Space>
                                    <Space>
                                        <Button
                                            size="small"
                                            icon={<DownloadOutlined />}
                                            onClick={handleLoadFromLabel}
                                        >
                                            从标签加载
                                        </Button>
                                        <Button size="small" onClick={handleResetFactors}>
                                            重置
                                        </Button>
                                        {hasData(selectedName) && (
                                            <Button size="small" danger onClick={handleRemovePerson}>
                                                移除
                                            </Button>
                                        )}
                                    </Space>
                                </div>

                                {/* 滑动条列表（可滚动区域） */}
                                <div style={{
                                    flex: 1,
                                    minHeight: 0,
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    paddingRight: 6,
                                }} className="factor-weight-scroll">
                                    {currentFactors && factorOptions.map((factor) => (
                                        <div
                                            key={factor.value}
                                            style={{
                                                marginBottom: 12,
                                                padding: '8px 12px',
                                                background: '#fafafa',
                                                borderRadius: 8,
                                                border: '1px solid #f0f0f0',
                                            }}
                                        >
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: 4,
                                            }}>
                                                <Text strong>{factor.label}</Text>
                                                <Text code style={{ fontSize: 13 }}>
                                                    {currentFactors[factor.value]?.toFixed(2)}
                                                </Text>
                                            </div>
                                            <Slider
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={currentFactors[factor.value]}
                                                onChange={(val) => handleFactorChange(factor.value, val)}
                                                tooltip={{ formatter: (v) => v?.toFixed(2) }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* 保存当前人按钮（固定不滚动） */}
                                <div style={{ flexShrink: 0, marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                                    <Button type="primary" block onClick={handleSavePerson}>
                                        保存「{selectedName}」的个人属性
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Empty description="请在左侧名单中选择一个人">
                                    <Text type="secondary">选中后即可为其配置各因子的权重</Text>
                                </Empty>
                            </div>
                        )}
                    </Col>
                </Row>
            </Modal>

            {/* ========= 从标签加载的子弹窗 ========= */}
            <Modal
                title="从标签加载权重"
                open={labelLoadOpen}
                onCancel={() => setLabelLoadOpen(false)}
                footer={null}
                width={500}
                destroyOnHidden
                centered
                styles={{ body: { maxHeight: '65vh', overflow: 'hidden', padding: 12 } }}
            >
                {labels.length > 0 ? (
                    <div style={{ maxHeight: 'calc(65vh - 40px)', overflow: 'auto' }}>
                        <Table
                            size="small"
                            bordered
                            dataSource={labels}
                            rowKey="id"
                            pagination={false}
                            onRow={(record) => ({
                                style: { cursor: 'pointer' },
                                onClick: () => confirmLoadLabel(record),
                            })}
                            columns={[
                                {
                                    title: '标签',
                                    dataIndex: 'name',
                                    key: 'name',
                                    width: 120,
                                    render: (name, record) => (
                                        <Tag color={record.color}>{name}</Tag>
                                    ),
                                },
                                {
                                    title: '因子',
                                    dataIndex: 'factor',
                                    key: 'factor',
                                    width: 180,
                                    render: (factor) => factorLabelMap[factor] || factor,
                                },
                                {
                                    title: '权重',
                                    dataIndex: 'weight',
                                    key: 'weight',
                                    width: 80,
                                    render: (weight) => normalizeWeight(weight).toFixed(2),
                                },
                                {
                                    title: '操作',
                                    key: 'action',
                                    width: 70,
                                    render: (_, record) => (
                                        <Button
                                            type="link"
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                confirmLoadLabel(record);
                                            }}
                                        >
                                            应用
                                        </Button>
                                    ),
                                },
                            ]}
                        />
                    </div>
                ) : (
                    <Empty description="暂无可用标签" />
                )}
            </Modal>
        </>
    );
};

export default PersonalProperties;
