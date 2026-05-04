import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
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
    Layout,
    message,
    Popconfirm,
    Row,
    Select,
    Slider,
    Space,
    Tag,
    Tooltip,
    Typography,
    Upload,
} from 'antd';
import {
    AimOutlined,
    ArrowLeftOutlined,
    CheckCircleFilled,
    DeleteOutlined,
    ExportOutlined,
    CalculatorOutlined,
    InboxOutlined,
    PlayCircleOutlined,
    FolderOpenOutlined,
    ReloadOutlined,
    SaveOutlined,
    SettingOutlined,
    UserOutlined,
} from '@ant-design/icons';
import PersonalProperties from '../components/MakeSeatList/PersonalProperties';
import ConditionSettingsModal from '../components/MakeSeatList/ConditionSettingsModal';
import StartEvolutionModal from '../components/MakeSeatList/StartEvolutionModal';
import SaveAsModal from '../components/UploadStudentName/SaveAsModal';
import SplitPane from '../components/SplitPane';
import LoadNamelistModal from '../components/SeatPlanEditor/LoadNamelistModal';
import LabelEditorModal from '../components/SeatPlanEditor/LabelEditorModal';
import SaveProfileModal from '../components/SeatPlanEditor/SaveProfileModal';
import LoadProfileModal from '../components/SeatPlanEditor/LoadProfileModal';
import { parseNameListFile, isSupportedNameListFile } from '../api/shared/fileParsing';
import {
    factorOptions,
    factorLabelMap,
    createId,
    randomColor,
    normalizeWeight,
    normalizeLoadedLabels,
} from '../api/makeSeatList/factorUtils';
import {
    buildRewardConfigEntry,
    buildEvolutionPayload,
    buildProfileData,
    applyLoadedProfileData,
    getRewardConfigStats,
} from '../api/makeSeatList/seatPlanActions';

const { Content } = Layout;
const { Text, Title } = Typography;
const { Dragger } = Upload;

// ==================== 主组件 ====================

const SeatPlanEditor = () => {
    const navigate = useNavigate();

    // ========== 名单管理 ==========
    const [names, setNames] = useState([]);
    const [fileList, setFileList] = useState([]);
    const [saveModalVisible, setSaveModalVisible] = useState(false);
    const [listName, setListName] = useState('namelist');
    const [loadNamelistModalOpen, setLoadNamelistModalOpen] = useState(false);
    const [namelists, setNamelists] = useState([]);
    const [namelistLoading, setNamelistLoading] = useState(false);

    // ========== 个人属性 ==========
    const [personalAttrs, setPersonalAttrs] = useState([]);

    // ========== 条件/标签 ==========
    const [conditions, setConditions] = useState([]);
    const [labels, setLabels] = useState([]);
    const [selectedLabelId, setSelectedLabelId] = useState(null);
    const [editorVisible, setEditorVisible] = useState(false);
    const [personalPropsOpen, setPersonalPropsOpen] = useState(false);
    const [conditionSettingsOpen, setConditionSettingsOpen] = useState(false);
    const [startEvolutionOpen, setStartEvolutionOpen] = useState(false);
    const [startingEvolution, setStartingEvolution] = useState(false);
    const [evolutionRunning, setEvolutionRunning] = useState(false);

    // ========== 标签编辑 ==========
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

    // ========== 上传配置 ==========
    const uploadProps = {
        name: "file",
        multiple: false,
        accept: ".txt,.csv",
        beforeUpload: (file) => {
            const isValid = isSupportedNameListFile(file);
            if (!isValid) {
                message.error("仅支持上传 .txt 或 .csv 文件");
            }
            return isValid;
        },
        onChange: info => {
            const fl = info.fileList.slice(-1);
            setFileList(fl);
        },
        customRequest: async ({ file, onSuccess, onError }) => {
            try {
                const parsedNames = await parseNameListFile(file);
                if (parsedNames.length === 0) {
                    message.warning('上传成功，但未解析到有效姓名');
                } else {
                    message.success(`解析到 ${parsedNames.length} 个姓名`);
                }
                setNames(parsedNames);
                setFileList([file]);
                if (onSuccess) onSuccess('ok');
            } catch (err) {
                console.error('解析上传文件失败', err);
                message.error('解析上传文件失败：' + String(err));
                if (onError) onError(err);
            }
        },
    };

    // ========== 加载默认标签 ==========
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
        return () => { active = false; };
    }, []);

    // 定期检查演化是否正在运行，若运行中则禁用"开始演化"按钮
    useEffect(() => {
        let active = true;
        let timer = null;

        const checkEvolutionStatus = async () => {
            try {
                const st = await invoke('get_evolution_status');
                if (!active) return;
                setEvolutionRunning(st?.state === 'running');
            } catch {
                if (!active) return;
                setEvolutionRunning(false);
            }
        };

        checkEvolutionStatus();
        timer = setInterval(checkEvolutionStatus, 3000);

        return () => {
            active = false;
            if (timer) clearInterval(timer);
        };
    }, []);

    // ========== 标签操作 ==========
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

    // ========== 个人属性操作 ==========
    const removePersonal = (personName) => {
        setPersonalAttrs(prev => prev.filter(item => item.name !== personName));
        message.success(`已移除「${personName}」的个人数据`);
    };

    const handlePersonalSave = (jsonData) => {
        setPersonalAttrs(jsonData);
        if (jsonData.length > 0) {
            message.success(`已保存 ${jsonData.length} 人的个人属性数据`);
        }
    };

    // ========== 条件操作 ==========
    const removeCondition = (idx) => {
        setConditions(prev => prev.filter((_, i) => i !== idx));
    };

    const handleConditionSettingsSave = (data) => {
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

    // ========== 开始演化 ==========
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

    // ========== 档案管理 ==========
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

    const handleLoadProfile = async (profileId) => {
        setProfileLoading(true);
        try {
            const data = await invoke('load_profile', { id: profileId });
            const next = applyLoadedProfileData(data);
            if (next.names) setNames(next.names);
            if (next.personalAttrs) setPersonalAttrs(next.personalAttrs);
            if (next.conditions) setConditions(next.conditions);
            if (next.labels) {
                const normalized = next.labels;
                setLabels(normalized);
                setSelectedLabelId(normalized[0]?.id || null);
                try {
                    await invoke('save_default_labels', {
                        labels: normalized.map(({ id, ...rest }) => rest),
                    });
                } catch (err) {
                    console.error('保存加载的标签失败', err);
                }
            }
            message.success('档案加载成功');
            setLoadProfileModalOpen(false);
        } catch (error) {
            console.error('加载档案失败', error);
            message.error('加载档案失败：' + String(error));
        } finally {
            setProfileLoading(false);
        }
    };

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

    // ========== 名单管理：加载已保存的名单列表 ==========
    const loadNamelists = async () => {
        setNamelistLoading(true);
        try {
            const list = await invoke('get_namelists');
            setNamelists(Array.isArray(list) ? list : []);
        } catch (error) {
            console.error('加载已保存名单失败', error);
            message.error('加载已保存名单失败：' + String(error));
        } finally {
            setNamelistLoading(false);
        }
    };

    const handleLoadNamelist = async (record) => {
        try {
            const content = await invoke('load_namelist_content', { id: record.id });
            if (Array.isArray(content) && content.length > 0) {
                setNames(content);
                message.success(`已加载名单「${record.name}」（${content.length} 人）`);
                setLoadNamelistModalOpen(false);
            } else {
                message.warning('该名单文件为空');
            }
        } catch (error) {
            console.error('加载名单内容失败', error);
            message.error('加载名单内容失败：' + String(error));
        }
    };

    // ========== 条件统计 ==========
    const getConfigStats = (item) => {
        return getRewardConfigStats(item);
    };

    const hasRewardConfig = conditions.some(c => c._isRewardConfig);
    const configuredCount = personalAttrs.length;
    const totalCount = names.length;

    // ==================== 渲染 ====================

    return (
        <Layout style={{ minHeight: '100vh', overflow: 'hidden' }}>
            <Content style={{ padding: 16, height: '100vh', overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                    {/* 顶部标题栏 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
                            <div>
                                <Title level={4} style={{ margin: 0 }}>排座方案编辑器</Title>
                                <Text type="secondary">上传名单 → 配置个人属性 → 设置奖励条件 → 开始演化排座</Text>
                            </div>
                        </div>
                        <Space>
                            <Button
                                icon={<SaveOutlined />}
                                onClick={() => {
                                    setProfileName('');
                                    setProfileDescription('');
                                    setSaveProfileModalOpen(true);
                                }}
                            >
                                保存为档案
                            </Button>
                            <Button
                                icon={<FolderOpenOutlined />}
                                onClick={() => {
                                    loadProfileList();
                                    setLoadProfileModalOpen(true);
                                }}
                            >
                                从档案加载
                            </Button>
                            <Button
                                icon={<PlayCircleOutlined />}
                                onClick={() => setStartEvolutionOpen(true)}
                                disabled={evolutionRunning || !(personalAttrs.length > 0 && conditions.some(c => c._isRewardConfig))}
                                title={evolutionRunning ? '已有演化任务正在运行' : '开始演化'}
                            >
                                开始演化
                            </Button>
                            <Button type="primary" icon={<SettingOutlined />} onClick={() => setEditorVisible(true)}>
                                标签编辑器
                            </Button>
                        </Space>
                    </div>

                    <Row gutter={16} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        {/* ===== 左半部分：名单管理 ===== */}
                        <Col xs={24} lg={10} style={{ display: 'flex', minHeight: 0 }}>
                            <Card
                                variant="plain"
                                title={
                                    <Space>
                                        <span>名单</span>
                                        {names.length > 0 && (
                                            <Tag color="processing">{names.length} 人</Tag>
                                        )}
                                    </Space>
                                }
                                extra={
                                    <Space>
                                        <Button
                                            size="small"
                                            icon={<FolderOpenOutlined />}
                                            onClick={() => {
                                                loadNamelists();
                                                setLoadNamelistModalOpen(true);
                                            }}
                                        >
                                            从另存为导入
                                        </Button>
                                        {names.length > 0 && (
                                            <>
                                                <Button
                                                    size="small"
                                                    icon={<SaveOutlined />}
                                                    onClick={() => {
                                                        const defaultName = `namelist-${Date.now()}`;
                                                        setListName(defaultName);
                                                        setSaveModalVisible(true);
                                                    }}
                                                >
                                                    另存为
                                                </Button>
                                                <Popconfirm
                                                    title="确认清除名单？"
                                                    description="清除后所有名单数据将丢失，此操作不可撤销。"
                                                    onConfirm={() => { setNames([]); setFileList([]); message.info('已清除名单'); }}
                                                >
                                                    <Button size="small" danger>
                                                        清除
                                                    </Button>
                                                </Popconfirm>
                                            </>
                                        )}
                                    </Space>
                                }
                                style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                                styles={{ body: { flex: 1, minHeight: 0, overflow: 'hidden' } }}
                            >
                                {names.length === 0 ? (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <Dragger {...uploadProps} showUploadList={false} fileList={fileList} maxCount={1}>
                                            <p className="ant-upload-drag-icon">
                                                <InboxOutlined />
                                            </p>
                                            <p className="ant-upload-text">点击或拖拽文件到此区域上传名单</p>
                                            <p className="ant-upload-hint">支持 .txt 或 .csv 文件，每行一个姓名</p>
                                        </Dragger>
                                        <Divider plain>或</Divider>
                                        <Button
                                            block
                                            icon={<FolderOpenOutlined />}
                                            onClick={() => {
                                                loadNamelists();
                                                setLoadNamelistModalOpen(true);
                                            }}
                                        >
                                            从已保存的名单导入
                                        </Button>
                                    </div>
                                ) : (
                                    <div style={{ height: '100%', overflow: 'auto' }}>
                                        <div style={{ marginBottom: 12 }}>
                                            <Upload {...uploadProps} showUploadList={false} fileList={fileList} maxCount={1}>
                                                <Button icon={<InboxOutlined />}>替换文件</Button>
                                            </Upload>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {names.map((item, idx) => (
                                                <div
                                                    key={`${item}-${idx}`}
                                                    style={{
                                                        border: '1px solid #f0f0f0',
                                                        borderRadius: 6,
                                                        padding: '6px 10px',
                                                        background: '#fff',
                                                    }}
                                                >
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </Col>

                        {/* ===== 右半部分：条件编辑器 ===== */}
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
                                                disabled={names.length === 0}
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
                                                                    <Button type="link" danger icon={<DeleteOutlined />} size="small">移除</Button>
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
                                                            disabled={names.length === 0}
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
                                                            const stats = getConfigStats(item);
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
                                                                <Button type="link" icon={<AimOutlined />} onClick={() => setConditionSettingsOpen(true)}>编辑配置</Button>
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
                                        <Empty description="暂无奖励配置，请点击「奖励设置」进行配置" />
                                    )}
                                </div>
                            </Card>
                                }
                            />
                        </Col>
                    </Row>
                </div>

                {/* ========== 模态框 ========== */}

                {/* 另存为模态框 */}
                <SaveAsModal
                    open={saveModalVisible}
                    listName={listName}
                    onListNameChange={setListName}
                    uploadedNames={names}
                    onClose={() => setSaveModalVisible(false)}
                    onSaved={() => setSaveModalVisible(false)}
                />

                <LoadNamelistModal
                    open={loadNamelistModalOpen}
                    loading={namelistLoading}
                    namelists={namelists}
                    onCancel={() => setLoadNamelistModalOpen(false)}
                    onLoad={handleLoadNamelist}
                />

                {/* PersonalProperties 模态框 */}
                <PersonalProperties
                    open={personalPropsOpen}
                    names={names}
                    labels={labels}
                    savedData={personalAttrs}
                    onCancel={() => setPersonalPropsOpen(false)}
                    onSave={handlePersonalSave}
                />

                {/* ConditionSettingsModal 模态框 */}
                <ConditionSettingsModal
                    open={conditionSettingsOpen}
                    conditions={conditions}
                    onSave={handleConditionSettingsSave}
                    onCancel={() => setConditionSettingsOpen(false)}
                />

                {/* StartEvolutionModal 模态框 */}
                <StartEvolutionModal
                    open={startEvolutionOpen}
                    loading={startingEvolution}
                    onCancel={() => setStartEvolutionOpen(false)}
                    onOk={handleStartEvolution}
                />

                <LabelEditorModal
                    open={editorVisible}
                    labels={labels}
                    selectedLabel={selectedLabel}
                    selectedLabelId={selectedLabelId}
                    factorLabelMap={factorLabelMap}
                    onSelectLabel={setSelectedLabelId}
                    onEditLabel={(label) => {
                        resetLabelDraft(label);
                        setLabelModalOpen(true);
                    }}
                    onAddLabel={() => {
                        resetLabelDraft();
                        setLabelModalOpen(true);
                    }}
                    onDeleteLabel={removeLabel}
                    onWeightChange={updateLabelWeight}
                    labelModalOpen={labelModalOpen}
                    editingLabelId={editingLabelId}
                    labelName={labelName}
                    labelColor={labelColor}
                    labelFactor={labelFactor}
                    labelWeight={labelWeight}
                    factorOptions={factorOptions}
                    onSaveLabel={saveLabel}
                    onCloseLabelModal={() => setLabelModalOpen(false)}
                    onClose={() => setEditorVisible(false)}
                />

                <SaveProfileModal
                    open={saveProfileModalOpen}
                    profileName={profileName}
                    profileDescription={profileDescription}
                    saving={profileSaving}
                    onChangeName={setProfileName}
                    onChangeDescription={setProfileDescription}
                    onSave={handleSaveProfile}
                    onCancel={() => {
                        setSaveProfileModalOpen(false);
                        setProfileName('');
                        setProfileDescription('');
                    }}
                />

                <LoadProfileModal
                    open={loadProfileModalOpen}
                    profileList={profileList}
                    loading={profileLoading}
                    onCancel={() => setLoadProfileModalOpen(false)}
                    onLoad={handleLoadProfile}
                    onDelete={handleDeleteProfile}
                />
            </Content>
        </Layout>
    );
};

export default SeatPlanEditor;