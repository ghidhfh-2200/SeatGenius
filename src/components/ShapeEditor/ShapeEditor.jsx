import React, { useRef, useState } from 'react'
import FabricCanvas from './FabricCanvas'
import './shapeEditor.css'

const ShapeEditor = ({ isOpen, onClose, onInsertSVG }) => {
    const fcRef = useRef(null)
    const [freeDraw, setFreeDraw] = useState(false)

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
    const handleExportSVG = () => {
        const svg = fcRef.current?.exportSVG()
        if (onInsertSVG && svg) onInsertSVG(svg)
        onClose()
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
        if (txt) fcRef.current?.loadJSON(txt)
    }

    return (
        <div className="shape-editor-overlay">
            <div className="shape-editor-modal">
                <header className="shape-editor-header">
                    <h2>形状编辑器</h2>
                    <div className="shape-editor-actions">
                        <button onClick={handleExportSVG}>插入到教室 (SVG)</button>
                        <button onClick={onClose}>关闭</button>
                    </div>
                </header>

                <div className="shape-editor-body">
                    <aside className="shape-editor-toolbar">
                        <button onClick={handleAddRect}>矩形</button>
                        <button onClick={handleAddCircle}>圆形</button>
                        <button onClick={handleAddPolygon}>多边形</button>
                        <button onClick={toggleFree}>{freeDraw ? '关闭' : '铅笔'}</button>
                        <button onClick={handleDelete}>删除选中</button>
                        <button onClick={handleClear}>清空</button>
                        <hr />
                        <button onClick={handleExportJSON}>导出 JSON</button>
                        <button onClick={handleLoadJSON}>导入 JSON</button>
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
