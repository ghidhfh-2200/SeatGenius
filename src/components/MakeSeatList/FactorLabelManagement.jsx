import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import {
    Badge,
    Button,
    Card,
    Col,
    Divider,
    Empty,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Row,
    Select,
    Slider,
    Space,
    Statistic,
    Table,
    Tag,
    Tooltip,
    Typography,
    message,
} from 'antd';
import {
    AimOutlined,
    ApartmentOutlined,
    CalculatorOutlined,
    CheckCircleFilled,
    DeleteOutlined,
    EditOutlined,
    FolderOpenOutlined,
    PlayCircleOutlined,
    PlusOutlined,
    SaveOutlined,
    SettingOutlined,
    UserOutlined,
} from '@ant-design/icons';
import AddLabelModal from './AddLabelModal';
import PersonalProperties from './PersonalProperties';
import ConditionSettingsModal from './ConditionSettingsModal';
import StartEvolutionModal from './StartEvolutionModal';
import SplitPane from '../SplitPane';
import {
    factorOptions,
    factorLabelMap,
    createId,
    randomColor,
    normalizeWeight,
    normalizeLoadedLabels,
} from '../../api/makeSeatList/factorUtils';
import {
    buildRewardConfigEntry,
    buildRewardCalculationPayload,
    buildEvolutionPayload,
    buildProfileData,
    applyLoadedProfileData,
    getRewardConfigStats,
} from '../../api/makeSeatList/seatPlanActions';

const { Text, Title } = Typography;

const FactorLabelManagement = ({ names = [] }) => {
    const navigate = useNavigate();
    // personalAttrs 存储每人 JSON：{ name: string, factors: { height: number, gender: number, ... } }
    const [personalAttrs, setPersonalAttrs] = useState([]);
    const [conditions, setConditions] = useState([]);
    const [labels, setLabels] = useState([]);
    const [selectedLabelId, setSelectedLabelId] = useState(null);
    const [editorVisible, setEditorVisible] = useState(false);

    // 新 PersonalProperties 模态框
    const [personalPropsOpen, setPersonalPropsOpen] = useState(false);

    // 条件设置（位置奖励值）模态框
    const [conditionSettingsOpen, setConditionSettingsOpen] = useState(false);
    const [startEvolutionOpen, setStartEvolutionOpen] = useState(false);
    const [startingEvolution, setStartingEvolution] = useState(false);

    const [labelModalOpen, setLabelModalOpen] = useState(false);
    const [editingLabelId, setEditingLabelId] = useState(null);
    const [labelName, setLabelName] = useState('');
    const [labelColor, setLabelColor] = useState('#1677ff');
    const [labelFactor, setLabelFactor] = useState(factorOptions[0].value);
    const [labelWeight, setLabelWeight] = useState(0.5);

    // ========== 档案管理 ==========
    const [saveProfileModalOpen, setSaveProfileModalOpen] = useState(false);
    const [loadProfileModalOpen, setLoadProfileModalOpen] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [profileDescription, setProfileDescription] = useState('');
    const [profileList, setProfileList] = useState([]);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const profileLoadedRef = useRef(false);

    useEffect(() => {
        let active = true;
        invoke('get_default_labels')
            .then((payload) => {
                if (!active) return;
                const normalized = normalizeLoadedLabels(payload);
                setLabels(normalized);
                setSelectedLabelId(normalized[0]?.id || null);
            })
            .catch((err) => {
                console.error('读取默认标签失败', err);
                message.error('读取默认标签失败：' + String(err));
            });

        return () => {
            active = false;
        };
    }, []);

    const selectedLabel = useMemo(
        () => labels.find(item => item.id === selectedLabelId) || null,
        [labels, selectedLabelId]
    );

    const persistLabels = async (nextLabels) => {
        try {
            await invoke('save_default_labels', {
                labels: nextLabels.map(({ id, ...rest }) => rest),
            });
        } catch (err) {
            console.error('保存默认标签失败', err);
            message.error('保存默认标签失败：' + String(err));
        }
    };

    const commitLabels = (updater) => {
        setLabels(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            persistLabels(next);
            return next;
        });
    };

    const resetLabelDraft = (label = null) => {
        if (label) {
            setEditingLabelId(label.id);
            setLabelName(label.name);
            setLabelColor(label.color);
            setLabelFactor(label.factor);
            setLabelWeight(normalizeWeight(label.weight));
        } else {
            setEditingLabelId(null);
            setLabelName('');
            setLabelColor(randomColor());
            setLabelFactor(factorOptions[0].value);
            setLabelWeight(0.5);
        }
    };

    const saveLabel = ({ value, color, factor, weight }) => {
        const next = String(value || '').trim();
        if (!next) return;

        const nextColor = color || randomColor();
        const nextFactor = factor || factorOptions[0].value;
        const nextWeight = normalizeWeight(weight);

        if (editingLabelId) {
            commitLabels(prev => prev.map(item => item.id === editingLabelId
                ? { ...item, name: next, color: nextColor, factor: nextFactor, weight: nextWeight }
                : item));
        } else {
            const created = { id: createId(), name: next, color: nextColor, factor: nextFactor, weight: nextWeight };
            commitLabels(prev => [...prev, created]);
            setSelectedLabelId(created.id);
        }

        setLabelModalOpen(false);
    };

    const removeLabel = (id) => {
        commitLabels(prev => {
            const next = prev.filter(item => item.id !== id);
            if (selectedLabelId === id) setSelectedLabelId(next[0]?.id || null);
            return next;
        });
        message.success('已删除标签');
    };

    const updateLabelWeight = (id, nextWeight) => {
        commitLabels(prev => prev.map(item => item.id === id ? { ...item, weight: normalizeWeight(nextWeight) } : item));
    };

    const removePersonal = (personName) => {
        setPersonalAttrs(prev => prev.filter(item => item.name !== personName));
        message.success(`已移除「${personName}」的个人数据`);
    };

    // PersonalProperties 保存回调——接收完整 JSON 数据
    const handlePersonalSave = (jsonData) => {
        setPersonalAttrs(jsonData);
        if (jsonData.length > 0) {
            message.success(`已保存 ${jsonData.length} 人的个人属性数据`);
        }
    };

    const removeCondition = (idx) => {
        setConditions(prev => prev.filter((_, i) => i !== idx));
    };

    // 条件设置（奖励配置）保存回调
    const handleConditionSettingsSave = (data) => {
        // 将奖励配置保存到 conditions 中
        setConditions(prev => {
            const existingIdx = prev.findIndex(c => c._isRewardConfig);
            const rewardEntry = buildRewardConfigEntry(data);
            if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = rewardEntry;
                return next;
            }
            return [...prev, rewardEntry];
        });
        message.success('奖励配置已保存');
    };

    // ========== 奖励值计算结果 ==========
    const [calcResultOpen, setCalcResultOpen] = useState(false);
    const [calcResults, setCalcResults] = useState(null);
    const [calcLoading, setCalcLoading] = useState(false);

    // 调用 Rust 算法计算奖励值
    const handleCalculateRewards = async () => {
        // 查找奖励配置
        const rewardConfig = conditions.find(c => c._isRewardConfig);
        if (!rewardConfig) {
            message.warning('请先保存奖励配置（位置/因子/相邻关系）');
            return;
        }
        if (personalAttrs.length === 0) {
            message.warning('请先配置个人属性数据');
            return;
        }

        setCalcLoading(true);
        try {
            const payload = buildRewardCalculationPayload(rewardConfig, personalAttrs);

            const result = await invoke('calculate_rewards', { payload });
            setCalcResults(result);
            setCalcResultOpen(true);
        } catch (err) {
            console.error('计算奖励值失败', err);
            message.error('计算奖励值失败：' + String(err));
        } finally {
            setCalcLoading(false);
        }
    };

    const handleStartEvolution = async (classroom) => {
        const rewardConfig = conditions.find(c => c._isRewardConfig);
        if (!rewardConfig) {
            message.warning('请先保存奖励配置');
            return;
        }
        if (personalAttrs.length === 0) {
            message.warning('请先配置个人属性数据');
            return;
        }

        setStartingEvolution(true);
        try {
            await invoke('start_evolution', { payload: buildEvolutionPayload({ classroom, names, personalAttrs, conditions, rewardConfig }) });

            setStartEvolutionOpen(false);
            message.success('已启动遗传算法演化任务');
            navigate('/evolution-status', { state: { classroom } });
        } catch (err) {
            console.error('启动演化失败', err);
            message.error('启动演化失败：' + String(err));
        } finally {
            setStartingEvolution(false);
        }
    };

    // ========== 加载档案列表 ==========
    const loadProfileList = async () => {
        setProfileLoading(true);
        try {
            const list = await invoke('get_profile_list');
            setProfileList(Array.isArray(list) ? list : []);
        } catch (error) {
            console.error('加载档案列表失败', error);
            message.error('加载档案列表失败：' + String(error));
        } finally {
            setProfileLoading(false);
        }
    };

    // ========== 保存为档案 ==========
    const handleSaveProfile = async () => {
        if (!profileName.trim()) {
            message.warning('请输入档案名称');
            return;
        }

        setProfileSaving(true);
        try {
            const rewardConfig = conditions.find(c => c._isRewardConfig);
            const data = buildProfileData({ rewardConfig, names, personalAttrs, conditions, labels });

            await invoke('save_profile', {
                name: profileName.trim(),
                description: profileDescription.trim(),
                data,
            });

            message.success(`档案「${profileName.trim()}」保存成功`);
            setSaveProfileModalOpen(false);
            setProfileName('');
            setProfileDescription('');
        } catch (error) {
            console.error('保存档案失败', error);
            message.error('保存档案失败：' + String(error));
        } finally {
            setProfileSaving(false);
        }
    };

    // ========== 从档案加载 ==========
    const handleLoadProfile = async (profileId) => {
        setProfileLoading(true);
        try {
            const data = await invoke('load_profile', { id: profileId });
            const next = applyLoadedProfileData(data);
            if (next.personalAttrs) {
                setPersonalAttrs(next.personalAttrs);
            }
            if (next.conditions) {
                setConditions(next.conditions);
            }
            if (next.labels) {
                const normalized = next.labels;
                setLabels(normalized);
                setSelectedLabelId(normalized[0]?.id || null);
                // 持久化标签到后端
                try {
                    await invoke('save_default_labels', {
                        labels: normalized.map(({ id, ...rest }) => rest),
                    });
                } catch (err) {
                    console.error('保存加载的标签失败', err);
                }
            }

            profileLoadedRef.current = true;
            message.success('档案加载成功');
            setLoadProfileModalOpen(false);
        } catch (error) {
            console.error('加载档案失败', error);
            message.error('加载档案失败：' + String(error));
        } finally {
            setProfileLoading(false);
        }
    };

    // ========== 删除档案 ==========
    const handleDeleteProfile = async (profileId) => {
        try {
            await invoke('delete_profile', { id: profileId });
            message.success('档案已删除');
            loadProfileList();
        } catch (error) {
            console.error('删除档案失败', error);
            message.error('删除档案失败：' + String(error));
        }
    };

    // 条件列表项中统计信息辅助
    const getConfigStats = (item) => {
        return getRewardConfigStats(item);
    };

    return (
        <LayoutShell
            names={names}
            personalAttrs={personalAttrs}
            setPersonalPropsOpen={setPersonalPropsOpen}
            removePersonal={removePersonal}
            conditions={conditions}
            removeCondition={removeCondition}
            setEditorVisible={setEditorVisible}
            setConditionSettingsOpen={setConditionSettingsOpen}
            handleCalculateRewards={handleCalculateRewards}
            calcLoading={calcLoading}
            getConfigStats={getConfigStats}
            setStartEvolutionOpen={setStartEvolutionOpen}
            canStartEvolution={personalAttrs.length > 0 && conditions.some(c => c._isRewardConfig)}
            onSaveProfile={() => {
                setProfileName('');
                setProfileDescription('');
                setSaveProfileModalOpen(true);
            }}
            onLoadProfile={() => {
                loadProfileList();
                setLoadProfileModalOpen(true);
            }}
        >
            {/* ========= PersonalProperties 模态框 ========= */}
            <PersonalProperties
                open={personalPropsOpen}
                names={names}
                labels={labels}
                savedData={personalAttrs}
                onCancel={() => setPersonalPropsOpen(false)}
                onSave={handlePersonalSave}
            />

            {/* ========= 条件设置（位置奖励值）模态框 ========= */}
            <ConditionSettingsModal
                open={conditionSettingsOpen}
                conditions={conditions}
                onSave={handleConditionSettingsSave}
                onCancel={() => setConditionSettingsOpen(false)}
            />

            <StartEvolutionModal
                open={startEvolutionOpen}
                loading={startingEvolution}
                onCancel={() => setStartEvolutionOpen(false)}
                onOk={handleStartEvolution}
            />

            {/* ========= 奖励值计算结果弹窗 ========= */}
            <Modal
                title={
                    <Space>
                        <CalculatorOutlined />
                        <span>奖励值计算结果</span>
                    </Space>
                }
                open={calcResultOpen}
                onCancel={() => setCalcResultOpen(false)}
                width={800}
                style={{ top: 20 }}
                styles={{ body: { maxHeight: 'calc(100vh - 180px)', overflow: 'hidden' } }}
                footer={
                    <Button onClick={() => setCalcResultOpen(false)}>关闭</Button>
                }
                destroyOnHidden
            >
                {calcResults ? (
                    <div style={{ maxHeight: 'calc(100vh - 240px)', overflow: 'auto' }}>
                        {/* 总体统计 */}
                        <Card size="small" style={{ marginBottom: 12 }}>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Statistic
                                        title="总人数"
                                        value={calcResults.total_students || 0}
                                        prefix={<UserOutlined />}
                                    />
                                </Col>
                                <Col span={8}>
                                    <Statistic
                                        title="平均奖励值"
                                        value={(calcResults.avg_reward || 0).toFixed(4)}
                                        precision={4}
                                        valueStyle={{ color: '#1677ff' }}
                                    />
                                </Col>
                                <Col span={8}>
                                    <Statistic
                                        title="总适应度"
                                        value={(calcResults.total_fitness || 0).toFixed(4)}
                                        precision={4}
                                        valueStyle={{ color: '#52c41a' }}
                                    />
                                </Col>
                            </Row>
                        </Card>

                        {/* 各分类奖励值统计 */}
                        {calcResults.category_stats && (
                            <Card size="small" title="分类奖励统计" style={{ marginBottom: 12 }}>
                                <Row gutter={[16, 8]}>
                                    {Object.entries(calcResults.category_stats).map(([key, val]) => (
                                        <Col span={8} key={key}>
                                            <Statistic
                                                title={key}
                                                value={typeof val === 'number' ? val.toFixed(4) : val}
                                                precision={4}
                                            />
                                        </Col>
                                    ))}
                                </Row>
                            </Card>
                        )}

                        {/* 个人奖励详情表格 */}
                        {calcResults.student_rewards && calcResults.student_rewards.length > 0 && (
                            <Card size="small" title="个人奖励详情">
                                <Table
                                    size="small"
                                    bordered
                                    dataSource={calcResults.student_rewards}
                                    rowKey="name"
                                    pagination={false}
                                    scroll={{ y: 300 }}
                                    columns={[
                                        {
                                            title: '姓名',
                                            dataIndex: 'name',
                                            key: 'name',
                                            width: 100,
                                            fixed: 'left',
                                            render: (name) => <Text strong>{name}</Text>,
                                        },
                                        {
                                            title: '位置奖励',
                                            dataIndex: 'position_reward',
                                            key: 'position_reward',
                                            width: 100,
                                            render: (val) => <Tag color="blue">{val?.toFixed(4)}</Tag>,
                                        },
                                        {
                                            title: '因子奖励',
                                            dataIndex: 'factor_reward',
                                            key: 'factor_reward',
                                            width: 100,
                                            render: (val) => <Tag color="green">{val?.toFixed(4)}</Tag>,
                                        },
                                        {
                                            title: '相邻关系奖励',
                                            dataIndex: 'adjacency_reward',
                                            key: 'adjacency_reward',
                                            width: 110,
                                            render: (val) => <Tag color="orange">{val?.toFixed(4)}</Tag>,
                                        },
                                        {
                                            title: '总奖励值',
                                            dataIndex: 'total_reward',
                                            key: 'total_reward',
                                            width: 100,
                                            render: (val) => (
                                                <Text strong style={{ color: '#f5222d' }}>{val?.toFixed(4)}</Text>
                                            ),
                                        },
                                    ]}
                                />
                            </Card>
                        )}
                    </div>
                ) : (
                    <Empty description="暂无计算结果" />
                )}
            </Modal>

            <Modal
                title="标签编辑器"
                open={editorVisible}
                onCancel={() => setEditorVisible(false)}
                footer={null}
                width="calc(100vw - 32px)"
                style={{ top: 16 }}
                styles={{ body: { paddingTop: 12, height: 'calc(100vh - 120px)', overflow: 'hidden' } }}
                destroyOnHidden
            >
                <Row gutter={16} style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
                    <Col span={10} style={{ maxHeight: 'calc(80vh - 40px)', overflow: 'auto' }}>
                        <Card
                            size="small"
                            title={(
                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                    <span>标签列表</span>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => {
                                            resetLabelDraft();
                                            setLabelModalOpen(true);
                                        }}
                                    >
                                        新增标签
                                    </Button>
                                </Space>
                            )}
                            style={{ flex: 1, minHeight: 0 }}
                            styles={{ body: { height: '100%', overflow: 'hidden' } }}
                        >
                            <div style={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, marginBottom: 0 }}>
                                    {labels.map((label) => (
                                        <div
                                            key={label.id}
                                            style={{
                                                cursor: 'pointer',
                                                background: selectedLabelId === label.id ? '#e6f4ff' : '#fff',
                                                border: '1px solid #f0f0f0',
                                                borderRadius: 6,
                                                padding: '8px 12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 12,
                                            }}
                                            onClick={() => setSelectedLabelId(label.id)}
                                        >
                                            <Space wrap>
                                                <Tag color={label.color}>{label.name}</Tag>
                                                <Text type="secondary">{factorLabelMap[label.factor] || label.factor}</Text>
                                                <Text type="secondary">权重：{label.weight.toFixed(2)}</Text>
                                            </Space>
                                            <Space>
                                                <Button
                                                    type="link"
                                                    icon={<EditOutlined />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        resetLabelDraft(label);
                                                        setLabelModalOpen(true);
                                                    }}
                                                >
                                                    编辑
                                                </Button>
                                                <Popconfirm title="删除该标签？" onConfirm={() => removeLabel(label.id)}>
                                                    <Button type="link" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>删除</Button>
                                                </Popconfirm>
                                            </Space>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </Col>

                    <Col span={14} style={{ display: 'flex', minHeight: 0}}>
                        <Card
                            size="small"
                            title={selectedLabel ? `标签详情：${selectedLabel.name}` : '标签详情'}
                            style={{ flex: 1, minHeight: 0 }}
                            styles={{ body: { height: '100%', overflow: 'auto' } }}
                        >
                            {selectedLabel ? (
                                <Space orientation="vertical" style={{ width: '100%' }} size="large">
                                    <Space wrap>
                                        <Tag color={selectedLabel.color}>{selectedLabel.name}</Tag>
                                        <Text type="secondary">颜色：{selectedLabel.color}</Text>
                                    </Space>
                                    <div>
                                        <Text strong>因子</Text>
                                        <div>{factorLabelMap[selectedLabel.factor] || selectedLabel.factor}</div>
                                    </div>
                                    <div>
                                        <Text strong>权重</Text>
                                        <Slider
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={selectedLabel.weight}
                                            onChange={(value) => updateLabelWeight(selectedLabel.id, value)}
                                        />
                                    </div>
                                </Space>
                            ) : (
                                <Empty description="请选择一个标签" />
                            )}
                        </Card>
                    </Col>
                </Row>

                <AddLabelModal
                    open={labelModalOpen}
                    title={editingLabelId ? '编辑标签' : '新增标签'}
                    initialValue={labelName}
                    initialColor={labelColor}
                    initialFactor={labelFactor}
                    initialWeight={labelWeight}
                    showColor
                    showFactor
                    showWeight
                    factorOptions={factorOptions}
                    placeholder="请输入标签名称"
                    confirmText={editingLabelId ? '保存' : '新增'}
                    onOk={saveLabel}
                    onCancel={() => setLabelModalOpen(false)}
                />
            </Modal>

            {/* ===== 保存为档案弹窗 ===== */}
            <Modal
                title={
                    <Space>
                        <SaveOutlined />
                        <span>保存为档案</span>
                    </Space>
                }
                open={saveProfileModalOpen}
                onCancel={() => {
                    setSaveProfileModalOpen(false);
                    setProfileName('');
                    setProfileDescription('');
                }}
                onOk={handleSaveProfile}
                okText="保存"
                confirmLoading={profileSaving}
                destroyOnHidden
                centered
            >
                <Space orientation="vertical" style={{ width: '100%' }}>
                    <div style={{
                        background: '#e6f4ff',
                        border: '1px solid #91caff',
                        borderRadius: 6,
                        padding: '8px 12px',
                        marginBottom: 8,
                    }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            将当前所有配置（名单、个人属性、条件限制、奖励值、标签）保存为档案，方便日后快速加载复用。
                        </Text>
                    </div>
                    <div>
                        <Text strong>档案名称</Text>
                        <Input
                            placeholder="请输入档案名称..."
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            style={{ marginTop: 4 }}
                        />
                    </div>
                    <div>
                        <Text strong>描述（可选）</Text>
                        <Input.TextArea
                            placeholder="添加描述信息..."
                            value={profileDescription}
                            onChange={(e) => setProfileDescription(e.target.value)}
                            rows={3}
                            style={{ marginTop: 4 }}
                        />
                    </div>
                </Space>
            </Modal>

            {/* ===== 从档案加载弹窗 ===== */}
            <Modal
                title={
                    <Space>
                        <FolderOpenOutlined />
                        <span>从档案加载</span>
                    </Space>
                }
                open={loadProfileModalOpen}
                onCancel={() => setLoadProfileModalOpen(false)}
                footer={null}
                destroyOnHidden
                centered
                width={600}
            >
                <div style={{
                    background: '#fff7e6',
                    border: '1px solid #ffd591',
                    borderRadius: 6,
                    padding: '8px 12px',
                    marginBottom: 12,
                }}>
                    <Text style={{ color: '#d46b08', fontSize: 13 }}>
                        选择一个已保存的档案加载全部配置（名单、个人属性、条件限制、奖励值、标签）。
                    </Text>
                </div>

                {profileList.length === 0 && !profileLoading ? (
                    <Empty description="暂无已保存的档案">
                        <Text type="secondary">请先使用「保存为档案」功能保存配置</Text>
                    </Empty>
                ) : (
                    <div style={{ maxHeight: 400, overflow: 'auto' }}>
                        <Table
                            size="small"
                            bordered
                            dataSource={profileList}
                            rowKey="id"
                            pagination={false}
                            loading={profileLoading}
                            columns={[
                                {
                                    title: '档案名称',
                                    dataIndex: 'name',
                                    key: 'name',
                                    width: 160,
                                    render: (name) => <Text strong>{name}</Text>,
                                },
                                {
                                    title: '描述',
                                    dataIndex: 'description',
                                    key: 'description',
                                    width: 180,
                                    render: (desc) => desc || <Text type="secondary">无描述</Text>,
                                },
                                {
                                    title: '更新时间',
                                    dataIndex: 'update_time',
                                    key: 'update_time',
                                    width: 140,
                                    render: (time) => {
                                        try {
                                            const d = new Date(time);
                                            return d.toLocaleString('zh-CN');
                                        } catch {
                                            return time;
                                        }
                                    },
                                },
                                {
                                    title: '操作',
                                    key: 'action',
                                    width: 140,
                                    render: (_, record) => (
                                        <Space>
                                            <Button
                                                type="primary"
                                                size="small"
                                                onClick={() => handleLoadProfile(record.id)}
                                            >
                                                加载
                                            </Button>
                                            <Popconfirm
                                                title="确认删除此档案？"
                                                onConfirm={() => handleDeleteProfile(record.id)}
                                            >
                                                <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                                                    删除
                                                </Button>
                                            </Popconfirm>
                                        </Space>
                                    ),
                                },
                            ]}
                        />
                    </div>
                )}
            </Modal>
        </LayoutShell>
    );
};

const LayoutShell = ({
    names,
    personalAttrs,
    setPersonalPropsOpen,
    removePersonal,
    conditions,
    removeCondition,
    setEditorVisible,
    setConditionSettingsOpen,
    handleCalculateRewards,
    calcLoading,
    getConfigStats,
    setStartEvolutionOpen,
    canStartEvolution,
    // 档案相关 props
    onSaveProfile,
    onLoadProfile,
    children,
}) => {
    // 统计已配置人数
    const configuredCount = personalAttrs.length;
    const totalCount = names.length;
    // 检查是否有奖励配置
    const hasRewardConfig = conditions.some(c => c._isRewardConfig);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>条件定义器</Title>
                    <Text type="secondary">用于遗传算法前期准备：名单、个人属性、条件限制与标签库</Text>
                </div>
                <Space>
                    <Button
                        icon={<SaveOutlined />}
                        onClick={onSaveProfile}
                    >
                        保存为档案
                    </Button>
                    <Button
                        icon={<FolderOpenOutlined />}
                        onClick={onLoadProfile}
                    >
                        从档案加载
                    </Button>
                    <Button
                        icon={<CalculatorOutlined />}
                        onClick={handleCalculateRewards}
                        loading={calcLoading}
                        disabled={!hasRewardConfig || personalAttrs.length === 0}
                    >
                        计算奖励值
                    </Button>
                    <Button icon={<SettingOutlined />} onClick={() => setEditorVisible(true)}>
                        标签编辑器
                    </Button>
                    <Button
                        type='primary'
                        icon={<PlayCircleOutlined />}
                        onClick={() => setStartEvolutionOpen(true)}
                        disabled={!canStartEvolution}
                    >
                        开始演化
                    </Button>
                </Space>
            </div>

            <Row gutter={16} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <Col xs={24} lg={10} style={{ display: 'flex', minHeight: 0 }}>
                    <Card variant="plain" title="名单（全部）" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} styles={{ body: { flex: 1, minHeight: 0, overflow: 'hidden' } }}>
                        <div style={{ height: '100%', overflow: 'auto' }}>
                            {names.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {names.map((item, idx) => (
                                        <div key={`${item}-${idx}`} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '6px 10px' }}>
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Empty description="暂无名单数据" />
                            )}
                        </div>
                    </Card>
                </Col>

                <Col xs={24} lg={14} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <SplitPane
                        defaultRatio={0.5}
                        minTopHeight={100}
                        minBottomHeight={100}
                        top={
                            <Card
                                variant="plain"
                                title={
                                    <Space>
                                        <span>个人属性</span>
                                        {configuredCount > 0 && (
                                            <Tag color="processing">{configuredCount}/{totalCount} 人已配置</Tag>
                                        )}
                                    </Space>
                                }
                                extra={
                                    <Button
                                        icon={<UserOutlined />}
                                        type="primary"
                                        onClick={() => setPersonalPropsOpen(true)}
                                    >
                                        打开编辑器
                                    </Button>
                                }
                                style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                                styles={{ body: { flex: 1, minHeight: 0, overflow: 'hidden' } }}
                            >
                                <div style={{ height: '100%', overflow: 'auto' }}>
                                    {personalAttrs.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {personalAttrs.map((item) => {
                                                const factorEntries = Object.entries(item.factors || {})
                                                    .filter(([, v]) => v !== 0.5);
                                                const summary = factorEntries.length > 0
                                                    ? factorEntries.map(([key, val]) =>
                                                        `${factorLabelMap[key] || key}: ${val.toFixed(2)}`
                                                    ).join(' | ')
                                                    : '全部使用默认权重（0.50）';
                                                return (
                                                    <div key={item.name} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                        <Space>
                                                            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
                                                            <div>
                                                                <Text strong>{item.name}</Text>
                                                                <Tooltip title={summary}>
                                                                    <Text
                                                                        type="secondary"
                                                                        style={{
                                                                            display: 'block',
                                                                            maxWidth: 280,
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis',
                                                                            whiteSpace: 'nowrap',
                                                                        }}
                                                                    >
                                                                        {summary}
                                                                    </Text>
                                                                </Tooltip>
                                                            </div>
                                                        </Space>
                                                        <Popconfirm
                                                            title={`移除「${item.name}」的个人数据？`}
                                                            onConfirm={() => removePersonal(item.name)}
                                                        >
                                                            <Button
                                                                type="link"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                size="small"
                                                            >
                                                                移除
                                                            </Button>
                                                        </Popconfirm>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <Empty description={
                                            <Space orientation="vertical" size="small">
                                                <Text type="secondary">暂无个人属性数据</Text>
                                                <Button
                                                    type="primary"
                                                    icon={<UserOutlined />}
                                                    onClick={() => setPersonalPropsOpen(true)}
                                                    size="small"
                                                >
                                                    打开编辑器
                                                </Button>
                                            </Space>
                                        } />
                                    )}
                                </div>
                            </Card>
                        }
                        bottom={
                            <Card
                                variant="plain"
                                title="条件限制（奖励值）"
                                extra={
                                    <Button
                                        icon={<AimOutlined />}
                                        type="primary"
                                        ghost
                                        onClick={() => setConditionSettingsOpen(true)}
                                    >
                                        奖励设置
                                    </Button>
                                }
                                style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                                styles={{ body: { flex: 1, minHeight: 0, overflow: 'hidden' } }}
                            >
                                <div style={{ height: '100%', overflow: 'auto' }}>
                                    {conditions.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {conditions.map((item, idx) => {
                                                if (item._isRewardConfig) {
                                                    const stats = getConfigStats?.(item);
                                                    return (
                                                        <div key={item.id} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                            <Space>
                                                                <Tag color="purple" icon={<CalculatorOutlined />}>奖励配置</Tag>
                                                                <Text strong>{item.name}</Text>
                                                                {stats && (
                                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                                        {stats.seatCount > 0 && `座位${stats.seatCount}个 `}
                                                                        {stats.factorCount > 0 && `因子${stats.factorCount}项 `}
                                                                        {stats.adjacencyCount > 0 && `相邻${stats.adjacencyCount}项 `}
                                                                        {stats.customCount > 0 && `自定义${stats.customCount}项`}
                                                                    </Text>
                                                                )}
                                                            </Space>
                                                            <Space>
                                                                <Button
                                                                    key="edit"
                                                                    type="link"
                                                                    icon={<AimOutlined />}
                                                                    onClick={() => setConditionSettingsOpen(true)}
                                                                >
                                                                    编辑配置
                                                                </Button>
                                                                <Popconfirm title="删除奖励配置？" onConfirm={() => removeCondition(idx)}>
                                                                    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                                                                </Popconfirm>
                                                            </Space>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={item.id} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                        <Space>
                                                            <Tag color="blue">条件</Tag>
                                                            <Text>{item.name}</Text>
                                                            <Text type="secondary">奖励值：{item.reward}</Text>
                                                        </Space>
                                                        <Space>
                                                            <Popconfirm title="删除该条件？" onConfirm={() => removeCondition(idx)}>
                                                                <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                                                            </Popconfirm>
                                                        </Space>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <Empty description="空列表" />
                                    )}
                                </div>
                            </Card>
                        }
                    />
                </Col>
            </Row>

            {children}
        </div>
    );
};

export default FactorLabelManagement;
