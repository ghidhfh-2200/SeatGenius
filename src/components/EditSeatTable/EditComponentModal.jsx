import React, { useState } from "react";
import { Form, Input, Modal, Select, Typography, Table, Button, Space, InputNumber, Divider, Tag } from "antd";
import ShapeEditor from "../ShapeEditor/ShapeEditor";

const { Text } = Typography;

const SmallGroupEditModal = ({ visible, onCancel, onSave, initialValues, isCreating }) => {
    const [form] = Form.useForm();

    React.useEffect(() => {
        if (visible) {
            form.setFieldsValue(initialValues || {
                membersPerColumn: 6,
                color: "#ff4d4f"
            });
        }
    }, [visible, initialValues, form]);

    return (
        <Modal
            title={isCreating ? "添加小组" : "编辑小组"}
            open={visible}
            forceRender
            onOk={() => {
                form.validateFields().then(values => {
                    onSave(values);
                    form.resetFields();
                });
            }}
            onCancel={() => {
                form.resetFields();
                onCancel();
            }}
            destroyOnHidden
            centered
        >
            <Form form={form} layout="vertical">
                <Form.Item label="小组 ID" name="id">
                    <Input disabled placeholder="自动生成，不可编辑" />
                </Form.Item>
                <Form.Item label="名称" name="name">
                    <Input placeholder="输入小组名称" />
                </Form.Item>
                <Form.Item label="每列几个人" name="membersPerColumn" rules={[{ required: true, message: '请输入每列人数' }]}>
                    <InputNumber min={1} max={20} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="显示颜色" name="color">
                    <Input type="color" className="seat-color-input" />
                </Form.Item>
            </Form>
        </Modal>
    );
};

const EditComponentModal = ({
    selectedItem,
    isModalVisible,
    onOk,
    onCancel,
    typeNames,
    mode,
    canvasWidth,
    canvasHeight,
    elements = [],
    onElementsChange,
    nextId,
    allocId,
    allocBatchIds
}) => {
    const [form] = Form.useForm();
    const [sgModalVisible, setSgModalVisible] = useState(false);
    const [editingSgId, setEditingSgId] = useState(null);
    const [isCreatingSg, setIsCreatingSg] = useState(false);
    const [draftSmallGroups, setDraftSmallGroups] = useState([]);
    const [shapeEditorOpen, setShapeEditorOpen] = useState(false);
    const [shapeData, setShapeData] = useState(null);

    const isBigGroup = selectedItem?.type === "big_group";
    const isSmallGroup = selectedItem?.type === "small_group";
    const isSeat = selectedItem?.type === "seat";
    const isSimpleElement = !isBigGroup && !isSmallGroup && !isSeat;
    const isDraftBigGroup = isBigGroup && !elements.some(e => e.id === selectedItem?.id);

    // 获取该大组下的所有小组
    const childSmallGroups = isBigGroup
        ? elements.filter(e => e.type === 'small_group' && e.parentId === selectedItem.id)
        : [];

    const visibleSmallGroups = isDraftBigGroup ? draftSmallGroups : childSmallGroups;

    // 获取某小组下的所有座位
    const getChildSeats = (sgId) => {
        return elements.filter(e => e.type === 'seat' && e.parentId === sgId);
    };

    const getDraftSeats = (sgId) => {
        const sg = draftSmallGroups.find(item => item.id === sgId);
        return Array.isArray(sg?.seats) ? sg.seats : [];
    };

    React.useEffect(() => {
        if (!isModalVisible || !isDraftBigGroup) {
            setDraftSmallGroups([]);
            return;
        }

        const initialDraft = Array.isArray(selectedItem?.smallGroups) ? selectedItem.smallGroups : [];
        setDraftSmallGroups(initialDraft.map((sg) => ({
            ...sg,
            seats: Array.isArray(sg.seats) ? sg.seats : [],
        })));
    }, [isModalVisible, isDraftBigGroup, selectedItem]);

    React.useEffect(() => {
        if (!isModalVisible || !selectedItem) return;
        form.setFieldsValue({ ...selectedItem });
    }, [isModalVisible, selectedItem, form]);

    // 添加小组（带有座位自动生成）
    const handleAddSg = (values) => {
        if (!allocId) {
            // 如果没有传入回调，使用旧方式（通过form存储）
            return;
        }

        const newSgId = allocId('small_group', selectedItem.id);
        const sgItem = {
            id: newSgId,
            type: 'small_group',
            name: values.name || `小组 ${newSgId}`,
            parentId: selectedItem.id,
            membersPerColumn: Number(values.membersPerColumn) || 6,
            color: values.color || '#ff4d4f'
        };

        // 自动生成座位
        const seatCount = Number(values.membersPerColumn) || 6;
        const seats = Array.from({ length: seatCount }, () => {
            const seatId = allocId('seat', newSgId);
            return {
                id: seatId,
                type: 'seat',
                name: `座位 ${seatId}`,
                parentId: newSgId,
                color: values.color || '#ff4d4f'
            };
        });

        if (isDraftBigGroup) {
            setDraftSmallGroups(prev => [...prev, { ...sgItem, seats }]);
        } else if (onElementsChange) {
            onElementsChange(prev => [...prev, sgItem, ...seats]);
        }

        setSgModalVisible(false);
        setIsCreatingSg(false);
    };

    // 编辑小组（修改membersPerColumn时会影响座位数量）
    const handleEditSg = (values) => {
        if (!isDraftBigGroup && !onElementsChange) return;

        const sgId = editingSgId;
        const newMembersPerColumn = Number(values.membersPerColumn) || 6;
        const currentSeats = isDraftBigGroup ? getDraftSeats(sgId) : getChildSeats(sgId);

        const updateDraft = (updater) => {
            setDraftSmallGroups(prev => typeof updater === 'function' ? updater(prev) : updater);
        };

        const applyUpdate = (prev) => {
            // 更新小组信息
            const updated = prev.map(e => {
                if (e.id === sgId && e.type === 'small_group') {
                    return {
                        ...e,
                        name: values.name || e.name,
                        membersPerColumn: newMembersPerColumn,
                        color: values.color || e.color
                    };
                }
                return e;
            });

            // 如果座位数变化，调整座位数量
            if (currentSeats.length !== newMembersPerColumn) {
                // 删除多余的座位
                if (currentSeats.length > newMembersPerColumn) {
                    const removeIds = new Set(
                        currentSeats.slice(newMembersPerColumn).map(s => s.id)
                    );
                    return updated.filter(e => !removeIds.has(e.id));
                }
                // 添加新的座位
                const newSeats = [];
                for (let s = currentSeats.length; s < newMembersPerColumn; s++) {
                    const newSeatId = allocId('seat', sgId);
                    newSeats.push({
                        id: newSeatId,
                        type: 'seat',
                        name: `座位 ${newSeatId}`,
                        parentId: sgId,
                        color: values.color || '#ff4d4f'
                    });
                }
                return [...updated, ...newSeats];
            }

            return updated;
        };

        if (isDraftBigGroup) {
            updateDraft(prev => {
                const updated = prev.map(sg => {
                    if (sg.id !== sgId) return sg;

                    let nextSeats = Array.isArray(sg.seats) ? [...sg.seats] : [];
                    if (nextSeats.length > newMembersPerColumn) {
                        nextSeats = nextSeats.slice(0, newMembersPerColumn);
                    } else if (nextSeats.length < newMembersPerColumn) {
                        for (let s = nextSeats.length; s < newMembersPerColumn; s++) {
                            const newSeatId = allocId('seat', sgId);
                            nextSeats.push({
                                id: newSeatId,
                                type: 'seat',
                                name: `座位 ${newSeatId}`,
                                parentId: sgId,
                                color: values.color || sg.color || '#ff4d4f'
                            });
                        }
                    }

                    return {
                        ...sg,
                        name: values.name || sg.name,
                        membersPerColumn: newMembersPerColumn,
                        color: values.color || sg.color,
                        seats: nextSeats,
                    };
                });
                return updated;
            });
        } else {
            onElementsChange(applyUpdate);
        }

        setSgModalVisible(false);
        setEditingSgId(null);
    };

    // 删除小组（级联删除所有座位）
    const handleDeleteSg = (sgId) => {
        if (!isDraftBigGroup && !onElementsChange) return;

        Modal.confirm({
            title: '删除确认',
            content: '删除小组将同时删除该小组下的所有座位，确定继续吗？',
            okText: '确定',
            okType: 'danger',
            cancelText: '取消',
            onOk: () => {
                if (isDraftBigGroup) {
                    setDraftSmallGroups(prev => prev.filter(sg => sg.id !== sgId));
                } else {
                    onElementsChange(prev => {
                        const seatIds = new Set(
                            prev.filter(e => e.type === 'seat' && e.parentId === sgId).map(s => s.id)
                        );
                        seatIds.add(sgId);
                        return prev.filter(e => !seatIds.has(e.id));
                    });
                }
            }
        });
    };

    // 更新座位颜色（批量同步小组颜色）
    const syncSeatColors = (sgId, color) => {
        if (isDraftBigGroup) {
            setDraftSmallGroups(prev => prev.map(sg => {
                if (sg.id !== sgId) return sg;
                return {
                    ...sg,
                    color,
                    seats: (sg.seats || []).map(seat => ({ ...seat, color })),
                };
            }));
            return;
        }
        if (!onElementsChange) return;
        onElementsChange(prev => prev.map(e => {
            if ((e.id === sgId && e.type === 'small_group') ||
                (e.parentId === sgId && e.type === 'seat')) {
                return { ...e, color };
            }
            return e;
        }));
    };

    const handleCenterPos = (type) => {
        if (!selectedItem) return;
        const w = form.getFieldValue("width") || 100;
        const h = form.getFieldValue("height") || 50;
        let x = form.getFieldValue("x") || 0;
        let y = form.getFieldValue("y") || 0;

        switch (type) {
            case "top":
                x = (canvasWidth - w) / 2;
                y = 20;
                break;
            case "bottom":
                x = (canvasWidth - w) / 2;
                y = canvasHeight - h - 20;
                break;
            case "left":
                x = 20;
                y = (canvasHeight - h) / 2;
                break;
            case "right":
                x = canvasWidth - w - 20;
                y = (canvasHeight - h) / 2;
                break;
            case "center":
                x = (canvasWidth - w) / 2;
                y = (canvasHeight - h) / 2;
                break;
            default:
                break;
        }
        form.setFieldsValue({ x, y });
    };

    // 为小组添加单个座位
    const handleAddSingleSeat = (sgId) => {
        if (!allocId) return;
        const seatId = allocId('seat', sgId);
        const sg = isDraftBigGroup
            ? draftSmallGroups.find(e => e.id === sgId)
            : elements.find(e => e.id === sgId && e.type === 'small_group');

        const seat = {
            id: seatId,
            type: 'seat',
            name: `座位 ${seatId}`,
            parentId: sgId,
            color: sg?.color || '#ff4d4f'
        };

        if (isDraftBigGroup) {
            setDraftSmallGroups(prev => prev.map(item => item.id === sgId
                ? { ...item, seats: [...(item.seats || []), seat] }
                : item));
            return;
        }

        if (onElementsChange) {
            onElementsChange(prev => [...prev, seat]);
        }
    };

    // 删除单个座位
    const handleDeleteSeat = (seatId) => {
        if (isDraftBigGroup) {
            setDraftSmallGroups(prev => prev.map(sg => ({
                ...sg,
                seats: (sg.seats || []).filter(seat => seat.id !== seatId),
            })));
            return;
        }
        if (!onElementsChange) return;
        onElementsChange(prev => prev.filter(e => e.id !== seatId));
    };

    return (
        <Modal
            title={`${typeNames[selectedItem?.type] || "组件"}属性编辑`}
            open={isModalVisible}
            forceRender
            onOk={() => {
                form.validateFields().then(values => {
                    if (isDraftBigGroup) {
                        onOk?.(values, { smallGroups: draftSmallGroups });
                    } else {
                        onOk?.(values);
                    }
                });
            }}
            onCancel={onCancel}
            okText="保存"
            cancelText="取消"
            destroyOnHidden
            centered
            className="seat-modal"
            width={isBigGroup ? 700 : isSmallGroup ? 600 : 520}
        >
            {selectedItem && (
                <Form form={form} layout="vertical" className="seat-form">
                    {/* ID - 对所有类型都只读 */}
                    <Form.Item
                        label="ID"
                        name="id"
                        extra="唯一数字ID，自动生成，不可编辑"
                    >
                        <Input disabled />
                    </Form.Item>

                    {/* 类型 - 只读展示 */}
                    {!isSimpleElement && (
                        <Form.Item label="类型">
                            <Input disabled value={typeNames[selectedItem.type] || selectedItem.type} />
                        </Form.Item>
                    )}

                    {/* 父级信息 */}
                    {(isSmallGroup || isSeat) && (
                        <Form.Item label="所属父级 ID">
                            <Input disabled value={String(selectedItem.parentId ?? '')} />
                        </Form.Item>
                    )}

                    {/* 名称 */}
                    <Form.Item label="名称" name="name">
                        <Input placeholder="输入组件名称" />
                    </Form.Item>

                    {/* 显示颜色 */}
                    {!isBigGroup && (
                        <Form.Item label="显示颜色" name="color">
                            <Input type="color" className="seat-color-input" />
                        </Form.Item>
                    )}

                    {/* === 大组编辑区 === */}
                    {isBigGroup && (
                        <>
                            <Divider titlePlacement="left" plain>
                                <span><i className="fas fa-users" style={{ marginRight: 4 }} />小组管理</span>
                            </Divider>
                            <div style={{
                                maxHeight: 400,
                                overflow: 'auto',
                                border: '1px solid #f0f0f0',
                                borderRadius: 8,
                                padding: 12,
                                marginBottom: 16
                            }}>
                                <div style={{ marginBottom: 12 }}>
                                    <Button
                                        type="primary"
                                        size="small"
                                        onClick={() => {
                                            setIsCreatingSg(true);
                                            setEditingSgId(null);
                                            setSgModalVisible(true);
                                        }}
                                    >
                                        <i className="fas fa-plus" style={{ marginRight: 4 }} />
                                        添加小组（自动生成ID和座位）
                                    </Button>
                                </div>

                                {visibleSmallGroups.length === 0 ? (
                                    <Text type="secondary">暂未添加小组</Text>
                                ) : (
                                    visibleSmallGroups.map((sg) => {
                                        const seats = isDraftBigGroup ? getDraftSeats(sg.id) : getChildSeats(sg.id);
                                        return (
                                            <div
                                                key={sg.id}
                                                style={{
                                                    border: '1px solid #e8e8e8',
                                                    borderRadius: 6,
                                                    padding: 10,
                                                    marginBottom: 8,
                                                    backgroundColor: '#fafafa'
                                                }}
                                            >
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: 6
                                                }}>
                                                    <Text strong style={{ fontSize: 13 }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: 2,
                                                            backgroundColor: sg.color,
                                                            marginRight: 6
                                                        }} />
                                                        {sg.name || `小组 ${sg.id}`}
                                                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                                                            (ID: {sg.id})
                                                        </Text>
                                                    </Text>
                                                    <Space size="small">
                                                        <Button
                                                            type="link"
                                                            size="small"
                                                            onClick={() => {
                                                                setIsCreatingSg(false);
                                                                setEditingSgId(sg.id);
                                                                form.setFieldsValue({
                                                                    id: sg.id,
                                                                    name: sg.name,
                                                                    membersPerColumn: sg.membersPerColumn,
                                                                    color: sg.color
                                                                });
                                                                setSgModalVisible(true);
                                                            }}
                                                        >
                                                            编辑
                                                        </Button>
                                                        <Button
                                                            type="link"
                                                            size="small"
                                                            onClick={() => handleAddSingleSeat(sg.id)}
                                                        >
                                                            +座位
                                                        </Button>
                                                        <Button
                                                            type="link"
                                                            danger
                                                            size="small"
                                                            onClick={() => handleDeleteSg(sg.id)}
                                                        >
                                                            删除小组
                                                        </Button>
                                                    </Space>
                                                </div>

                                                {/* 座位列表 */}
                                                <div style={{ paddingLeft: 16 }}>
                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                        座位 ({seats.length}个):
                                                    </Text>
                                                    <div style={{
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        gap: 4,
                                                        marginTop: 4
                                                    }}>
                                                        {seats.map(seat => (
                                                            <Tag
                                                                key={seat.id}
                                                                color={seat.color}
                                                                closable
                                                                onClose={(e) => {
                                                                    e.preventDefault();
                                                                    handleDeleteSeat(seat.id);
                                                                }}
                                                                style={{
                                                                    fontSize: 11,
                                                                    lineHeight: '20px',
                                                                    padding: '0 6px',
                                                                    cursor: 'pointer',
                                                                    margin: 0
                                                                }}
                                                                onClick={() => {
                                                                    // 点击座位Tag在弹窗中编辑
                                                                    form.setFieldsValue({ ...seat });
                                                                    // 用onElementsChange更新但不关闭弹窗的逻辑比较复杂，
                                                                    // 暂时仅展示信息
                                                                }}
                                                            >
                                                                ID:{seat.id}
                                                            </Tag>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {/* === 小组编辑区 === */}
                    {isSmallGroup && (
                        <>
                            <Divider titlePlacement="left" plain>
                                <span><i className="fas fa-chair" style={{ marginRight: 4 }} />座位管理</span>
                            </Divider>
                            <Form.Item label="每列人数（座位数）" name="membersPerColumn">
                                <InputNumber
                                    min={1}
                                    max={30}
                                    style={{ width: '100%' }}
                                    onChange={(value) => {
                                        // 当修改membersPerColumn时自动调整座位数量
                                        if (onElementsChange && allocId && selectedItem?.id) {
                                            const newCount = Number(value) || 1;
                                            const currentSeats = getChildSeats(selectedItem.id);

                                            if (currentSeats.length !== newCount) {
                                                onElementsChange(prev => {
                                                    const updated = [...prev];
                                                    if (currentSeats.length > newCount) {
                                                        // 删除多余的座位
                                                        const removeIds = new Set(
                                                            currentSeats.slice(newCount).map(s => s.id)
                                                        );
                                                        return updated.filter(e => !removeIds.has(e.id));
                                                    } else {
                                                        // 添加新座位
                                                        for (let s = currentSeats.length; s < newCount; s++) {
                                                            const seatId = allocId('seat', selectedItem.id);
                                                            updated.push({
                                                                id: seatId,
                                                                type: 'seat',
                                                                name: `座位 ${seatId}`,
                                                                parentId: selectedItem.id,
                                                                color: selectedItem.color || '#ff4d4f'
                                                            });
                                                        }
                                                        return updated;
                                                    }
                                                });
                                            }
                                        }
                                    }}
                                />
                            </Form.Item>
                            <Form.Item label="显示颜色" name="color">
                                <Input
                                    type="color"
                                    className="seat-color-input"
                                    onChange={(e) => {
                                        // 同步颜色到所有座位
                                        if (onElementsChange && selectedItem?.id) {
                                            syncSeatColors(selectedItem.id, e.target.value);
                                        }
                                    }}
                                />
                            </Form.Item>

                            {/* 当前座位列表 */}
                            {selectedItem?.id && (
                                <div style={{
                                    border: '1px solid #f0f0f0',
                                    borderRadius: 6,
                                    padding: 10,
                                    backgroundColor: '#fafafa'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: 8
                                    }}>
                                        <Text strong style={{ fontSize: 12 }}>
                                            座位列表
                                        </Text>
                                        <Button
                                            type="dashed"
                                            size="small"
                                            onClick={() => handleAddSingleSeat(selectedItem.id)}
                                        >
                                            + 添加座位
                                        </Button>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 6
                                    }}>
                                        {getChildSeats(selectedItem.id).map(seat => (
                                            <Tag
                                                key={seat.id}
                                                color={seat.color}
                                                closable
                                                onClose={(e) => {
                                                    e.preventDefault();
                                                    handleDeleteSeat(seat.id);
                                                }}
                                                style={{
                                                    fontSize: 11,
                                                    lineHeight: '22px',
                                                    padding: '0 8px',
                                                    margin: 0
                                                }}
                                            >
                                                座位 ID:{seat.id}
                                            </Tag>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* === 座位编辑区 === */}
                    {isSeat && (
                        <>
                            <Form.Item label="所属小组 ID">
                                <Input disabled value={String(selectedItem.parentId ?? '')} />
                            </Form.Item>
                            <Divider />
                            <div style={{
                                padding: 12,
                                backgroundColor: '#fafafa',
                                borderRadius: 6,
                                border: '1px solid #f0f0f0'
                            }}>
                                <Text type="secondary">
                                    <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
                                    座位为独立对象，ID: {selectedItem.id}，不可编辑
                                </Text>
                            </div>
                        </>
                    )}

                    {/* === 普通元素编辑区（非大组/小组/座位） === */}
                    {isSimpleElement && (
                        <>
                            {["platform", "desk", "chair", "multimedia", "reserved"].includes(selectedItem.type) && mode === "classic" && !(selectedItem.type === "multimedia" && mode === "classic") && (
                                <>
                                    <div className="seat-form-row">
                                        <Form.Item label="横坐标 (X)" name="x" style={{ flex: 1 }}>
                                            <Input placeholder="请输入横坐标" type="number" />
                                        </Form.Item>
                                        <Form.Item
                                            label="纵坐标 (Y)"
                                            name="y"
                                            extra={selectedItem.type !== "chair" ? "中心点纵坐标" : ""}
                                            style={{ flex: 1 }}
                                        >
                                            <Input placeholder="请输入纵坐标" type="number" />
                                        </Form.Item>
                                    </div>
                                    <div style={{ marginBottom: 16 }}>
                                        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>位置快捷设置:</Text>
                                        <Space wrap>
                                            <Button size="small" onClick={() => handleCenterPos('top')}>靠前居中</Button>
                                            <Button size="small" onClick={() => handleCenterPos('bottom')}>靠后居中</Button>
                                            <Button size="small" onClick={() => handleCenterPos('left')}>靠左居中</Button>
                                            <Button size="small" onClick={() => handleCenterPos('right')}>靠右居中</Button>
                                            <Button size="small" onClick={() => handleCenterPos('center')}>全局居中</Button>
                                        </Space>
                                    </div>
                                </>
                            )}

                            {selectedItem.type === "multimedia" && mode === "classic" && (
                                <div className="seat-form-row">
                                    <Form.Item label="横坐标 (X)" name="x" style={{ flex: 1 }}>
                                        <Input placeholder="请输入横坐标" type="number" />
                                    </Form.Item>
                                </div>
                            )}

                            {["window", "door"].includes(selectedItem.type) && (
                                <div className="seat-form-row">
                                    <Form.Item label="所在侧面" name="side" style={{ flex: 1 }}>
                                        <Select>
                                            <Select.Option value="front">教室前侧</Select.Option>
                                            <Select.Option value="back">教室后侧</Select.Option>
                                            <Select.Option value="left">教室左侧</Select.Option>
                                            <Select.Option value="right">教室右侧</Select.Option>
                                        </Select>
                                    </Form.Item>
                                    <Form.Item label="相对位置" name="relativePos" style={{ flex: 1 }} extra="如: 50 或 50%">
                                        <Input placeholder="请输入相对位置" />
                                    </Form.Item>
                                </div>
                            )}

                            {["multimedia", "reserved"].includes(selectedItem.type) && !(selectedItem.type === "multimedia" && mode === "classic") && (
                                <div className="seat-form-row">
                                    <Form.Item label="宽度" name="width" style={{ flex: 1 }}>
                                        <Input placeholder="请输入宽度" type="number" />
                                    </Form.Item>
                                    <Form.Item label="高度" name="height" style={{ flex: 1 }}>
                                        <Input placeholder="请输入高度" type="number" />
                                    </Form.Item>
                                </div>
                            )}

                            {selectedItem.type === "platform" && mode === "classic" && (
                                <div className="seat-form-row">
                                    <Form.Item label="长度 (宽度)" name="width" style={{ flex: 1 }}>
                                        <Input placeholder="请输入长度" type="number" />
                                    </Form.Item>
                                    <Form.Item label="宽度 (高度)" name="height" style={{ flex: 1 }}>
                                        <Input placeholder="请输入宽度" type="number" />
                                    </Form.Item>
                                </div>
                            )}

                            {selectedItem.type === "multimedia" && mode === "classic" && (
                                <div className="seat-form-row">
                                    <Form.Item label="长度 (宽度)" name="width" style={{ flex: 1 }}>
                                        <Input placeholder="请输入长度" type="number" />
                                    </Form.Item>
                                </div>
                            )}

                            {selectedItem.type === "multimedia" && mode !== "classic" && (
                                <div className="seat-form-row">
                                    <Form.Item label="所在侧面" name="side" style={{ flex: 1 }}>
                                        <Select disabled>
                                            <Select.Option value="front">正前方位置 (经典模式限制)</Select.Option>
                                        </Select>
                                    </Form.Item>
                                    <Form.Item label="旋转角度" name="rotation" style={{ flex: 1 }}>
                                        <Input placeholder="请输入旋转角度 (度)" type="number" />
                                    </Form.Item>
                                </div>
                            )}

                            {["platform", "desk"].includes(selectedItem.type) && !(selectedItem.type === "platform" && mode === "classic") && (
                                <div className="seat-placeholder-panel">
                                    <Divider titlePlacement="left" plain>
                                        <span><i className="fas fa-shapes" style={{ marginRight: 4 }} />自定义形状</span>
                                    </Divider>
                                    <div style={{
                                        padding: 12,
                                        backgroundColor: '#fafafa',
                                        borderRadius: 6,
                                        border: '1px solid #f0f0f0',
                                        marginBottom: 12
                                    }}>
                                        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                                            <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
                                            使用形状编辑器定义元素的自定义SVG形状
                                        </Text>
                                        <Space>
                                            <Button
                                                type="primary"
                                                size="small"
                                                onClick={() => {
                                                    setShapeData(selectedItem.shape || null);
                                                    setShapeEditorOpen(true);
                                                }}
                                            >
                                                📝 编辑形状
                                            </Button>
                                            {shapeData && (
                                                <Button
                                                    size="small"
                                                    onClick={() => {
                                                        setShapeData(null);
                                                        form.setFieldsValue({ shape: undefined });
                                                    }}
                                                >
                                                    ✕ 清除形状
                                                </Button>
                                            )}
                                        </Space>
                                        {shapeData && (
                                            <div style={{ marginTop: 8 }}>
                                                <Tag color="blue">✓ 已保存形状数据</Tag>
                                            </div>
                                        )}
                                    </div>
                                    <Form.Item name="shape" style={{ display: 'none' }}>
                                        <Input type="hidden" />
                                    </Form.Item>
                                </div>
                            )}
                        </>
                    )}
                </Form>
            )}

            {/* 小组添加/编辑弹窗 */}
            {(isBigGroup || isSmallGroup) && (
                <SmallGroupEditModal
                    visible={sgModalVisible}
                    onCancel={() => {
                        setSgModalVisible(false);
                        setEditingSgId(null);
                        setIsCreatingSg(false);
                    }}
                    onSave={isCreatingSg ? handleAddSg : handleEditSg}
                    initialValues={
                        editingSgId !== null
                            ? elements.find(e => e.id === editingSgId && e.type === 'small_group')
                            : null
                    }
                    isCreating={isCreatingSg}
                />
            )}

            {/* 形状编辑器 */}
            <ShapeEditor
                isOpen={shapeEditorOpen}
                onClose={() => setShapeEditorOpen(false)}
                initialSVG={shapeData}
                onSaveShape={(svg) => {
                    setShapeData(svg);
                    form.setFieldsValue({ shape: svg });
                    if (onElementsChange && selectedItem && elements.some(e => e.id === selectedItem.id)) {
                        onElementsChange(prev => prev.map(e => (
                            e.id === selectedItem.id ? { ...e, shape: svg } : e
                        )));
                    }
                }}
            />
        </Modal>
    );
};

export default EditComponentModal;
