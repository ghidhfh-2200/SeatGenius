import React from 'react';
import { Button, Empty, Modal, Space, Table, Tag, Typography } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';

const { Text } = Typography;

const LoadNamelistModal = ({
    open,
    loading,
    namelists,
    onCancel,
    onLoad,
}) => {
    return (
        <Modal
            title={(
                <Space>
                    <FolderOpenOutlined />
                    <span>从已保存的名单导入</span>
                </Space>
            )}
            open={open}
            onCancel={onCancel}
            footer={null}
            destroyOnHidden
            centered
            width={600}
        >
            <div style={{
                background: '#e6f4ff',
                border: '1px solid #91caff',
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 12,
            }}>
                <Text style={{ fontSize: 13 }}>
                    选择之前另存为的名单文件加载到编辑器中。
                </Text>
            </div>
            {namelists.length === 0 && !loading ? (
                <Empty description="暂无已保存的名单">
                    <Text type="secondary">请先使用「另存为」功能保存名单</Text>
                </Empty>
            ) : (
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                    <Table
                        size="small"
                        bordered
                        dataSource={namelists}
                        rowKey="id"
                        pagination={false}
                        loading={loading}
                        columns={[
                            {
                                title: '名单名称',
                                dataIndex: 'name',
                                key: 'name',
                                width: 160,
                                render: (name) => <Text strong>{name}</Text>,
                            },
                            {
                                title: '人数',
                                dataIndex: 'count',
                                key: 'count',
                                width: 80,
                                render: (count) => <Tag color="blue">{count} 人</Tag>,
                            },
                            {
                                title: '创建时间',
                                dataIndex: 'create_time',
                                key: 'create_time',
                                width: 180,
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
                                width: 100,
                                render: (_, record) => (
                                    <Button type="primary" size="small" onClick={() => onLoad?.(record)}>
                                        加载
                                    </Button>
                                ),
                            },
                        ]}
                    />
                </div>
            )}
        </Modal>
    );
};

export default LoadNamelistModal;
