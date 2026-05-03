import React from 'react';
import { Button, Card, Col, Empty, Modal, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { CalculatorOutlined, UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

const CalcResultModal = ({ open, calcResults, onCancel }) => {
    return (
        <Modal
            title={(
                <Space>
                    <CalculatorOutlined />
                    <span>奖励值计算结果</span>
                </Space>
            )}
            open={open}
            onCancel={onCancel}
            width={800}
            style={{ top: 20 }}
            styles={{ body: { maxHeight: 'calc(100vh - 180px)', overflow: 'hidden' } }}
            footer={<Button onClick={onCancel}>关闭</Button>}
            destroyOnHidden
        >
            {calcResults ? (
                <div style={{ maxHeight: 'calc(100vh - 240px)', overflow: 'auto' }}>
                    <Card size="small" style={{ marginBottom: 12 }}>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Statistic title="总人数" value={calcResults.total_students || 0} prefix={<UserOutlined />} />
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
                                        render: (val) => <Text strong style={{ color: '#f5222d' }}>{val?.toFixed(4)}</Text>,
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
    );
};

export default CalcResultModal;
