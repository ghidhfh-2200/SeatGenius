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
        async exportCroppedSVG() {
            const objects = canvas.current.getObjects()
            if (!objects || objects.length === 0) return ''

            let minX = Infinity
            let minY = Infinity
            let maxX = -Infinity
            let maxY = -Infinity

            objects.forEach(obj => {
                const rect = obj.getBoundingRect(true, true)
                minX = Math.min(minX, rect.left)
                minY = Math.min(minY, rect.top)
                maxX = Math.max(maxX, rect.left + rect.width)
                maxY = Math.max(maxY, rect.top + rect.height)
            })

            const width = Math.max(1, maxX - minX)
            const height = Math.max(1, maxY - minY)

            const clones = await Promise.all(objects.map((obj) => new Promise((resolve) => {
                obj.clone((clone) => resolve(clone))
            })))

            const temp = new fabric.StaticCanvas(null, {
                backgroundColor: 'transparent',
                preserveObjectStacking: true,
            })
            temp.setDimensions({ width, height })

            clones.forEach((clone) => {
                const rect = clone.getBoundingRect(true, true)
                clone.set({
                    left: rect.left - minX,
                    top: rect.top - minY,
                })
                temp.add(clone)
            })

            const svg = temp.toSVG({
                width,
                height,
                viewBox: {
                    x: 0,
                    y: 0,
                    width,
                    height,
                },
            })

            temp.dispose()
            return svg
        },
        exportJSON() {
            return JSON.stringify(canvas.current.toJSON(['selectable']), null, 2)
        },
        loadJSON(json) {
            try {
                const parsed = typeof json === 'string' ? JSON.parse(json) : json
                canvas.current.loadFromJSON(parsed, () => canvas.current.requestRenderAll())
            } catch (e) {
                console.error('loadJSON error', e)
            }
        },
        loadSVG(svgString) {
            try {
                if (typeof svgString !== 'string') return
                // 清空画布
                canvas.current.clear()
                canvas.current.setBackgroundColor('transparent', canvas.current.renderAll.bind(canvas.current))

                const loadFn = fabric.loadSVGFromString || fabric.util.loadSVGFromString
                loadFn(svgString, (objects, options) => {
                    if (!objects || objects.length === 0) return

                    const group = fabric.util.groupSVGElements(objects, options)
                    const obj = group || objects[0]

                    // 适配缩放到画布区域
                    const bounds = obj.getBoundingRect(true)
                    const pad = 40
                    const maxW = canvas.current.getWidth() - pad * 2
                    const maxH = canvas.current.getHeight() - pad * 2
                    const scale = Math.min(maxW / bounds.width, maxH / bounds.height, 1)

                    obj.scale(scale)
                    obj.set({ left: pad, top: pad })

                    if (group) {
                        canvas.current.add(group)
                        canvas.current.setActiveObject(group)
                    } else {
                        objects.forEach(o => canvas.current.add(o))
                        canvas.current.setActiveObject(obj)
                    }

                    canvas.current.viewportTransform = [1, 0, 0, 1, 0, 0]
                    canvas.current.requestRenderAll()
                })
            } catch (e) {
                console.error('loadSVG error', e)
            }
        },
        exportSVGForWeb() {
            // 用于在网页中显示的SVG（完整格式）
            const svg = canvas.current.toSVG()
            return svg
        },
    }))

    return (
        <div className="fabric-canvas-container">
            <canvas ref={canvasEl} />
        </div>
    )
})

export default FabricCanvas
