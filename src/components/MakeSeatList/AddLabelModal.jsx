import React, { useEffect, useState } from 'react';
import { Modal, Input, Form, Select, Slider, Space, Typography } from 'antd';
import { buildLabelSubmission } from '../../api/makeSeatList/labelModalActions';

const { Text } = Typography;

const AddLabelModal = ({
    open,
    title = '新增标签',
    initialValue = '',
    initialColor = '#1677ff',
    initialFactor = 'height',
    initialWeight = 0.5,
    placeholder = '请输入标签名称',
    confirmText = '保存',
    showColor = false,
    showFactor = false,
    showWeight = false,
    factorOptions = [],
    onOk,
    onCancel,
}) => {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            form.setFieldsValue({ value: initialValue, color: initialColor, factor: initialFactor, weight: initialWeight });
        }
    }, [open, initialValue, initialColor, initialFactor, initialWeight, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            const submission = buildLabelSubmission({ values, initialColor, initialFactor, initialWeight });
            const value = submission.value;
            if (!value) return;

            setSubmitting(true);
            await onOk?.({
                ...submission,
            });
            form.resetFields();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={title}
            open={open}
            onCancel={() => {
                form.resetFields();
                onCancel?.();
            }}
            onOk={handleOk}
            confirmLoading={submitting}
            okText={confirmText}
            destroyOnHidden
        >
            <Form form={form} layout="vertical" initialValues={{ value: initialValue, color: initialColor, factor: initialFactor, weight: initialWeight }}>
                <Form.Item
                    name="value"
                    rules={[{ required: true, message: '请输入名称' }]}
                >
                    <Input placeholder={placeholder} autoFocus />
                </Form.Item>

                {showColor && (
                    <Form.Item
                        name="color"
                        label="标签颜色"
                        rules={[{ required: true, message: '请选择颜色' }]}
                    >
                        <Input type="color" style={{ width: 120, padding: 4, height: 40 }} />
                    </Form.Item>
                )}

                {showFactor && (
                    <Form.Item
                        name="factor"
                        label="因子"
                        rules={[{ required: true, message: '请选择因子' }]}
                    >
                        <Select options={factorOptions} placeholder="请选择因子" />
                    </Form.Item>
                )}

                {showWeight && (
                    <Form.Item
                        name="weight"
                        label={(<Space><Text>权重</Text></Space>)}
                        rules={[{ required: true, message: '请设置权重' }]}
                    >
                        <Slider min={0} max={1} step={0.01} />
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
};

export default AddLabelModal;
