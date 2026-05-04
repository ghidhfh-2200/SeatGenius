import React, { useRef, useState, useEffect } from 'react'
import { Button, Divider, Space, Typography, message } from 'antd'
import FabricCanvas from './FabricCanvas'
import './shapeEditor.css'

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

    const handleAddRect = () => fcRef.current?.addRect()
    const handleAddCircle = () => fcRef.current?.addCircle()
    const handleAddPolygon = () => fcRef.current?.addPolygon()
    const handleClear = () => fcRef.current?.clear()
    const handleDelete = () => fcRef.current?.deleteActive()
    const toggleFree = () => {
        const next = !freeDraw
        setFreeDraw(next)
        fcRef.current?.toggleFreeDrawing(next)
    }
    
    const handleSaveShape = async () => {
        const svg = await fcRef.current?.exportCroppedSVG?.() || fcRef.current?.exportSVG()
        if (svg) {
            if (onSaveShape) onSaveShape(svg)
            message.success('形状已保存')
            onClose()
        } else {
            message.error('没有形状可保存')
        }
    }

    const handleExportJSON = () => {
        const json = fcRef.current?.exportJSON()
        const win = window.open('about:blank')
        if (win) {
            win.document.write('<pre>' + escapeHtml(json) + '</pre>')
            win.document.title = 'Canvas JSON'
        }
    }

    const handleLoadJSON = async () => {
        const txt = prompt('Paste canvas JSON here')
        if (txt) {
            try {
                fcRef.current?.loadJSON(txt)
                message.success('JSON已加载')
            } catch (e) {
                message.error('JSON加载失败')
            }
        }
    }

    const handleLoadSVG = async () => {
        const txt = prompt('Paste SVG XML here')
        if (txt) {
            try {
                fcRef.current?.loadSVG(txt)
                message.success('SVG已加载')
            } catch (e) {
                message.error('SVG加载失败')
            }
        }
    }

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

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default ShapeEditor
