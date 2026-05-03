import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Empty, Modal, Radio, Space, Tag, Typography, message } from 'antd';

const { Text } = Typography;

const StartEvolutionModal = ({
    open,
    loading,
    onCancel,
    onOk,
}) => {
    const [classrooms, setClassrooms] = useState([]);
    const [selectedSgid, setSelectedSgid] = useState(null);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (!open) return;

        let active = true;
        setFetching(true);

        invoke('get_dashboard_records')
            .then((rows) => {
                if (!active) return;
                const available = (Array.isArray(rows) ? rows : []).filter(item => !item?.is_broken);
                setClassrooms(available);
                setSelectedSgid(available[0]?.sgid || null);
            })
            .catch((err) => {
                console.error('读取教室列表失败', err);
                message.error('读取教室列表失败：' + String(err));
                setClassrooms([]);
                setSelectedSgid(null);
            })
            .finally(() => {
                if (active) setFetching(false);
            });

        return () => {
            active = false;
        };
    }, [open]);

    const selectedClassroom = useMemo(
        () => classrooms.find(item => item.sgid === selectedSgid) || null,
        [classrooms, selectedSgid]
    );

    return (
        <Modal
            title="选择教室"
            open={open}
            onCancel={onCancel}
            onOk={() => selectedClassroom && onOk?.(selectedClassroom)}
            okText="开始演化"
            cancelText="取消"
            confirmLoading={loading}
            okButtonProps={{ disabled: !selectedClassroom }}
            width={720}
            styles={{ body: { maxHeight: '60vh', overflow: 'auto' } }}
            destroyOnHidden
        >
            {classrooms.length > 0 ? (
                <Radio.Group value={selectedSgid} onChange={(e) => setSelectedSgid(e.target.value)} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {fetching ? (
                            <div style={{ padding: '24px 0', textAlign: 'center' }}>
                                <Text type="secondary">正在加载教室列表...</Text>
                            </div>
                        ) : classrooms.map((item) => (
                            <div
                                key={item.sgid}
                                onClick={() => setSelectedSgid(item.sgid)}
                                style={{
                                    cursor: 'pointer',
                                    border: selectedSgid === item.sgid ? '1px solid #1677ff' : '1px solid #f0f0f0',
                                    background: selectedSgid === item.sgid ? '#e6f4ff' : '#fff',
                                    borderRadius: 8,
                                    padding: '10px 12px',
                                }}
                            >
                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                    <Space>
                                        <Radio value={item.sgid} />
                                        <Text strong>{item.name}</Text>
                                    </Space>
                                    <Space>
                                        <Tag color="blue">{item.create_time}</Tag>
                                        <Tag>{item.sgid.slice(0, 10)}...</Tag>
                                    </Space>
                                </Space>
                            </div>
                        ))}
                    </div>
                </Radio.Group>
            ) : (
                <Empty description="暂无可用教室" />
            )}
        </Modal>
    );
};

export default StartEvolutionModal;
