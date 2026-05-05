import React, { useRef, useState, useEffect } from 'react'
import { Button, Divider, Space, Typography, message } from 'antd'
import FabricCanvas from './FabricCanvas'
import './shapeEditor.css'
import { useMemo } from 'react'
import { createShapeEditorHandlers } from '../../api/shapeEditor/shapeEditorActions'

const ShapeEditor = ({ isOpen, onClose, onSaveShape, initialSVG }) => {
    const fcRef = useRef(null)
    const [freeDraw, setFreeDraw] = useState(false)

    // 初始化时加载已保存的SVG
    useEffect(() => {
        if (isOpen && initialSVG && fcRef.current) {
            // 延迟一帧确保canvas已准备好
            setTimeout(() => {
                fcRef.current?.loadSVG(initialSVG)
            }, 50)
        }
    }, [isOpen, initialSVG])

    if (!isOpen) return null

    const {
        handleAddRect,
        handleAddCircle,
        handleAddPolygon,
        handleClear,
        handleDelete,
        toggleFree,
        handleSaveShape,
        handleExportJSON,
        handleLoadJSON,
        handleLoadSVG
    } = useMemo(() => createShapeEditorHandlers({
        fcRef,
        freeDraw,
        setFreeDraw,
        onSaveShape,
        onClose,
        message
    }), [fcRef, freeDraw, setFreeDraw, onSaveShape, onClose, message])

    return (
        <div className="shape-editor-overlay">
            <div className="shape-editor-modal">
                <header className="shape-editor-header">
                    <Typography.Title level={4} style={{ margin: 0 }}>形状编辑器</Typography.Title>
                    <div className="shape-editor-actions">
                        <Space>
                            <Button type="primary" onClick={handleSaveShape}>保存形状</Button>
                            <Button onClick={onClose}>取消</Button>
                        </Space>
                    </div>
                </header>

                <div className="shape-editor-body">
                    <aside className="shape-editor-toolbar">
                        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                            <Typography.Text strong>绘图工具</Typography.Text>
                            <Button block onClick={handleAddRect}>矩形</Button>
                            <Button block onClick={handleAddCircle}>圆形</Button>
                            <Button block onClick={handleAddPolygon}>多边形</Button>
                            <Button block onClick={toggleFree}>{freeDraw ? '关闭笔' : '铅笔'}</Button>
                            <Divider style={{ margin: '8px 0' }} />
                            <Typography.Text strong>编辑</Typography.Text>
                            <Button block onClick={handleDelete}>删除选中</Button>
                            <Button block danger onClick={handleClear}>清空画布</Button>
                            <Divider style={{ margin: '8px 0' }} />
                            <Typography.Text strong>导出/导入</Typography.Text>
                            <Button block onClick={handleExportJSON}>导出 JSON</Button>
                            <Button block onClick={handleLoadJSON}>导入 JSON</Button>
                            <Button block onClick={handleLoadSVG}>导入 SVG</Button>
                        </Space>
                    </aside>

                    <main className="shape-editor-canvas-wrapper">
                        <FabricCanvas ref={fcRef} width={900} height={560} />
                    </main>
                </div>
            </div>
        </div>
    )
}

export default ShapeEditor
