import React from 'react';
import { Modal, Space, Tag, Typography } from 'antd';
import { createStartEvolutionHandlers } from '../../api/makeSeatList/startEvolutionActions';

const { Text } = Typography;

const StartEvolutionModal = ({
    open,
    loading,
    classroom,
    onCancel,
    onOk,
}) => {
    const { handleOk } = React.useMemo(
        () => createStartEvolutionHandlers({ classroom, onOk }),
        [classroom, onOk],
    );

    return (
        <Modal
            title="确认开始演化"
            open={open}
            forceRender
            onCancel={onCancel}
            onOk={handleOk}
            okText="确认开始"
            cancelText="取消"
            confirmLoading={loading}
            okButtonProps={{ disabled: !classroom }}
            width={480}
            destroyOnHidden
        >
            <Space direction="vertical" style={{ width: '100%', padding: '16px 0' }}>
                <Text>确认使用以下教室开始演化排座？</Text>
                {classroom && (
                    <div
                        style={{
                            border: '1px solid #e6f4ff',
                            background: '#e6f4ff',
                            borderRadius: 8,
                            padding: '12px 16px',
                            marginTop: 8,
                        }}
                    >
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text strong>{classroom.name}</Text>
                            <Space>
                                <Tag color="blue">{classroom.create_time}</Tag>
                                <Tag>{classroom.sgid.slice(0, 10)}...</Tag>
                            </Space>
                        </Space>
                    </div>
                )}
                <Text type="secondary" style={{ marginTop: 8 }}>
                    请确认名单、个人属性和奖励配置均已正确设置。
                </Text>
            </Space>
        </Modal>
    );
};

export default StartEvolutionModal;
