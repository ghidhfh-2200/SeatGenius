import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Alert, Button, Card, Layout, Progress, Space, Spin, Tag, Typography } from 'antd';

const { Content } = Layout;
const { Title, Text } = Typography;

const stateColorMap = {
    idle: 'default',
    running: 'processing',
    completed: 'success',
    failed: 'error',
};

const EvolutionStatus = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const classroom = location.state?.classroom;

    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState('');
    const autoNavigateRef = useRef(false);
    const statusRef = useRef(null);

    // 跟踪最新状态，供 beforeunload 使用
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // 演化运行时阻止关闭/刷新页面
    useEffect(() => {
        const handler = (e) => {
            if (statusRef.current?.state === 'running') {
                e.preventDefault();
                e.returnValue = '演化正在进行中，退出将中断当前任务，确定要离开吗？';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, []);

    const isRunning = status?.state === 'running';

    const progressPercent = useMemo(() => {
        const progress = Number(status?.progress ?? 0);
        return Math.min(100, Math.max(0, Math.round(progress * 100)));
    }, [status]);

    useEffect(() => {
        let active = true;
        let timer = null;

        const fetchStatus = async () => {
            try {
                const next = await invoke('get_evolution_status');
                if (!active) return;
                setStatus(next || null);
                setErrorText('');
            } catch (err) {
                if (!active) return;
                setErrorText(String(err));
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchStatus();
        timer = setInterval(fetchStatus, 1000);

        return () => {
            active = false;
            if (timer) clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        if (status?.state !== 'completed' || autoNavigateRef.current) {
            return;
        }

        autoNavigateRef.current = true;
        const timer = setTimeout(() => {
            navigate('/evolution-result', {
                state: {
                    sgid: status?.classroom_sgid || classroom?.sgid || '',
                    classroomName: status?.classroom_name || classroom?.name || '',
                    seatOrder: status?.seat_order || {},
                },
                replace: true,
            });
        }, 800);

        return () => clearTimeout(timer);
    }, [status, classroom, navigate]);

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Content style={{ padding: 16 }}>
                <Card
                    title={<Title level={4} style={{ margin: 0 }}>遗传算法工作状态</Title>}
                    extra={(
                        <Space>
                            <Button
                                onClick={() => navigate('/edit_labels')}
                                disabled={isRunning}
                                title={isRunning ? '演化正在进行中，无法退出' : '返回条件定义器'}
                            >
                                返回条件定义器
                            </Button>
                            <Button
                                type="primary"
                                onClick={() => navigate('/')}
                                disabled={isRunning}
                                title={isRunning ? '演化正在进行中，无法退出' : '返回仪表盘'}
                            >
                                返回仪表盘
                            </Button>
                        </Space>
                    )}
                >
                    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                        <Space wrap>
                            <Text strong>教室：</Text>
                            <Tag color="blue">{status?.classroom_name || classroom?.name || '未指定'}</Tag>
                            {classroom?.sgid && <Tag>{classroom.sgid}</Tag>}
                        </Space>

                        {errorText && (
                            <Alert type="error" showIcon message="读取状态失败" description={errorText} />
                        )}

                        {loading ? (
                            <Spin description="读取演化状态中..." />
                        ) : (
                            <>
                                <Space wrap>
                                    <Text strong>状态：</Text>
                                    <Tag color={stateColorMap[status?.state] || 'default'}>{status?.state || 'idle'}</Tag>
                                    <Text type="secondary">{status?.message || '等待开始'}</Text>
                                    {isRunning && (
                                        <Tag color="warning">演化运行中，请勿关闭此页面</Tag>
                                    )}
                                </Space>

                                <Progress
                                    percent={progressPercent}
                                    status={status?.state === 'failed' ? 'exception' : (status?.state === 'completed' ? 'success' : 'active')}
                                />

                                <Space wrap>
                                    <Tag color="purple">代数：{status?.generation || 0}</Tag>
                                    <Tag color="geekblue">最佳适应度：{Number(status?.best_fitness || 0).toFixed(4)}</Tag>
                                </Space>

                                {status?.state === 'completed' && (
                                    <Alert
                                        type="success"
                                        showIcon
                                        message="演化已完成"
                                        description="正在自动打开座位表可视化界面..."
                                    />
                                )}
                            </>
                        )}
                    </Space>
                </Card>
            </Content>
        </Layout>
    );
};

export default EvolutionStatus;
