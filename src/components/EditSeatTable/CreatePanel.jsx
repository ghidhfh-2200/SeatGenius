import React from "react";
import { Button, Col, Row, Select } from "antd";
import { getClassicComponentMetadata } from "../../api/newclassroom/classicComponents";

const CreatePanel = ({ onCreate, mode, onModeChange }) => {

    const renderClassicMode = () => {
        const metadata = getClassicComponentMetadata();

        return (
            <Row gutter={[12, 12]}>
                {metadata.map((item) => (
                    <Col span={8} key={item.type}>
                        <Button onClick={() => onCreate(item.type)} className="seat-create-button">
                            <i className={`fas ${item.icon} seat-create-icon`}></i>
                            <span>{item.label}</span>
                        </Button>
                    </Col>
                ))}
            </Row>
        );
    };

    const renderComplexMode = () => (
        <Row gutter={[12, 12]}>
            <Col span={8}><Button onClick={() => onCreate("chair")} className="seat-create-button"><i className="fas fa-chair seat-create-icon"></i><span>座位</span></Button></Col>
            <Col span={8}><Button onClick={() => onCreate("desk")} className="seat-create-button"><i className="fas fa-table seat-create-icon"></i><span>课桌</span></Button></Col>
            <Col span={8}><Button onClick={() => onCreate("platform")} className="seat-create-button"><i className="fas fa-chalkboard-teacher seat-create-icon"></i><span>讲台</span></Button></Col>
            <Col span={8}><Button onClick={() => onCreate("window")} className="seat-create-button"><i className="fas fa-window-maximize seat-create-icon"></i><span>窗户</span></Button></Col>
            <Col span={8}><Button onClick={() => onCreate("door")} className="seat-create-button"><i className="fas fa-door-closed seat-create-icon"></i><span>门</span></Button></Col>
            <Col span={8}><Button onClick={() => onCreate("multimedia")} className="seat-create-button"><i className="fas fa-tv seat-create-icon"></i><span>多媒体</span></Button></Col>
            <Col span={8}><Button onClick={() => onCreate("reserved")} className="seat-create-button"><i className="fas fa-border-none seat-create-icon"></i><span>空位</span></Button></Col>
        </Row>
    );

    return (
        <div className="seat-panel-body" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "0 4px 12px 0" }}>
                <Select value={mode} onChange={onModeChange} style={{ width: "100%" }}>
                    <Select.Option value="classic">经典模式</Select.Option>
                    <Select.Option value="complex">复杂场景</Select.Option>
                </Select>
            </div>
            <div className="custom-scroll seat-create-scroll" style={{ flex: 1 }}>
                {mode === "classic" ? renderClassicMode() : renderComplexMode()}
            </div>
        </div>
    );
};

export default CreatePanel;
