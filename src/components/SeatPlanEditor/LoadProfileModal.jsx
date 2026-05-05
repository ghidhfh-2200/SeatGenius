import React from 'react';
import { Button, Empty, Modal, Popconfirm, Space, Table, Typography } from 'antd';
import { DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons';

const { Text } = Typography;

const LoadProfileModal = ({
    open,
    profileList,
    loading,
    onCancel,
    onLoad,
    onDelete,
}) => {
    return (
        <Modal
            title={(
                <Space>
                    <FolderOpenOutlined />
                    <span>从档案加载</span>
                </Space>
            )}
            open={open}
            forceRender
            onCancel={onCancel}
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

            {profileList.length === 0 && !loading ? (
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
                        loading={loading}
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
                                        <Button type="primary" size="small" onClick={() => onLoad?.(record)}>
                                            加载
                                        </Button>
                                        <Popconfirm title="确认删除此档案？" onConfirm={() => onDelete?.(record.id)}>
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
    );
};

export default LoadProfileModal;
