import React from 'react';
import { Modal, Typography } from 'antd';

const { Text } = Typography;

export const showModeSwitchConfirm = ({ onOk }) => {
    Modal.confirm({
        title: '切换模式确认',
        content: '切换模式将清空当前所有组件和画布，确定要继续吗？',
        okText: '确定',
        cancelText: '取消',
        onOk,
    });
};

export const showDeleteSelectedConfirm = ({ selectedCount, onOk }) => {
    Modal.confirm({
        title: '删除确认',
        content: `确定要删除选取的 ${selectedCount} 个组件及其子元素吗？该操作无法恢复。`,
        okText: '确定',
        okType: 'danger',
        cancelText: '取消',
        onOk,
    });
};

export const showIdLogsInfo = ({ idLogs, typeNames }) => {
    Modal.info({
        title: 'ID自动编号日志',
        width: 600,
        content: (
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {idLogs.length === 0 ? (
                    <Text type="secondary">暂无日志记录</Text>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <th style={{ padding: '4px 8px', textAlign: 'left' }}>ID</th>
                                <th style={{ padding: '4px 8px', textAlign: 'left' }}>类型</th>
                                <th style={{ padding: '4px 8px', textAlign: 'left' }}>父ID</th>
                                <th style={{ padding: '4px 8px', textAlign: 'left' }}>生成时间</th>
                            </tr>
                        </thead>
                        <tbody>
                            {idLogs.map((log, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '4px 8px' }}>{log.id}</td>
                                    <td style={{ padding: '4px 8px' }}>{typeNames[log.type] || log.type}</td>
                                    <td style={{ padding: '4px 8px' }}>{log.parentId ?? '-'}</td>
                                    <td style={{ padding: '4px 8px', fontSize: 12 }}>{log.timestamp}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        ),
        onOk() {},
    });
};
