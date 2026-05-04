import React from 'react';
import { Button, Card, Col, Empty, Modal, Popconfirm, Row, Slider, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import AddLabelModal from '../MakeSeatList/AddLabelModal';

const { Text } = Typography;

const LabelEditorModal = ({
    open,
    labels,
    selectedLabel,
    selectedLabelId,
    factorLabelMap,
    onSelectLabel,
    onEditLabel,
    onAddLabel,
    onDeleteLabel,
    onWeightChange,
    labelModalOpen,
    editingLabelId,
    labelName,
    labelColor,
    labelFactor,
    labelWeight,
    factorOptions,
    onSaveLabel,
    onCloseLabelModal,
    onClose,
}) => {
    return (
        <Modal
            title="标签编辑器"
            open={open}
            forceRender
            onCancel={onClose}
            footer={null}
            width="calc(100vw - 32px)"
            style={{ top: 16 }}
            styles={{ body: { paddingTop: 12, height: 'calc(100vh - 120px)', overflow: 'hidden' } }}
            destroyOnHidden
        >
            <Row gutter={16} style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
                <Col span={10} style={{ maxHeight: 'calc(80vh - 40px)', overflow: 'auto' }}>
                    <Card
                        size="small"
                        title={(
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <span>标签列表</span>
                                <Button type="primary" icon={<PlusOutlined />} onClick={onAddLabel}>新增标签</Button>
                            </Space>
                        )}
                        style={{ flex: 1, minHeight: 0 }}
                        styles={{ body: { height: '100%', overflow: 'hidden' } }}
                    >
                        <div style={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, marginBottom: 0 }}>
                                {labels.map((label) => (
                                    <div
                                        key={label.id}
                                        style={{
                                            cursor: 'pointer',
                                            background: selectedLabelId === label.id ? '#e6f4ff' : '#fff',
                                            border: '1px solid #f0f0f0',
                                            borderRadius: 6,
                                            padding: '8px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                        }}
                                        onClick={() => onSelectLabel?.(label.id)}
                                    >
                                        <Space wrap>
                                            <Tag color={label.color}>{label.name}</Tag>
                                            <Text type="secondary">{factorLabelMap[label.factor] || label.factor}</Text>
                                            <Text type="secondary">权重：{label.weight.toFixed(2)}</Text>
                                        </Space>
                                        <Space>
                                            <Button type="link" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); onEditLabel?.(label); }}>
                                                编辑
                                            </Button>
                                            <Popconfirm title="删除该标签？" onConfirm={() => onDeleteLabel?.(label.id)}>
                                                <Button type="link" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>删除</Button>
                                            </Popconfirm>
                                        </Space>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col span={14} style={{ display: 'flex', minHeight: 0 }}>
                    <Card
                        size="small"
                        title={selectedLabel ? `标签详情：${selectedLabel.name}` : '标签详情'}
                        style={{ flex: 1, minHeight: 0 }}
                        styles={{ body: { height: '100%', overflow: 'auto' } }}
                    >
                        {selectedLabel ? (
                            <Space orientation="vertical" style={{ width: '100%' }} size="large">
                                <Space wrap>
                                    <Tag color={selectedLabel.color}>{selectedLabel.name}</Tag>
                                    <Text type="secondary">颜色：{selectedLabel.color}</Text>
                                </Space>
                                <div>
                                    <Text strong>因子</Text>
                                    <div>{factorLabelMap[selectedLabel.factor] || selectedLabel.factor}</div>
                                </div>
                                <div>
                                    <Text strong>权重</Text>
                                    <Slider
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={selectedLabel.weight}
                                        onChange={(value) => onWeightChange?.(selectedLabel.id, value)}
                                    />
                                </div>
                            </Space>
                        ) : (
                            <Empty description="请选择一个标签" />
                        )}
                    </Card>
                </Col>
            </Row>

            <AddLabelModal
                open={labelModalOpen}
                title={editingLabelId ? '编辑标签' : '新增标签'}
                initialValue={labelName}
                initialColor={labelColor}
                initialFactor={labelFactor}
                initialWeight={labelWeight}
                showColor
                showFactor
                showWeight
                factorOptions={factorOptions}
                placeholder="请输入标签名称"
                confirmText={editingLabelId ? '保存' : '新增'}
                onOk={onSaveLabel}
                onCancel={onCloseLabelModal}
            />
        </Modal>
    );
};

export default LabelEditorModal;
