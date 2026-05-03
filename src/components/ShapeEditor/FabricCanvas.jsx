import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { fabric } from 'fabric'

const FabricCanvas = forwardRef(({ width = 900, height = 560 }, ref) => {
    const canvasEl = useRef(null)
    const canvas = useRef(null)

    useEffect(() => {
        canvas.current = new fabric.Canvas(canvasEl.current, {
            backgroundColor: 'transparent',
            preserveObjectStacking: true,
            selection: true,
            hoverCursor: 'pointer',
        })
        canvas.current.setWidth(width)
        canvas.current.setHeight(height)

        return () => {
            if (canvas.current) {
                canvas.current.dispose()
                canvas.current = null
            }
        }
    }, [width, height])

    useImperativeHandle(ref, () => ({
        addRect(opts = {}) {
            const rect = new fabric.Rect(Object.assign({ left: 40, top: 40, width: 120, height: 80, fill: '#f6b', stroke: '#333' }, opts))
            canvas.current.add(rect)
            canvas.current.setActiveObject(rect)
            canvas.current.requestRenderAll()
            return rect
        },
        addCircle(opts = {}) {
            const circ = new fabric.Circle(Object.assign({ left: 80, top: 80, radius: 40, fill: '#6bf', stroke: '#333' }, opts))
            canvas.current.add(circ)
            canvas.current.setActiveObject(circ)
            canvas.current.requestRenderAll()
            return circ
        },
        addPolygon(points = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 30, y: 60 }], opts = {}) {
            const poly = new fabric.Polygon(points, Object.assign({ left: 60, top: 60, fill: '#b6f', stroke: '#333' }, opts))
            canvas.current.add(poly)
            canvas.current.setActiveObject(poly)
            canvas.current.requestRenderAll()
            return poly
        },
        addPath(pathData, opts = {}) {
            const path = new fabric.Path(pathData, Object.assign({ left: 40, top: 40, fill: '', stroke: '#222' }, opts))
            canvas.current.add(path)
            canvas.current.setActiveObject(path)
            canvas.current.requestRenderAll()
            return path
        },
        toggleFreeDrawing(enable) {
            canvas.current.isDrawingMode = !!enable
            if (canvas.current.freeDrawingBrush) {
                canvas.current.freeDrawingBrush.width = 2
                canvas.current.freeDrawingBrush.color = '#222'
            }
        },
        deleteActive() {
            const active = canvas.current.getActiveObject()
            if (active) {
                canvas.current.remove(active)
                canvas.current.requestRenderAll()
            }
        },
        clear() {
            canvas.current.clear()
            canvas.current.setBackgroundColor('transparent', canvas.current.renderAll.bind(canvas.current))
        },
        exportSVG() {
            return canvas.current.toSVG()
        },
        exportJSON() {
            return JSON.stringify(canvas.current.toJSON(['selectable']), null, 2)
        },
        loadJSON(json) {
            try {
                canvas.current.loadFromJSON(json, () => canvas.current.requestRenderAll())
            } catch (e) {
                console.error('loadJSON error', e)
            }
        },
    }))

    return (
        <div className="fabric-canvas-container">
            <canvas ref={canvasEl} />
        </div>
    )
})

export default FabricCanvas
