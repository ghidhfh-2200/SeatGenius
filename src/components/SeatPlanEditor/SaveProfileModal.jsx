import React from 'react';
import { Input, Modal, Space, Typography } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

const { Text } = Typography;

const SaveProfileModal = ({
    open,
    profileName,
    profileDescription,
    saving,
    onChangeName,
    onChangeDescription,
    onSave,
    onCancel,
}) => {
    return (
        <Modal
            title={(
                <Space>
                    <SaveOutlined />
                    <span>保存为档案</span>
                </Space>
            )}
            open={open}
            onCancel={onCancel}
            onOk={onSave}
            okText="保存"
            confirmLoading={saving}
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
                        onChange={(e) => onChangeName?.(e.target.value)}
                        style={{ marginTop: 4 }}
                    />
                </div>
                <div>
                    <Text strong>描述（可选）</Text>
                    <Input.TextArea
                        placeholder="添加描述信息..."
                        value={profileDescription}
                        onChange={(e) => onChangeDescription?.(e.target.value)}
                        rows={3}
                        style={{ marginTop: 4 }}
                    />
                </div>
            </Space>
        </Modal>
    );
};

export default SaveProfileModal;
