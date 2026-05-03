import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Layout, Row, Col, Card, Statistic, Tabs, Table, Dropdown, Button, Typography, Space, Image, Tooltip, Tag, message } from 'antd';
import { MoreOutlined, DeleteOutlined, RobotOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import './Dashboard.css';
import { buildPreviewSrc, filterBrokenRecordTitle } from '../api/dashboard/dashboardActions';

const { Content } = Layout;
const { Text } = Typography;

const Dashboard = () => {
    const navigate = useNavigate();
    const [seatTables, setSeatTables] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadRecords = async () => {
        setLoading(true);
        try {
            const [classroomData, seatTableData] = await Promise.all([
                invoke('get_dashboard_records'),
                invoke('get_seat_tables'),
            ]);
            const classroomRecords = Array.isArray(classroomData) ? classroomData : [];
            const seatTableRecords = Array.isArray(seatTableData) ? seatTableData : [];
            setClassrooms(classroomRecords);
            setSeatTables(seatTableRecords);
        } catch (error) {
            console.error('读取仪表盘数据失败', error);
            message.error('读取仪表盘数据失败：' + String(error));
            setClassrooms([]);
            setSeatTables([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const handleAction = (key, item, isSeatTable = false) => {
        if (key === 'delete') {
            setLoading(true);
            const command = isSeatTable ? 'delete_seat_table' : 'delete_classroom';
            const stateUpdater = isSeatTable ? setSeatTables : setClassrooms;
            invoke(command, { sgid: item.sgid })
                .then(() => {
                    stateUpdater(prev => prev.filter(record => record.sgid !== item.sgid));
                    message.success('删除成功');
                })
                .catch(err => {
                    console.error('删除失败', err);
                    message.error('删除失败：' + String(err));
                })
                .finally(() => setLoading(false));
        }
    };

    const openClassroom = (record) => {
        navigate('/new-classroom', { state: { sgid: record.sgid } });
    };

    const openSeatTable = (record) => {
        navigate('/evolution-result', { state: { sgid: record.sgid } });
    };

    const createColumns = (isSeatTable = false) => [
        {
            title: '预览图',
            dataIndex: 'preview_svg',
            key: 'preview',
            width: 110,
            render: (_, record) => {
                const src = buildPreviewSrc(record);
                const title = filterBrokenRecordTitle(record, record.name);

                return (
                    <Tooltip title={title}>
                        <div className="dashboard-preview-wrap">
                            {src ? (
                                <Image
                                    width={60}
                                    height={40}
                                    src={src}
                                    alt="preview"
                                    preview={false}
                                    style={{
                                        objectFit: 'cover',
                                        borderRadius: '6px',
                                        filter: record.is_broken ? 'grayscale(1)' : 'none',
                                        opacity: record.is_broken ? 0.5 : 1
                                    }}
                                />
                            ) : (
                                <div className={`dashboard-preview-placeholder ${record.is_broken ? 'broken' : ''}`}>
                                    <Text type="secondary">无预览</Text>
                                </div>
                            )}
                        </div>
                    </Tooltip>
                );
            },
        },
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => {
                const title = filterBrokenRecordTitle(record, text);
                const onClick = isSeatTable ? () => openSeatTable(record) : () => openClassroom(record);

                return (
                    <Tooltip title={title}>
                        <Button
                            type="link"
                            className="dashboard-file-link"
                            onClick={onClick}
                            style={{
                                padding: 0,
                                height: 'auto',
                                color: record.is_broken ? '#8c8c8c' : undefined
                            }}
                        >
                            <Text strong type={record.is_broken ? 'secondary' : undefined}>
                                {text}
                            </Text>
                        </Button>
                    </Tooltip>
                );
            },
        },
        {
            title: '创建时间',
            dataIndex: 'create_time',
            key: 'create_time',
            width: 180,
        },
        {
            title: '文件状态',
            key: 'status',
            width: 140,
            render: (_, record) => (
                record.is_broken ? (
                    <Tooltip title={record.problem_message || '此数据存在问题'}>
                        <Tag color="default">异常</Tag>
                    </Tooltip>
                ) : (
                    <Tag color="success">正常</Tag>
                )
            ),
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            align: 'center',
            render: (_, record) => {
                const items = [
                    { key: 'delete', label: '删除该条目', icon: <DeleteOutlined />, danger: true },
                ];
                return (
                    <Dropdown menu={{ items, onClick: ({ key }) => handleAction(key, record, isSeatTable) }} trigger={['click']}>
                        <Button type="text" icon={<MoreOutlined />} />
                    </Dropdown>
                );
            },
        },
    ];

    const seatTableColumns = createColumns(true);
    const classroomColumns = createColumns(false);

    const tabItems = [
        {
            key: '1',
            label: '我的座位表',
            children: (
                <Table
                    className="hoverable-table"
                    columns={seatTableColumns}
                    dataSource={seatTables}
                    rowKey="sgid"
                    pagination={false}
                    loading={loading}
                    rowClassName={(record) => (record.is_broken ? 'dashboard-row-broken' : '')}
                    scroll={{ y: 'calc(100vh - 350px)' }}
                    locale={{ emptyText: '暂无座位表数据' }}
                />
            ),
        },
        {
            key: '2',
            label: '我的教室',
            children: (
                <Table
                    className="hoverable-table"
                    columns={classroomColumns}
                    dataSource={classrooms}
                    rowKey="sgid"
                    pagination={false}
                    loading={loading}
                    rowClassName={(record) => (record.is_broken ? 'dashboard-row-broken' : '')}
                    scroll={{ y: 'calc(100vh - 350px)' }}
                    locale={{ emptyText: '暂无教室文件数据' }}
                />
            ),
        },
    ];

    const actionButtons = (
        <Space>
            <Button icon={<ReloadOutlined />} onClick={loadRecords}>刷新</Button>
            <Button type="primary" icon={<RobotOutlined />} onClick={() => navigate('/seat-plan-editor')}>开始智能排座</Button>
            <Button icon={<PlusOutlined />} onClick={() => navigate('/new-classroom')}>创建教室</Button>
        </Space>
    );

    return (
        <Layout className="dashboard-layout">
            <Content className="dashboard-content">
                <Row gutter={24} className="dashboard-stats-row">
                    <Col span={12}>
                        <Card variant="plain" className="dashboard-stat-card">
                            <Statistic
                                title={<Text type="secondary" strong>创建了教室</Text>}
                                value={classrooms.length}
                                styles={{ content: { value: { color: '#1677ff', fontSize: '32px', fontWeight: 'bold' } } }}
                            />
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card variant="plain" className="dashboard-stat-card">
                            <Statistic
                                title={<Text type="secondary" strong>创建了座位表</Text>}
                                value={seatTables.length}
                                styles={{ content: { value: { color: '#52c41a', fontSize: '32px', fontWeight: 'bold' } } }}
                            />
                        </Card>
                    </Col>
                </Row>

                <Card variant="plain" className="dashboard-list-card">
                    <Tabs
                        defaultActiveKey="1"
                        items={tabItems}
                        size="large"
                        tabBarExtraContent={actionButtons}
                    />
                </Card>
            </Content>
        </Layout>
    );
};

export default Dashboard;
