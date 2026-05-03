import React, { useState } from "react";
import { Upload, Typography, Card, Space, message, Layout, Alert, Row, Col, Button } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import SaveAsModal from "../components/UploadStudentName/SaveAsModal";
import { parseNameListFile, isSupportedNameListFile } from "../api/shared/fileParsing";

const { Dragger } = Upload;
const { Title, Paragraph, Text } = Typography;
const { Content } = Layout;

const UploadStudentName = () => {
    const navigate = useNavigate()
    const [uploadedNames, setUploadedNames] = useState([]);
    const [saveModalVisible, setSaveModalVisible] = useState(false);
    const [listName, setListName] = useState('namelist');
    const [fileList, setFileList] = useState([]);

    const uploadProps = {
        name: "file",
        multiple: false,
        accept: ".txt,.csv",
        beforeUpload: (file) => {
            if (!isSupportedNameListFile(file)) {
                message.error("仅支持上传 .txt 或 .csv 文件");
            }

            return isSupportedNameListFile(file);
        },
        onChange: info => {
            // enforce single-file selection
            const fl = info.fileList.slice(-1);
            setFileList(fl);
        },
        customRequest: async ({ file, onSuccess, onError }) => {
            try {
                const names = await parseNameListFile(file);
                if (names.length === 0) {
                    message.warning('上传成功，但未解析到有效姓名');
                } else {
                    message.success(`解析到 ${names.length} 个姓名`);
                }
                setUploadedNames(names);
                // keep one-file state
                setFileList([file]);
                if (onSuccess) onSuccess('ok');
            } catch (err) {
                console.error('解析上传文件失败', err);
                message.error('解析上传文件失败：' + String(err));
                if (onError) onError(err);
            }
        },
    };

    return (
        <Layout style={{ height: "100vh", overflow: "hidden" }}>
            <Content style={{ padding: 16 }}>
                {uploadedNames.length === 0 ? (
                    <Row justify="center" align="middle" style={{ height: "100%" }}>
                        <Col xs={24} sm={20} md={16} lg={12} xl={10}>
                            <Card variant="plain" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)", borderRadius: 8 }}>
                                <Space orientation="vertical" size="large" style={{ width: "100%", textAlign: "center" }}>
                                    <div>
                                        <Title level={2} style={{ margin: 0 }}>SeatGenius</Title>
                                        <Text type="secondary">智能排座系统，请上传学生名单以继续</Text>
                                    </div>

                                    <Upload {...uploadProps} showUploadList={false} fileList={fileList} maxCount={1}>
                                        <Button type="primary">选择文件</Button>
                                    </Upload>

                                    <Alert
                                        title="名单格式提示"
                                        description="请确保文件每行为一个姓名，或使用包含姓名列的 CSV 文件。"
                                        type="info"
                                        showIcon
                                        style={{ textAlign: "left" }}
                                    />
                                </Space>
                            </Card>
                        </Col>
                    </Row>
                ) : (
                    <Row gutter={16} style={{ height: '100%' }}>
                        <Col xs={24} md={10} style={{ display: 'flex', flexDirection: 'column' }}>
                            <Card title="上传的文件" style={{ flex: 1, overflow: 'auto' }}>
                                <div style={{ marginBottom: 12 }}>
                                    <Upload {...uploadProps} showUploadList={false} fileList={fileList} maxCount={1}>
                                        <Button>替换文件</Button>
                                    </Upload>
                                </div>
                                <div style={{ marginTop: 12 }}>
                                    <Button onClick={() => { setUploadedNames([]); setFileList([]); message.info('已清除上传数据'); }}>清除</Button>
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} md={14} style={{ display: 'flex', flexDirection: 'column' }}>
                            <Card title="已解析的姓名（预览）" style={{ flex: 1, overflow: 'auto' }}>
                                <div style={{ maxHeight: 'calc(100vh - 240px)', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {uploadedNames.map((item, idx) => (
                                        <div
                                            key={`${item}-${idx}`}
                                            style={{
                                                border: '1px solid #f0f0f0',
                                                borderRadius: 6,
                                                padding: '6px 10px',
                                                background: '#fff',
                                            }}
                                        >
                                            {item}
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: 12, textAlign: 'right' }}>
                                    <Button style={{ marginRight: 8 }} onClick={() => { const defaultName = `namelist-${Date.now()}`; setListName(defaultName); setSaveModalVisible(true); }}>另存为</Button>
                                    <Button type="primary" onClick={() => navigate("/edit_labels", { state: { names: uploadedNames } })}>下一步</Button>
                                </div>

                                <SaveAsModal
                                    open={saveModalVisible}
                                    listName={listName}
                                    onListNameChange={setListName}
                                    uploadedNames={uploadedNames}
                                    onClose={() => setSaveModalVisible(false)}
                                    onSaved={() => setSaveModalVisible(false)}
                                />
                            </Card>
                        </Col>
                    </Row>
                )}
            </Content>
        </Layout>
    );
};

export default UploadStudentName;
