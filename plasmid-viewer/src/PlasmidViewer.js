/**
 * PlasmidViewer - 交互式质粒图谱查看器
 */

class PlasmidViewer {
    constructor(options = {}) {
        // 配置
        this.options = {
            container: '#plasmid-viewer',
            width: 600,
            height: 600,
            plasmid: null,
            showLabels: true,
            showArrows: true,
            labelFontSize: 12,
            enableZoom: true,
            enableDrag: true,
            enableHover: true,
            minZoom: 0.5,
            maxZoom: 3,
            colors: {
                CDS: '#4CAF50',
                promoter: '#2196F3',
                origin: '#FF9800',
                insert: '#FF9800',
                fluorescent: '#E91E63',
                resistance: '#9C27B0',
                primer_bind: '#607D8B',
                other: '#9E9E9E',
                backbone: '#E0E0E0',
                label: '#333333',
                highlight: '#FFEB3B'
            },
            ...options
        };

        // 状态
        this.container = null;
        this.svg = null;
        this.plasmid = null;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastMousePos = null;
        this.hoveredFeature = null;
        this.selectedFeature = null;

        // 事件
        this.eventHandlers = {};

        // 初始化
        this._init();
    }

    /**
     * 初始化
     */
    _init() {
        // 获取容器
        this.container = typeof this.options.container === 'string'
            ? document.querySelector(this.options.container)
            : this.options.container;

        if (!this.container) {
            throw new Error('Container not found');
        }

        // 设置容器样式
        this.container.style.position = 'relative';
        this.container.style.width = this.options.width + 'px';
        this.container.style.height = this.options.height + 'px';
        this.container.style.overflow = 'hidden';

        // 创建 SVG
        this._createSVG();

        // 绑定事件
        this._bindEvents();

        // 如果有数据，渲染
        if (this.options.plasmid) {
            this.load(this.options.plasmid);
        }
    }

    /**
     * 创建 SVG 元素
     */
    _createSVG() {
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
        this.svg.style.display = 'block';

        // 创建渐变定义
        this._createDefs();

        // 创建图层
        this.backboneLayer = this._createLayer('backbone');
        this.featureLayer = this._createLayer('features');
        this.labelLayer = this._createLayer('labels');
        this.interactionLayer = this._createLayer('interaction');

        this.container.appendChild(this.svg);
    }

    /**
     * 创建 SVG 渐变和滤镜
     */
    _createDefs() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        // 外环渐变
        const backboneGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        backboneGradient.id = 'backboneGradient';
        backboneGradient.setAttribute('x1', '0%');
        backboneGradient.setAttribute('y1', '0%');
        backboneGradient.setAttribute('x2', '100%');
        backboneGradient.setAttribute('y2', '100%');
        backboneGradient.innerHTML = `
            <stop offset="0%" style="stop-color:#f5f5f5"/>
            <stop offset="100%" style="stop-color:#e0e0e0"/>
        `;
        defs.appendChild(backboneGradient);

        // 箭头渐变
        const arrowGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        arrowGradient.id = 'arrowGradient';
        arrowGradient.setAttribute('x1', '0%');
        arrowGradient.setAttribute('y1', '0%');
        arrowGradient.setAttribute('x2', '0%');
        arrowGradient.setAttribute('y2', '100%');
        arrowGradient.innerHTML = `
            <stop offset="0%" style="stop-color:${this.options.colors.CDS}"/>
            <stop offset="100%" style="stop-color:${this.options.colors.CDS}"/>
        `;
        defs.appendChild(arrowGradient);

        // 阴影滤镜
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.id = 'shadow';
        filter.innerHTML = `
            <feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.3"/>
        `;
        defs.appendChild(filter);

        this.svg.appendChild(defs);
        this.defs = defs;
    }

    /**
     * 创建图层
     */
    _createLayer(id) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.id = `layer-${id}`;
        this.svg.appendChild(g);
        return g;
    }

    /**
     * 绑定事件
     */
    _bindEvents() {
        if (this.options.enableZoom) {
            this.svg.addEventListener('wheel', (e) => this._onWheel(e));
        }

        if (this.options.enableDrag) {
            this.svg.addEventListener('mousedown', (e) => this._onMouseDown(e));
            document.addEventListener('mousemove', (e) => this._onMouseMove(e));
            document.addEventListener('mouseup', (e) => this._onMouseUp(e));
        }

        if (this.options.enableHover) {
            this.svg.addEventListener('mousemove', (e) => this._onMouseMove(e));
            this.svg.addEventListener('mouseleave', (e) => this._onMouseLeave(e));
        }
    }

    /**
     * 加载质粒数据
     * @param {object} plasmid - 质粒数据
     */
    load(plasmid) {
        this.plasmid = {
            name: plasmid.name || 'Unnamed',
            length: plasmid.length || 0,
            features: plasmid.features || [],
            ...plasmid
        };

        // 触发事件
        this._emit('plasmidLoad', this.plasmid);

        // 渲染
        this.render();
    }

    /**
     * 渲染图谱
     */
    render() {
        if (!this.plasmid) return;

        // 清空图层
        this.backboneLayer.innerHTML = '';
        this.featureLayer.innerHTML = '';
        this.labelLayer.innerHTML = '';
        this.interactionLayer.innerHTML = '';

        // 计算布局参数
        const centerX = this.options.width / 2;
        const centerY = this.options.height / 2;
        const radius = Math.min(centerX, centerY) * 0.7;
        const backboneWidth = 20;

        // 绘制外环
        this._drawBackbone(centerX, centerY, radius, backboneWidth);

        // 绘制特征
        this.plasmid.features.forEach((feature, index) => {
            this._drawFeature(feature, centerX, centerY, radius, backboneWidth, index);
        });

        // 绘制标签
        if (this.options.showLabels) {
            this._drawLabels(centerX, centerY, radius, backboneWidth);
        }

        // 绘制尺寸标注
        this._drawSizeLabel(centerX, centerY, radius);
    }

    /**
     * 绘制外环
     */
    _drawBackbone(centerX, centerY, radius, width) {
        const outerRadius = radius + width / 2;
        const innerRadius = radius - width / 2;

        // 外环
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', centerX);
        ring.setAttribute('cy', centerY);
        ring.setAttribute('r', (outerRadius + innerRadius) / 2);
        ring.setAttribute('r', outerRadius);
        ring.setAttribute('fill', 'url(#backboneGradient)');
        ring.setAttribute('stroke', '#ccc');
        ring.setAttribute('stroke-width', '1');
        this.backboneLayer.appendChild(ring);

        // 内环（遮罩中间）
        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        inner.setAttribute('cx', centerX);
        inner.setAttribute('cy', centerY);
        inner.setAttribute('r', innerRadius);
        inner.setAttribute('fill', '#ffffff');
        this.backboneLayer.appendChild(inner);

        // 刻度
        this._drawTicks(centerX, centerY, outerRadius, innerRadius);
    }

    /**
     * 绘制刻度
     */
    _drawTicks(centerX, centerY, outerRadius, innerRadius) {
        const numTicks = 24; // 每 500bp 一个刻度（假设 12kbp）
        const tickLength = 5;
        const plasmidLength = this.plasmid.length;

        for (let i = 0; i < numTicks; i++) {
            const angle = (i / numTicks) * Math.PI * 2 - Math.PI / 2;
            
            const x1 = centerX + Math.cos(angle) * innerRadius;
            const y1 = centerY + Math.sin(angle) * innerRadius;
            const x2 = centerX + Math.cos(angle) * (innerRadius - tickLength);
            const y2 = centerY + Math.sin(angle) * (innerRadius - tickLength);

            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', x1);
            tick.setAttribute('y1', y1);
            tick.setAttribute('x2', x2);
            tick.setAttribute('y2', y2);
            tick.setAttribute('stroke', '#999');
            tick.setAttribute('stroke-width', '1');
            this.backboneLayer.appendChild(tick);
        }
    }

    /**
     * 绘制特征
     */
    _drawFeature(feature, centerX, centerY, radius, backboneWidth, index) {
        const color = feature.color || this.options.colors[feature.type] || this.options.colors.other;
        const startAngle = (feature.start / this.plasmid.length) * Math.PI * 2 - Math.PI / 2;
        const endAngle = (feature.end / this.plasmid.length) * Math.PI * 2 - Math.PI / 2;
        const arcWidth = Math.abs(endAngle - startAngle);

        // 绘制特征弧
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'feature');
        group.setAttribute('data-feature', JSON.stringify(feature));

        // 特征外弧
        const outerArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const innerR = radius - backboneWidth / 2 - 3;
        const outerR = radius - backboneWidth / 2 - 3 - 15 - (index % 4) * 5;
        
        outerArc.setAttribute('d', this._describeArc(
            centerX, centerY, 
            outerR, 
            startAngle, endAngle
        ));
        outerArc.setAttribute('fill', color);
        outerArc.setAttribute('stroke', '#fff');
        outerArc.setAttribute('stroke-width', '1');
        outerArc.setAttribute('opacity', '0.8');
        outerArc.style.cursor = 'pointer';

        // 悬停效果
        outerArc.addEventListener('mouseenter', () => this._onFeatureHover(feature, outerArc));
        outerArc.addEventListener('mouseleave', () => this._onFeatureLeave(feature, outerArc));
        outerArc.addEventListener('click', () => this._onFeatureClick(feature));

        group.appendChild(outerArc);

        // 箭头（如果是 CDS）
        if (this.options.showArrows && (feature.type === 'CDS' || feature.type === 'gene')) {
            const arrow = this._drawArrow(
                centerX, centerY, 
                outerR - 2, 
                startAngle, endAngle,
                feature.strand
            );
            group.appendChild(arrow);
        }

        this.featureLayer.appendChild(group);
    }

    /**
     * 绘制箭头
     */
    _drawArrow(centerX, centerY, radius, startAngle, endAngle, strand) {
        const midAngle = (startAngle + endAngle) / 2;
        const arrowLength = 0.1; // 弧度
        const arrowSize = 8;

        let fromAngle, toAngle;
        if (strand === '+') {
            fromAngle = endAngle - arrowLength;
            toAngle = endAngle;
        } else {
            fromAngle = startAngle;
            toAngle = startAngle + arrowLength;
        }

        const points = [];
        const r = radius;
        
        // 箭头基线
        const x1 = centerX + Math.cos(fromAngle) * r;
        const y1 = centerY + Math.sin(fromAngle) * r;
        const x2 = centerX + Math.cos(toAngle) * r;
        const y2 = centerY + Math.sin(toAngle) * r;

        // 箭头头部
        const headAngle = strand === '+' ? endAngle + 0.15 : startAngle - 0.15;
        const headR = r - arrowSize;
        const headX = centerX + Math.cos(headAngle) * headR;
        const headY = centerY + Math.sin(headAngle) * headR;

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', `${x1},${y1} ${x2},${y2} ${headX},${headY}`);
        arrow.setAttribute('fill', 'rgba(255,255,255,0.8)');

        return arrow;
    }

    /**
     * 绘制标签
     */
    _drawLabels(centerX, centerY, radius, backboneWidth) {
        const labelRadius = radius - backboneWidth / 2 - 25;

        this.plasmid.features.forEach((feature, index) => {
            // 只显示 CDS 的标签
            if (feature.type !== 'CDS' && feature.type !== 'gene') return;
            if (feature.length < 100) return; // 太短不显示

            const midAngle = (feature.start / this.plasmid.length) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(midAngle) * labelRadius;
            const y = centerY + Math.sin(midAngle) * labelRadius;

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('font-size', this.options.labelFontSize);
            text.setAttribute('fill', this.options.colors.label);
            text.setAttribute('font-weight', 'bold');
            text.textContent = feature.name.substring(0, 10);

            // 旋转标签
            const rotation = (midAngle * 180 / Math.PI) + 90;
            text.setAttribute('transform', `rotate(${rotation}, ${x}, ${y})`);

            this.labelLayer.appendChild(text);
        });
    }

    /**
     * 绘制尺寸标注
     */
    _drawSizeLabel(centerX, centerY, radius) {
        const labelRadius = radius + 40;

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', centerX);
        label.setAttribute('y', centerY - labelRadius);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '14');
        label.setAttribute('fill', '#666');
        label.setAttribute('font-weight', 'bold');
        label.textContent = `${this.plasmid.name} (${this._formatLength(this.plasmid.length)})`;

        this.labelLayer.appendChild(label);
    }

    /**
     * 格式化长度
     */
    _formatLength(length) {
        if (length >= 1000) {
            return (length / 1000).toFixed(1) + ' kb';
        }
        return length + ' bp';
    }

    /**
     * 描述 SVG 弧线路径
     */
    _describeArc(x, y, radius, startAngle, endAngle) {
        const start = this._polarToCartesian(x, y, radius, endAngle);
        const end = this._polarToCartesian(x, y, radius, startAngle);

        const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1';

        return [
            'M', start.x, start.y,
            'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(' ');
    }

    _polarToCartesian(centerX, centerY, radius, angleInRadians) {
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    // ==================== 事件处理 ====================

    _onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.zoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, this.zoom + delta));
        this._applyTransform();
        this._emit('zoomChange', this.zoom);
    }

    _onMouseDown(e) {
        this.isDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.svg.style.cursor = 'grabbing';
    }

    _onMouseMove(e) {
        if (this.isDragging && this.lastMousePos) {
            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;
            this.panX += dx;
            this.panY += dy;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this._applyTransform();
        }
    }

    _onMouseUp(e) {
        this.isDragging = false;
        this.lastMousePos = null;
        this.svg.style.cursor = 'default';
    }

    _onMouseLeave(e) {
        if (this.hoveredFeature) {
            this._onFeatureLeave(this.hoveredFeature);
            this.hoveredFeature = null;
        }
    }

    _onFeatureHover(feature, element) {
        if (this.hoveredFeature === feature) return;
        this.hoveredFeature = feature;

        element.setAttribute('opacity', '1');
        element.setAttribute('stroke', '#333');
        element.setAttribute('stroke-width', '2');
        element.setAttribute('filter', 'url(#shadow)');

        this._emit('featureHover', feature);
    }

    _onFeatureLeave(feature, element) {
        element.setAttribute('opacity', '0.8');
        element.setAttribute('stroke', '#fff');
        element.setAttribute('stroke-width', '1');
        element.removeAttribute('filter');

        this._emit('featureLeave', feature);
    }

    _onFeatureClick(feature) {
        this.selectedFeature = feature;
        this._emit('featureClick', feature);
    }

    _applyTransform() {
        const transform = `scale(${this.zoom}) translate(${this.panX / this.zoom}, ${this.panY / this.zoom})`;
        this.backboneLayer.setAttribute('transform', transform);
        this.featureLayer.setAttribute('transform', transform);
        this.labelLayer.setAttribute('transform', transform);
    }

    // ==================== 公共 API ====================

    /**
     * 放大
     */
    zoomIn() {
        this.zoom = Math.min(this.options.maxZoom, this.zoom + 0.2);
        this._applyTransform();
    }

    /**
     * 缩小
     */
    zoomOut() {
        this.zoom = Math.max(this.options.minZoom, this.zoom - 0.2);
        this._applyTransform();
    }

    /**
     * 重置缩放
     */
    resetZoom() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this._applyTransform();
    }

    /**
     * 高亮特征
     */
    highlightFeature(featureName) {
        const features = this.featureLayer.querySelectorAll('.feature');
        features.forEach(el => {
            const feature = JSON.parse(el.getAttribute('data-feature'));
            if (feature.name === featureName) {
                el.querySelector('path').setAttribute('opacity', '1');
                el.querySelector('path').setAttribute('stroke', this.options.colors.highlight);
                el.querySelector('path').setAttribute('stroke-width', '3');
            }
        });
    }

    /**
     * 取消高亮
     */
    clearHighlight() {
        const features = this.featureLayer.querySelectorAll('.feature path');
        features.forEach(el => {
            el.setAttribute('opacity', '0.8');
            el.setAttribute('stroke', '#fff');
            el.setAttribute('stroke-width', '1');
        });
    }

    /**
     * 绑定事件
     */
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    /**
     * 触发事件
     */
    _emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => handler(data));
        }
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.container && this.svg) {
            this.container.removeChild(this.svg);
        }
        this.eventHandlers = {};
    }
}

// 导出
window.PlasmidViewer = PlasmidViewer;
