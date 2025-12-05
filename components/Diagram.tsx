import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ElectricalNode, ComponentType, Project } from '../types';
import { COMPONENT_CONFIG, ICON_PATHS, DEFAULT_PRINT_METADATA } from '../constants';

interface DiagramProps {
  data: ElectricalNode[];
  onNodeClick: (node: ElectricalNode, isMulti: boolean) => void;
  onLinkClick: (sourceId: string, targetId: string) => void;
  onDuplicateChild: (node: ElectricalNode) => void;
  onDeleteNode: (node: ElectricalNode) => void;
  onToggleCollapse: (node: ElectricalNode) => void;
  onGroupNode: (node: ElectricalNode) => void;
  onNodeMove?: (updates: { id: string; x: number; y: number }[]) => void;
  onAddRoot?: () => void;
  onAddGenerator?: () => void;
  onBackgroundClick?: () => void;
  selectedNodeId: string | null;
  multiSelection: Set<string>;
  selectedLinkId: string | null;
  orientation: 'horizontal' | 'vertical';
  searchMatches: Set<string> | null;
  isConnectMode?: boolean;
  connectionSourceId?: string | null;
  isPrintMode?: boolean;
  activeProject?: Project;
  onDisconnectLink?: () => void;
  onEditPrintSettings?: (field?: string) => void;
  t: any;
  language: string;
  theme: 'light' | 'dark';
  isCleanView?: boolean;
  activeFilters?: Set<string>;
  annotations?: {id: string, path: string, color: string}[];
  isAnnotating?: boolean;
  annotationColor?: string;
  onAnnotationAdd?: (path: string, color: string) => void;
}

type ExtendedHierarchyNode = Omit<
  d3.HierarchyPointNode<ElectricalNode>,
  'parent' | 'children'
> & {
  width: number;
  height: number;
  x: number;
  y: number;
  __isDragging?: boolean;
  __totalDx?: number;
  __totalDy?: number;
  __initialManualX?: number;
  __initialManualY?: number;
  _children?: ExtendedHierarchyNode[] | null;
  children?: ExtendedHierarchyNode[] | undefined;
  parent: ExtendedHierarchyNode | null;
  data: ElectricalNode;
};

type DiagramLink = {
  source: ExtendedHierarchyNode;
  target: ExtendedHierarchyNode;
};

export const Diagram: React.FC<DiagramProps> = ({
  data,
  onNodeClick,
  onLinkClick,
  onDuplicateChild,
  onDeleteNode,
  onToggleCollapse,
  onGroupNode,
  onNodeMove,
  onAddRoot,
  onAddGenerator,
  onBackgroundClick,
  selectedNodeId,
  multiSelection,
  selectedLinkId,
  orientation,
  searchMatches,
  isConnectMode = false,
  connectionSourceId = null,
  isPrintMode = false,
  activeProject,
  onDisconnectLink,
  onEditPrintSettings,
  t,
  language,
  theme,
  isCleanView = false,
  activeFilters = new Set(),
  annotations = [],
  isAnnotating = false,
  annotationColor = '#ef4444',
  onAnnotationAdd
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  const isRTL = language === 'he' || language === 'ar';
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#0f172a' : '#ffffff';
  const dotColor = isDark ? '#1e293b' : '#e2e8f0';
  const linkColor = isDark ? '#cbd5e1' : '#334155';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const nodeBgColor = isDark ? '#1e293b' : '#ffffff';
  const rootNodeBgColor = isDark ? '#334155' : '#f8fafc';
  const secondaryTextColor = isDark ? '#94a3b8' : '#475569';

  const getTranslatedDescription = (desc?: string) => {
    if (!desc) return '';
    const defaults: Record<string, string> = {
      'Main Supply': t.defaultDesc.grid,
      'Standby Power': t.defaultDesc.gen,
      'Step Down/Up': t.defaultDesc.trans,
      'Independent Load': t.defaultDesc.load,
      'Grouped Components': t.inputPanel.groupNode,
    };
    return defaults[desc] || desc;
  };

  const getTranslatedName = (name: string, type: string) => {
    if (
      !name ||
      name.toUpperCase() === type ||
      name.replace(/_/g, ' ').toUpperCase() === type.replace(/_/g, ' ')
    ) {
      return t.componentTypes[type] || name;
    }
    return name;
  };

  useEffect(() => {
    if (wrapperRef.current) {
      setDimensions({
        width: wrapperRef.current.offsetWidth,
        height: wrapperRef.current.offsetHeight,
      });
    }
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Background click handler
    svg.on('click', (event) => {
      if (event.defaultPrevented) return; // Zoom drag
      if (isCleanView && !isAnnotating) return; // Disable selection in clean view
      onBackgroundClick?.();
    });

    const defs = svg.append('defs');
    const pattern = defs
      .append('pattern')
      .attr('id', 'dot-pattern')
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternUnits', 'userSpaceOnUse');

    pattern
      .append('circle')
      .attr('cx', 2)
      .attr('cy', 2)
      .attr('r', 1)
      .attr('fill', dotColor);
      
    // Glow filter for Clean View highlighting
    const filter = defs.append('filter')
        .attr('id', 'filter-glow')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');
    
    filter.append('feGaussianBlur')
        .attr('stdDeviation', '4')
        .attr('result', 'coloredBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    svg
      .style('background-color', bgColor)
      .style('background-image', 'url(#dot-pattern)');

    const { width, height } = dimensions;

    if (!data || data.length === 0) {
      const g = svg
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

      g.append('circle')
        .attr('r', 40)
        .attr('fill', rootNodeBgColor)
        .attr('stroke', secondaryTextColor)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .style('cursor', isCleanView ? 'default' : 'pointer')
        .on('click', (e) => {
          if (isCleanView) return;
          e.stopPropagation();
          onAddRoot && onAddRoot();
        });

      g.append('path')
        .attr('d', ICON_PATHS['domain'])
        .attr('transform', 'translate(-16, -16) scale(1.33)')
        .attr('fill', secondaryTextColor)
        .style('pointer-events', 'none');

      g.append('text')
        .attr('y', 60)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', secondaryTextColor)
        .text(t.addFirstNode);

      const genG = svg
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2 + 120})`);

      genG
        .append('rect')
        .attr('x', -80)
        .attr('y', -20)
        .attr('width', 160)
        .attr('height', 40)
        .attr('rx', 20)
        .attr('fill', 'transparent')
        .attr('stroke', secondaryTextColor)
        .attr('stroke-dasharray', '4,4')
        .style('cursor', isCleanView ? 'default' : 'pointer')
        .on('click', (e) => {
          if (isCleanView) return;
          e.stopPropagation();
          onAddGenerator && onAddGenerator();
        });

      genG
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('font-size', '12px')
        .style('fill', secondaryTextColor)
        .style('pointer-events', 'none')
        .text(t.addStandaloneGen);

      return;
    }

    const margin = { top: 100, right: 150, bottom: 100, left: 150 };

    ['arrow', 'circle', 'diamond'].forEach((type) => {
      const markerStart = defs
        .append('marker')
        .attr('id', `${type}-start`)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 5)
        .attr('refY', 5)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto-start-reverse');

      if (type === 'arrow')
        markerStart
          .append('path')
          .attr('d', 'M10,0 L0,5 L10,10 z')
          .attr('fill', 'context-stroke');
      else if (type === 'circle')
        markerStart
          .append('circle')
          .attr('cx', 5)
          .attr('cy', 5)
          .attr('r', 4)
          .attr('fill', 'context-stroke');
      else if (type === 'diamond')
        markerStart
          .append('path')
          .attr('d', 'M5,0 L10,5 L5,10 L0,5 z')
          .attr('fill', 'context-stroke');

      const markerEnd = defs
        .append('marker')
        .attr('id', `${type}-end`)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 5)
        .attr('refY', 5)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto');

      if (type === 'arrow')
        markerEnd
          .append('path')
          .attr('d', 'M0,0 L10,5 L0,10 z')
          .attr('fill', 'context-stroke');
      else if (type === 'circle')
        markerEnd
          .append('circle')
          .attr('cx', 5)
          .attr('cy', 5)
          .attr('r', 4)
          .attr('fill', 'context-stroke');
      else if (type === 'diamond')
        markerEnd
          .append('path')
          .attr('d', 'M5,0 L10,5 L5,10 L0,5 z')
          .attr('fill', 'context-stroke');
    });

    defs
      .append('marker')
      .attr('id', 'arrow-end-extra')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 5)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L10,5 L0,10 z')
      .attr('fill', isDark ? '#f59e0b' : '#d97706');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
          if (isAnnotating) return false;
          return !event.button && !event.ctrlKey;
      })
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    svg.call(zoom.transform, transformRef.current);

    const virtualRootData: ElectricalNode = {
      id: 'virtual-root',
      name: 'Virtual Root',
      type: ComponentType.SYSTEM_ROOT,
      children: data,
    };

    const root = d3.hierarchy<ElectricalNode>(virtualRootData);

    root.descendants().forEach((d: any) => {
      if (d.data.isCollapsed && d.children) {
        d._children = d.children;
        d.children = null;
      }
    });

    const tempText = svg
      .append('text')
      .style('font-size', '9px')
      .style('font-weight', 'bold')
      .style('visibility', 'hidden');

    const getNodeSize = (d: d3.HierarchyNode<ElectricalNode>) => {
      if (d.data.id === 'virtual-root') return { w: 1, h: 1 };

      // Shape override handling
      const isCircle = d.data.shape === 'circle';
      const isSquare = d.data.shape === 'square';

      if (isCircle || isSquare) {
        return { w: 80, h: 80 }; // Fixed size for simple shapes
      }

      const displayName = getTranslatedName(d.data.name, d.data.type);
      const compNum =
        d.data.componentNumber ||
        t.componentTypes[d.data.type] ||
        d.data.type;
      const model = d.data.model || '';
      const desc = getTranslatedDescription(d.data.description);

      let specText = '';
      if (d.data.amps) specText += `${d.data.amps}A`;
      if (d.data.voltage) specText += `${d.data.voltage}V`;
      if (d.data.kva) specText += `${d.data.kva}kVA`;

      const charWidth = 8.5;
      const nameLen = (displayName?.length || 0) * charWidth;
      const typeLen = (compNum?.length || 0) * 7.5;
      const specLen = specText.length * 7.5;
      const modelLen = model.length * 7;
      const descLen = Math.min(desc.length * 7, 220);

      let badgeWidth = 0;
      if (d.data.hasMeter) {
        tempText.text(d.data.meterNumber || '');
        const width = tempText.node()?.getComputedTextLength() || 0;
        const totalW = 20 + (d.data.meterNumber ? width + 6 : 0);
        badgeWidth += totalW;
      }
      if (d.data.hasGeneratorConnection) {
        tempText.text(d.data.generatorName || '');
        const width = tempText.node()?.getComputedTextLength() || 0;
        const totalW = 20 + (d.data.generatorName ? width + 6 : 0);
        badgeWidth += totalW;
      }
      // Add extra width for new badges (fixed approximate width as they are icon based)
      if (d.data.isExcludedFromMeter) badgeWidth += 24;
      if (d.data.isAirConditioning) badgeWidth += 24;
      if (d.data.isReserved) badgeWidth += 24;

      if (d.data.hasMeter && d.data.hasGeneratorConnection) badgeWidth += 5;

      const contentWidth = Math.max(
        nameLen,
        typeLen,
        specLen,
        modelLen,
        descLen,
        badgeWidth,
        90
      );
      const nodeW = contentWidth + 30;

      let contentHeight = 25;
      contentHeight += 24;
      contentHeight += 16;
      if (specText) contentHeight += 14;
      if (model) contentHeight += 14;
      if (desc) contentHeight += 14;
      // Adjust height if any badge is present
      if (d.data.hasMeter || d.data.hasGeneratorConnection || d.data.isExcludedFromMeter || d.data.isAirConditioning || d.data.isReserved) contentHeight += 26;
      contentHeight += 12;

      return { w: nodeW, h: contentHeight };
    };

    root.each((d: any) => {
      const size = getNodeSize(d);
      d.width = size.w;
      d.height = size.h;
    });

    const leafCount = root.leaves().length;
    const depthCount = root.height + 1;

    let treeLayout: d3.TreeLayout<ElectricalNode>;

    if (orientation === 'horizontal') {
      const depthSpacing = 350;
      const dynamicHeight = Math.max(height, leafCount * 140);
      const dynamicWidth = Math.max(width, depthCount * depthSpacing);

      treeLayout = d3
        .tree<ElectricalNode>()
        .size([dynamicHeight, dynamicWidth])
        .nodeSize([140, depthSpacing])
        .separation((a, b) => {
          const aH = (a as any).height || 100;
          const bH = (b as any).height || 100;
          const totalHeight = (aH + bH) / 2 + 20;
          return (totalHeight / 140) * (a.parent === b.parent ? 1 : 1.2);
        });
    } else {
      const depthSpacing = 300;
      const dynamicWidth = Math.max(width, leafCount * 200);
      const dynamicHeight = Math.max(height, depthCount * depthSpacing);
      treeLayout = d3
        .tree<ElectricalNode>()
        .size([dynamicWidth, dynamicHeight])
        .nodeSize([200, depthSpacing])
        .separation((a, b) => {
          const aW = (a as any).width || 120;
          const bW = (b as any).width || 120;
          const totalWidth = (aW + bW) / 2 + 20;
          return (totalWidth / 200) * (a.parent === b.parent ? 1 : 1.2);
        });
    }

    treeLayout(root);

    const nodesToRender = root
      .descendants()
      .filter((d) => d.depth > 0) as unknown as ExtendedHierarchyNode[];

    const linksToRender: DiagramLink[] = root
      .links()
      .filter((d) => d.source.data.id !== 'virtual-root')
      .map((d) => ({
        source: d.source as unknown as ExtendedHierarchyNode,
        target: d.target as unknown as ExtendedHierarchyNode,
      }));

    const getRectBox = (d: ExtendedHierarchyNode) => {
      const w = d.width;
      const h = d.height;
      if (orientation === 'horizontal') {
        return { x: 0, y: -h / 2, w, h };
      } else {
        return { x: -w / 2, y: 0, w, h };
      }
    };

    const linkGenerator = (source: ExtendedHierarchyNode, target: ExtendedHierarchyNode) => {
      const sXOffset = source.data.manualX || 0;
      const sYOffset = source.data.manualY || 0;
      const tXOffset = target.data.manualX || 0;
      const tYOffset = target.data.manualY || 0;

      if (orientation === 'horizontal') {
        const srcX = source.y + source.width + sXOffset;
        const srcY = source.x + sYOffset;
        const tgtX = target.y + tXOffset;
        const tgtY = target.x + tYOffset;
        return `M${srcX},${srcY} H${(srcX + tgtX) / 2} V${tgtY} H${tgtX}`;
      } else {
        const srcX = source.x + sXOffset;
        const srcY = source.y + source.height + sYOffset;
        const tgtX = target.x + tXOffset;
        const tgtY = target.y + tYOffset;
        return `M${srcX},${srcY} V${(srcY + tgtY) / 2} H${tgtX} V${tgtY}`;
      }
    };

    const extraLinksToRender: DiagramLink[] = [];
    const nodeLookup = new Map<string, ExtendedHierarchyNode>();
    nodesToRender.forEach((d) => nodeLookup.set(d.data.id, d));

    nodesToRender.forEach((d) => {
      if (d.data.extraConnections) {
        d.data.extraConnections.forEach((targetId) => {
          const targetNode = nodeLookup.get(targetId);
          if (targetNode) {
            extraLinksToRender.push({ source: targetNode, target: d });
          }
        });
      }
    });

    const linksGroup = g.append('g').attr('class', 'links');

    const drag = d3
      .drag<SVGGElement, ExtendedHierarchyNode>()
      .on('start', function (event, d) {
        if (isCleanView) return; // Disable drag in Clean View
        const node = d as ExtendedHierarchyNode;
        const descendants = node.descendants() as unknown as ExtendedHierarchyNode[];
        descendants.forEach((desc: ExtendedHierarchyNode) => {
          desc.__initialManualX = (desc as any).data.manualX || 0;
          desc.__initialManualY = (desc as any).data.manualY || 0;
        });
        d3.select(this).attr('data-is-dragging', 'false');
      })
      .on('drag', function (event, d) {
        if (isCleanView) return; // Disable drag in Clean View
        const node = d as ExtendedHierarchyNode;
        if (!node.__isDragging && event.dx * event.dx + event.dy * event.dy > 0) {
          node.__totalDx = (node.__totalDx || 0) + event.dx;
          node.__totalDy = (node.__totalDy || 0) + event.dy;
          if ((node.__totalDx ** 2 + node.__totalDy ** 2 > 16)) {
            node.__isDragging = true;
          }
        }

        if (node.__isDragging) {
          const descendants = node.descendants() as unknown as ExtendedHierarchyNode[];
          descendants.forEach((desc: ExtendedHierarchyNode) => {
            const currentX = ((desc as any).data.manualX || 0) + event.dx;
            const currentY = ((desc as any).data.manualY || 0) + event.dy;
            (desc as any).data.manualX = currentX;
            (desc as any).data.manualY = currentY;

            const el = g.select(`g.node[data-id="${(desc as any).data.id}"]`);
            const offsetX = (desc as any).data.manualX || 0;
            const offsetY = (desc as any).data.manualY || 0;

            if (orientation === 'horizontal') {
              el.attr(
                'transform',
                `translate(${desc.y + offsetX},${desc.x + offsetY})`
              );
            } else {
              el.attr(
                'transform',
                `translate(${desc.x + offsetX},${desc.y + offsetY})`
              );
            }
          });
        }
      })
      .on('end', function (event, d) {
        if (isCleanView) return; // Disable drag in Clean View
        const node = d as ExtendedHierarchyNode;
        if (node.__isDragging) {
          node.__isDragging = false;
          node.__totalDx = 0;
          node.__totalDy = 0;
          const updates: { id: string; x: number; y: number }[] = [];
          const descendants = node.descendants() as unknown as ExtendedHierarchyNode[];
          descendants.forEach((desc: ExtendedHierarchyNode) => {
            updates.push({
              id: (desc as any).data.id,
              x: (desc as any).data.manualX || 0,
              y: (desc as any).data.manualY || 0,
            });
          });
          if (onNodeMove) {
            onNodeMove(updates);
          }
        }
      });

    const renderLinks = (
      selection: d3.Selection<SVGPathElement, DiagramLink, SVGGElement, unknown>,
      className: string,
      isHitArea = false
    ) => {
      selection
        .attr('class', className)
        .attr('data-target-id', (d) => d.target.data.id)
        .attr('d', (d) => linkGenerator(d.source, d.target))
        .attr('fill', 'none')
        .each(function (d) {
          if (isHitArea) return;
          const style = d.target.data.connectionStyle || {};
          const stroke =
            style.strokeColor ||
            d.target.data.customColor ||
            COMPONENT_CONFIG[d.target.data.type]?.color ||
            linkColor;
          const isSelected = d.target.data.id === selectedLinkId;

          if (className === 'link-extra') {
            d3.select(this)
              .attr('stroke', isDark ? '#f59e0b' : '#d97706')
              .attr('stroke-width', 2.5)
              .attr('stroke-dasharray', '8,5')
              .attr('marker-end', 'url(#arrow-end-extra)')
              .attr('opacity', 0.8);
          } else {
            d3.select(this)
              .attr('stroke', stroke)
              .attr('stroke-width', isSelected ? 4 : 2.5)
              .attr(
                'stroke-dasharray',
                style.lineStyle === 'dashed'
                  ? '8,4'
                  : style.lineStyle === 'dotted'
                  ? '2,4'
                  : style.lineStyle === 'dash-dot'
                  ? '8,4,2,4'
                  : style.lineStyle === 'long-dash'
                  ? '16,4'
                  : 'none'
              )
              .attr(
                'marker-start',
                style.startMarker && style.startMarker !== 'none'
                  ? `url(#${style.startMarker}-start)`
                  : null
              )
              .attr(
                'marker-end',
                style.endMarker && style.endMarker !== 'none'
                  ? `url(#${style.endMarker}-end)`
                  : null
              )
              .style(
                'filter',
                isSelected
                  ? 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.3))'
                  : 'none'
              )
              .attr('opacity', () => {
                if (!searchMatches) return 0.8;
                const isMatch =
                  searchMatches.has(d.source.data.id) ||
                  searchMatches.has(d.target.data.id);
                return isMatch ? 1 : 0.1;
              });
          }
        });
    };

    const linkPathSelection = linksGroup
      .selectAll<SVGPathElement, DiagramLink>('path.link-visible')
      .data(linksToRender)
      .enter()
      .append('path')
      .call(renderLinks, 'link-visible');

    linksGroup
      .selectAll<SVGPathElement, DiagramLink>('path.link-extra')
      .data(extraLinksToRender)
      .enter()
      .append('path')
      .call(renderLinks, 'link-extra');

    linksGroup
      .selectAll<SVGPathElement, DiagramLink>('path.link-hit')
      .data(linksToRender)
      .enter()
      .append('path')
      .attr('class', 'link-hit')
      .attr('data-target-id', (d) => d.target.data.id)
      .attr('d', (d) => linkGenerator(d.source, d.target))
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 15)
      .style('cursor', 'pointer')
      .on('click', (e, d) => {
        if (isCleanView) return;
        e.stopPropagation();
        onLinkClick(d.source.data.id, d.target.data.id);
      });

    // 1. Render Nodes First (So they are behind labels)
    const nodes = g
      .selectAll<SVGGElement, ExtendedHierarchyNode>('g.node')
      .data(nodesToRender)
      .enter()
      .append('g')
      .attr('class', (d) =>
        `node group ${
          d.data.id === selectedNodeId || multiSelection.has(d.data.id)
            ? 'selected'
            : ''
        }`
      )
      .attr('data-id', (d) => d.data.id)
      .attr('transform', (d) => {
        const offsetX = d.data.manualX || 0;
        const offsetY = d.data.manualY || 0;
        return orientation === 'horizontal'
          ? `translate(${d.y + offsetX},${d.x + offsetY})`
          : `translate(${d.x + offsetX},${d.y + offsetY})`;
      })
      .call(drag as any)
      .on('click', function (event, d: ExtendedHierarchyNode) {
        if (isCleanView) {
            event.stopPropagation();
            return;
        }
        if (d.__isDragging) {
          event.stopPropagation();
          return;
        }
        if (event.defaultPrevented) return;
        event.stopPropagation();
        onNodeClick(d.data, event.shiftKey);
      })
      .on('mouseenter', function (event, d: ExtendedHierarchyNode) {
        if (isCleanView) {
            // Only allow interaction with collapse/expand in Clean View
            // But if it's permanent, we don't need to change opacity here
            // Just ensure pointer-events are all
            const el = d3.select(this as SVGGElement);
            el.select<SVGGElement>('.action-buttons')
                .style('pointer-events', 'all');
            return;
        }

        const isSelected =
          d.data.id === selectedNodeId || multiSelection.has(d.data.id);
        const isSource = d.data.id === connectionSourceId;
        const el = d3.select(this as SVGGElement);
        el.style('cursor', 'move');
        el.select<SVGGElement>('.action-buttons')
          .style('opacity', 1)
          .style('pointer-events', 'all');
        
        // Hover highlight color logic
        const hoverFill = isDark ? '#334155' : '#e2e8f0';
        el.select<SVGRectElement | SVGCircleElement>('.node-bg')
          .transition()
          .duration(200)
          .attr('fill', hoverFill)
          .attr(
            'stroke',
            isSource ? '#f59e0b' : isSelected ? '#3b82f6' : '#64748b'
          );
      })
      .on('mouseleave', function (event, d: ExtendedHierarchyNode) {
        const el = d3.select(this as SVGGElement);
        // Always hide action buttons on leave, unless selected (in normal mode)
        const isSelected =
          d.data.id === selectedNodeId || multiSelection.has(d.data.id);
        
        if (isCleanView) {
             // In Clean View, keep action buttons visible (permanent)
             return;
        }
        
        const isSource = d.data.id === connectionSourceId;

        if (!isSelected)
          el
            .select<SVGGElement>('.action-buttons')
            .style('opacity', 0)
            .style('pointer-events', 'none');
            
        // Revert fill color to custom or default
        el.select<SVGRectElement | SVGCircleElement>('.node-bg')
          .transition()
          .duration(200)
          .attr('fill', (d2: ExtendedHierarchyNode) =>
             d2.data.customBgColor || (d2.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor)
          )
          .attr(
            'stroke',
            isSource
              ? '#f59e0b'
              : isSelected
              ? '#3b82f6'
              : secondaryTextColor
          );
      })
      .style('cursor', () => isCleanView ? 'default' : 'move')
      .style('filter', (d) => {
          // Clean View Filter Highlight Logic
          if (isCleanView && activeFilters.size > 0) {
              const matches = 
                  (activeFilters.has('meter') && d.data.hasMeter) || 
                  (activeFilters.has('generator') && d.data.hasGeneratorConnection) ||
                  (activeFilters.has('no-meter') && d.data.isExcludedFromMeter) ||
                  (activeFilters.has('ac') && d.data.isAirConditioning) ||
                  (activeFilters.has('reserved') && d.data.isReserved) ||
                  (activeFilters.has(d.data.type));
                  
              if (matches) return 'url(#filter-glow)';
          }
          return null;
      })
      .style('opacity', (d) => {
        // Clean View Filter Dimming Logic
        if (isCleanView && activeFilters.size > 0) {
            const matches = 
                  (activeFilters.has('meter') && d.data.hasMeter) || 
                  (activeFilters.has('generator') && d.data.hasGeneratorConnection) ||
                  (activeFilters.has('no-meter') && d.data.isExcludedFromMeter) ||
                  (activeFilters.has('ac') && d.data.isAirConditioning) ||
                  (activeFilters.has('reserved') && d.data.isReserved) ||
                  (activeFilters.has(d.data.type));
            return matches ? 1 : 0.2;
        }

        if (!searchMatches) return 1;
        if (searchMatches.has(d.data.id)) return 1;
        if (
          d.parent &&
          d.parent.data.id !== 'virtual-root' &&
          searchMatches.has(d.parent.data.id)
        )
          return 1;
        if (d.children && d.children.some((c: any) => searchMatches.has(c.data.id)))
          return 1;
        if (
          (d as any)._children &&
          (d as any)._children.some((c: any) =>
            searchMatches.has(c.data.id)
          )
        )
          return 1;
        return 0.2;
      });

    // Node Shape Rendering Logic
    nodes.each(function (d: any) {
      const nodeG = d3.select(this as SVGGElement);
      const shape = d.data.shape || 'rectangle';
      const box = getRectBox(d);
      
      const fill = d.data.customBgColor || (d.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor);

      if (shape === 'circle') {
        nodeG
          .append('circle')
          .attr('class', 'node-bg')
          .attr('r', 40)
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('fill', fill)
          .attr('stroke', (dAny: any) => {
            if (dAny.data.id === connectionSourceId) return '#f59e0b';
            if (
              dAny.data.id === selectedNodeId ||
              multiSelection.has(dAny.data.id)
            )
              return '#3b82f6';
            return dAny.data.type === ComponentType.SYSTEM_ROOT
              ? '#64748b'
              : secondaryTextColor;
          })
          .attr('stroke-width', (dAny: any) =>
            dAny.data.id === selectedNodeId || multiSelection.has(dAny.data.id)
              ? 3
              : 1.5
          )
          .style('filter', (dAny: any) =>
            dAny.data.id === selectedNodeId || multiSelection.has(dAny.data.id)
              ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))'
              : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
          );
      } else if (shape === 'square') {
        nodeG
          .append('rect')
          .attr('class', 'node-bg')
          .attr('width', 80)
          .attr('height', 80)
          .attr('x', -40)
          .attr('y', -40)
          .attr('rx', 4)
          .attr('fill', fill)
          .attr('stroke', (dAny: any) => {
            if (dAny.data.id === connectionSourceId) return '#f59e0b';
            if (
              dAny.data.id === selectedNodeId ||
              multiSelection.has(dAny.data.id)
            )
              return '#3b82f6';
            return secondaryTextColor;
          })
          .attr('stroke-width', (dAny: any) =>
            dAny.data.id === selectedNodeId || multiSelection.has(dAny.data.id)
              ? 3
              : 1.5
          );
      } else {
        // Rectangle (Default)
        nodeG
          .append('rect')
          .attr('class', 'node-bg')
          .attr('width', box.w)
          .attr('height', box.h)
          .attr('x', box.x)
          .attr('y', box.y)
          .attr('rx', 12)
          .attr('fill', fill)
          .attr('stroke', (dAny: any) => {
            if (dAny.data.id === connectionSourceId) return '#f59e0b';
            if (
              dAny.data.id === selectedNodeId ||
              multiSelection.has(dAny.data.id)
            )
              return '#3b82f6';
            return dAny.data.type === ComponentType.SYSTEM_ROOT
              ? '#64748b'
              : secondaryTextColor;
          })
          .attr('stroke-width', (dAny: any) =>
            dAny.data.id === selectedNodeId ||
            multiSelection.has(dAny.data.id) ||
            dAny.data.id === connectionSourceId
              ? 3
              : 1.5
          )
          .style('filter', (dAny: any) =>
            dAny.data.id === selectedNodeId ||
            multiSelection.has(dAny.data.id) ||
            dAny.data.id === connectionSourceId
              ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))'
              : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
          );

        // Color Bar for Rectangle
        nodeG
          .append('path')
          .attr('d', (dAny: any) => {
            const r = 12;
            const box2 = getRectBox(dAny);
            return `M${box2.x},${box2.y + 6} v${-6 + r} a${r},${r} 0 0 1 ${r},${-r} h${
              box2.w - 2 * r
            } a${r},${r} 0 0 1 ${r},${r} v${6 - r}`;
          })
          .attr('fill', (dAny: ExtendedHierarchyNode) =>
            dAny.data.customColor ||
            COMPONENT_CONFIG[dAny.data.type]?.color ||
            '#94a3b8'
          );
      }
    });

    // Content Group (Icon + Text)
    const contentG = nodes
      .append('g')
      .attr('transform', (d) => {
        const shape = d.data.shape || 'rectangle';
        const box = getRectBox(d);
        if (shape === 'circle' || shape === 'square') {
          return `translate(0, 0)`;
        }
        if (orientation === 'horizontal')
          return `translate(${d.width / 2}, ${box.y + 25})`;
        else return `translate(0, ${box.y + 25})`;
      });

    // Icon / Custom Image
    contentG.each(function (d) {
      const el = d3.select(this as SVGGElement);
      const iconColor =
        d.data.customColor ||
        COMPONENT_CONFIG[d.data.type]?.color ||
        '#94a3b8';

      if (d.data.customImage) {
        // Render Custom Image
        el.append('image')
          .attr('xlink:href', d.data.customImage)
          .attr('x', -20)
          .attr('y', -20)
          .attr('width', 40)
          .attr('height', 40)
          .style('clip-path', 'circle(20px at center)');
      } else {
        // Render Standard Icon
        const shape = d.data.shape || 'rectangle';
        if (shape === 'rectangle') {
          el.append('circle')
            .attr('r', 16)
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('fill', isDark ? '#1e293b' : '#ffffff')
            .attr('stroke', iconColor)
            .attr('stroke-width', 1.5);
        }
        el.append('path')
          .attr(
            'd',
            ICON_PATHS[COMPONENT_CONFIG[d.data.type]?.icon] || ICON_PATHS['help']
          )
          .attr('transform', 'translate(-9, -9) scale(0.75)')
          .attr('fill', iconColor);
      }
    });

    // Text Labels
    contentG.each(function (d) {
      const el = d3.select(this as SVGGElement);
      const shape = d.data.shape || 'rectangle';

      if (shape === 'circle' || shape === 'square') {
        el.append('text')
          .attr('x', 0)
          .attr('y', 28)
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('font-weight', 'bold')
          .style('fill', textColor)
          .text(() => getTranslatedName(d.data.name, d.data.type));
      } else {
        // Full details for Rectangle
        el.append('text')
          .attr('x', 0)
          .attr('y', 32)
          .attr('text-anchor', 'middle')
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .style('fill', textColor)
          .text(() => getTranslatedName(d.data.name, d.data.type));

        el.append('text')
          .attr('x', 0)
          .attr('y', 48)
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('font-weight', 'bold')
          .style(
            'fill',
            () =>
              d.data.customColor ||
              COMPONENT_CONFIG[d.data.type]?.color ||
              '#94a3b8'
          )
          .style('opacity', 0.9)
          .text(
            () =>
              d.data.componentNumber ||
              t.componentTypes[d.data.type] ||
              d.data.type
          );

        el.append('text')
          .attr('x', 0)
          .attr('y', 62)
          .attr('text-anchor', 'middle')
          .style('font-size', '11px')
          .style('fill', secondaryTextColor)
          .text(() => {
            const specs: string[] = [];
            if (d.data.amps) specs.push(`${d.data.amps}A`);
            if (d.data.voltage) specs.push(`${d.data.voltage}V`);
            if (d.data.kva) specs.push(`${d.data.kva}kVA`);
            return specs.join(' | ');
          });

        let yOffset = 62;
        if (d.data.model) {
          yOffset += 14;
          el.append('text')
            .attr('x', 0)
            .attr('y', yOffset)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('font-style', 'italic')
            .style('fill', secondaryTextColor)
            .text(d.data.model);
        }
        const desc = getTranslatedDescription(d.data.description);
        if (desc) {
          yOffset += 14;
          el.append('text')
            .attr('x', 0)
            .attr('y', yOffset)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('fill', secondaryTextColor)
            .text(
              desc.length > 30 ? desc.substring(0, 28) + '...' : desc
            );
        }
      }
    });

    nodes
      .filter(
        (d) =>
          !!(d.data.isCollapsed && d._children && d._children.length > 0)
      )
      .append('circle')
      .attr('r', 8)
      .attr('cx', (d) => {
        const shape = d.data.shape || 'rectangle';
        return shape === 'rectangle'
          ? orientation === 'horizontal'
            ? d.width
            : 0
          : 35;
      })
      .attr('cy', (d) => {
        const shape = d.data.shape || 'rectangle';
        return shape === 'rectangle'
          ? orientation === 'horizontal'
            ? 0
            : d.height
          : 35;
      })
      .attr('fill', dotColor)
      .attr('stroke', secondaryTextColor)
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .style('pointer-events', 'all') // Allow clicking to expand in Clean View
      .on('click', function(e, d) {
          e.stopPropagation();
          onToggleCollapse(d.data);
      });

    nodes
      .filter(
        (d) =>
          !!(d.data.isCollapsed && d._children && d._children.length > 0)
      )
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('x', (d) => {
        const shape = d.data.shape || 'rectangle';
        return shape === 'rectangle'
          ? orientation === 'horizontal'
            ? d.width
            : 0
          : 35;
      })
      .attr('y', (d) => {
        const shape = d.data.shape || 'rectangle';
        return shape === 'rectangle'
          ? orientation === 'horizontal'
            ? 0
            : d.height
          : 35;
      })
      .attr('fill', secondaryTextColor)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text('+');

    const getBadgeBaseY = (d: ExtendedHierarchyNode) => {
      if (d.data.shape && d.data.shape !== 'rectangle') return 35;
      const box = getRectBox(d);
      return box.y + box.h - 24;
    };

    // Helper to render badges
    const renderBadge = (
        gNode: d3.Selection<SVGGElement, unknown, null, undefined>, 
        textValue: string, 
        iconPath: string, 
        color: string, 
        bgColorLight: string, 
        bgColorDark: string, 
        d: ExtendedHierarchyNode,
        xOffset: number
    ) => {
        const group = gNode.append('g');
        
        const text = group
          .append('text')
          .attr('y', 9)
          .attr('dominant-baseline', 'central')
          .style('font-size', '9px')
          .style('font-weight', 'bold')
          .style('fill', color)
          .style('direction', 'ltr')
          .text(textValue || '');

        const textLen = text.node()?.getComputedTextLength() || 0;
        const totalWidth = 20 + (textValue ? textLen + 6 : 0);

        text.attr('x', 20);

        group
          .insert('rect', 'text')
          .attr('height', 18)
          .attr('width', totalWidth)
          .attr('rx', 9)
          .attr('fill', isDark ? bgColorDark : bgColorLight)
          .attr('stroke', color)
          .attr('stroke-width', 0.5);

        group
          .append('path')
          .attr('d', iconPath)
          .attr('transform', 'translate(3, 3) scale(0.5)')
          .attr('fill', color);
        
        if (d.data.shape && d.data.shape !== 'rectangle') {
             // For circle/square, stack or position manually if multiple
             // This is simplified, just placing them roughly
             group.attr('transform', `translate(${xOffset}, -35)`);
        } else {
             const box = getRectBox(d);
             const y = getBadgeBaseY(d);
             // Position from left + offset
             group.attr('transform', `translate(${box.x + 8 + xOffset}, ${y})`);
        }
        
        return totalWidth;
    };


    nodes.each(function(d: any) {
        const gNode = d3.select(this as SVGGElement);
        let currentXOffset = 0;

        // 1. Meter Badge
        if (d.data.hasMeter) {
            const w = renderBadge(
                gNode, d.data.meterNumber || '', ICON_PATHS['speed'], 
                '#3b82f6', '#dbeafe', '#1e3a8a', d, currentXOffset
            );
            currentXOffset += w + 5;
        }

        // 2. Generator Badge
        if (d.data.hasGeneratorConnection) {
            const w = renderBadge(
                gNode, d.data.generatorName || '', ICON_PATHS['letter_g'], 
                '#ef4444', '#fee2e2', '#7f1d1d', d, currentXOffset
            );
            currentXOffset += w + 5;
        }

        // 3. No Meter Badge
        if (d.data.isExcludedFromMeter) {
             const w = renderBadge(
                gNode, '', ICON_PATHS['power_off'],
                '#64748b', '#f1f5f9', '#334155', d, currentXOffset
            );
            currentXOffset += w + 5;
        }

        // 4. A/C Badge
        if (d.data.isAirConditioning) {
             const w = renderBadge(
                gNode, '', ICON_PATHS['ac_unit'],
                '#06b6d4', '#cffafe', '#155e75', d, currentXOffset
            );
            currentXOffset += w + 5;
        }

        // 5. Reserved Badge
        if (d.data.isReserved) {
             const w = renderBadge(
                gNode, '', ICON_PATHS['lock'],
                '#eab308', '#fef9c3', '#713f12', d, currentXOffset
            );
            currentXOffset += w + 5;
        }
    });


    // Calculated Load Badge
    nodes
      .filter((d) => d.data.calculatedLoad && (d.data.calculatedLoad.amps > 0 || d.data.calculatedLoad.kva > 0))
      .append('g')
      .each(function(d: any) {
          const gNode = d3.select(this as SVGGElement);
          const load = d.data.calculatedLoad!;
          const textVal = `∑ ${load.amps}A`;

          const text = gNode.append('text')
              .attr('y', -8)
              .attr('text-anchor', 'middle')
              .style('font-size', '10px')
              .style('font-weight', 'bold')
              .style('fill', '#a855f7')
              .text(textVal);
          
          const textLen = text.node()?.getComputedTextLength() || 0;
          const w = textLen + 8;
          
          gNode.insert('rect', 'text')
              .attr('x', -w/2)
              .attr('y', -18)
              .attr('width', w)
              .attr('height', 14)
              .attr('rx', 4)
              .attr('fill', isDark ? '#3b0764' : '#f3e8ff')
              .attr('stroke', '#a855f7')
              .attr('stroke-width', 1);

          if (d.data.shape === 'circle' || d.data.shape === 'square') {
               gNode.attr('transform', `translate(0, -45)`);
          } else {
              const box = getRectBox(d);
              gNode.attr('transform', `translate(${box.x + box.w/2}, ${box.y})`);
          }
      });

    // Action buttons (Conditional based on Clean View)
    nodes
      .append('g')
      .attr('class', 'action-buttons')
      .attr('transform', (d) => {
        if (d.data.shape === 'circle' || d.data.shape === 'square') {
          return `translate(50, 0)`;
        }
        const box = getRectBox(d);
        return `translate(${box.x + box.w + 12}, ${box.y + box.h / 2})`;
      })
      .style('opacity', (d) => {
        // In Clean View, keep action buttons (collapse icon) always visible
        if (isCleanView) return 1;
        return d.data.id === selectedNodeId ? 1 : 0;
      })
      .style('pointer-events', (d) => {
        // In Clean View, keep action buttons clickable
        if (isCleanView) return 'all';
        return d.data.id === selectedNodeId ? 'all' : 'none';
      })
      .style('transition', 'opacity 0.2s')
      .call((gSel) => {
        
        // Add Button (Hide in Clean View)
        if (!isCleanView) {
            gSel
              .append('g')
              .attr('transform', 'translate(0, -28)')
              .style('cursor', 'pointer')
              .on('click', (e, d) => {
                e.stopPropagation();
                onDuplicateChild(d.data);
              })
              .call((btn) => {
                btn
                  .append('circle')
                  .attr('r', 10)
                  .attr('fill', '#2563eb')
                  .attr('stroke', '#1e40af')
                  .attr('stroke-width', 1);
                btn
                  .append('path')
                  .attr('d', ICON_PATHS['add'])
                  .attr('transform', 'translate(-8, -8) scale(0.66)')
                  .attr('fill', 'white');
                btn.append('title').text(t.inputPanel.addConnection);
              });
        }

        // Collapse/Expand Button (Show in Clean View)
        gSel
          .filter(
            (d: any) =>
              (d.children && d.children.length > 0) ||
              (d._children && d._children.length > 0)
          )
          .append('g')
          .attr('transform', 'translate(0, 0)')
          .style('cursor', 'pointer')
          .on('click', (e, d) => {
            e.stopPropagation();
            onToggleCollapse(d.data);
          })
          .call((btn) => {
            btn
              .append('circle')
              .attr('r', 10)
              .attr('fill', '#475569')
              .attr('stroke', '#334155')
              .attr('stroke-width', 1);
            btn
              .append('path')
              .attr('d', (dAny: any) =>
                ICON_PATHS[
                  dAny.data.isCollapsed ? 'visibility_off' : 'visibility'
                ]
              )
              .attr('transform', 'translate(-8, -8) scale(0.66)')
              .attr('fill', 'white');
            btn.append('title').text((dAny: any) =>
              dAny.data.isCollapsed
                ? t.inputPanel.expand
                : t.inputPanel.collapse
            );
          });

        // Group Button (Hide in Clean View)
        if (!isCleanView) {
            gSel
              .filter((d: any) => d.depth > 1)
              .append('g')
              .attr('transform', 'translate(0, 28)')
              .style('cursor', 'pointer')
              .on('click', (e, d) => {
                e.stopPropagation();
                onGroupNode(d.data);
              })
              .call((btn) => {
                btn
                  .append('circle')
                  .attr('r', 10)
                  .attr('fill', '#eab308')
                  .attr('stroke', '#ca8a04')
                  .attr('stroke-width', 1);
                btn
                  .append('path')
                  .attr('d', ICON_PATHS['folder_open'])
                  .attr('transform', 'translate(-8, -8) scale(0.66)')
                  .attr('fill', 'white');
                btn.append('title').text(t.inputPanel.groupNode);
              });

            // Delete Button (Hide in Clean View)
            gSel
              .append('g')
              .attr('transform', 'translate(0, 56)')
              .style('cursor', 'pointer')
              .on('click', (e, d) => {
                e.stopPropagation();
                onDeleteNode(d.data);
              })
              .call((btn) => {
                btn
                  .append('circle')
                  .attr('r', 10)
                  .attr('fill', '#ef4444')
                  .attr('stroke', '#b91c1c')
                  .attr('stroke-width', 1);
                btn
                  .append('path')
                  .attr('d', ICON_PATHS['delete'])
                  .attr('transform', 'translate(-8, -8) scale(0.66)')
                  .attr('fill', 'white');
                btn.append('title').text(t.inputPanel.deleteComponent);
              });
        }
      });

    // 2. Labels group
    const labelsGroup = g.append('g').attr('class', 'labels');

    // Cable size labels
    linksToRender.forEach((link) => {
      const targetNode = link.target;
      const targetData = targetNode.data;

      if (targetData.connectionStyle?.cableSize) {
        const source = link.source;
        const sData = source.data;
        const tData = targetData;

        const sXOffset = sData.manualX || 0;
        const sYOffset = sData.manualY || 0;
        const tXOffset = tData.manualX || 0;
        const tYOffset = tData.manualY || 0;

        let srcX: number;
        let srcY: number;
        let tgtX: number;
        let tgtY: number;

        if (orientation === 'horizontal') {
          srcX = source.y + source.width + sXOffset;
          srcY = source.x + sYOffset;
          tgtX = targetNode.y + tXOffset;
          tgtY = targetNode.x + tYOffset;
        } else {
          srcX = source.x + sXOffset;
          srcY = source.y + source.height + sYOffset;
          tgtX = targetNode.x + tXOffset;
          tgtY = targetNode.y + tYOffset;
        }

        let labelX: number;
        let labelY: number;
        let rotation = 0;
        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        const offset = 25;

        if (orientation === 'horizontal') {
          labelX = tgtX - offset;
          labelY = tgtY;
          rotation = 0;
          textAnchor = isRTL ? 'start' : 'end';
        } else {
          labelX = tgtX;
          labelY = tgtY - offset;
          rotation = -90;
          textAnchor = isRTL ? 'end' : 'start';
        }

        if (!isNaN(labelX) && !isNaN(labelY)) {
          const labelGroup = labelsGroup
            .append('g')
            .attr(
              'transform',
              `translate(${labelX}, ${labelY}) rotate(${rotation})`
            )
            .style('pointer-events', 'none');

          const style = targetData.connectionStyle || {};
          const linkStroke =
            style.strokeColor ||
            targetData.customColor ||
            COMPONENT_CONFIG[targetData.type]?.color ||
            linkColor;

          const bgRect = labelGroup
            .append('rect')
            .attr('rx', 4)
            .attr('fill', linkStroke)
            .attr('stroke', isDark ? '#ffffff' : 'none')
            .attr('stroke-width', 1)
            .attr('opacity', 1);

          const text = labelGroup
            .append('text')
            .attr('text-anchor', textAnchor)
            .attr('dominant-baseline', 'middle')
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .style('fill', '#ffffff')
            .text(targetData.connectionStyle.cableSize);

          const bbox = text.node()?.getBBox();
          if (bbox) {
            const padding = 3;
            bgRect
              .attr('x', bbox.x - padding)
              .attr('y', bbox.y - padding)
              .attr('width', bbox.width + padding * 2)
              .attr('height', bbox.height + padding * 2);
          }
        }
      }
    });

    // 3. Annotations Layer (Always on top)
    const annotationGroup = g.append('g').attr('class', 'annotations-layer');
    
    // Render existing annotations
    if (annotations) {
        annotations.forEach(a => {
            annotationGroup.append('path')
                .attr('d', a.path)
                .attr('stroke', a.color)
                .attr('stroke-width', 3)
                .attr('fill', 'none')
                .attr('stroke-linecap', 'round')
                .attr('stroke-linejoin', 'round')
                .attr('opacity', 0.8);
        });
    }

    // Annotation Interaction
    if (isAnnotating && isCleanView) {
        // Overlay for capturing draw events
        const overlay = g.append('rect')
           .attr('width', '40000') // Huge rect to cover everything
           .attr('height', '40000')
           .attr('x', -20000)
           .attr('y', -20000)
           .attr('fill', 'transparent')
           .style('cursor', 'crosshair');

        let currentPathString = "";
        let currentPathElement: SVGPathElement | null = null;

        const drawDrag = d3.drag<SVGRectElement, unknown>()
            .container(function() { return this; })
            .on('start', (event) => {
                 currentPathString = `M ${event.x} ${event.y}`;
                 // Render temporary path
                 currentPathElement = annotationGroup.append('path')
                    .attr('d', currentPathString)
                    .attr('stroke', annotationColor || 'red')
                    .attr('stroke-width', 3)
                    .attr('fill', 'none')
                    .attr('stroke-linecap', 'round')
                    .attr('stroke-linejoin', 'round')
                    .node();
            })
            .on('drag', (event) => {
                 if (currentPathElement) {
                     currentPathString += ` L ${event.x} ${event.y}`;
                     d3.select(currentPathElement).attr('d', currentPathString);
                 }
            })
            .on('end', () => {
                 if (currentPathString && onAnnotationAdd) {
                     // Pass back to React state, which triggers re-render
                     // This will clear the temp path but the new state will render it via the 'annotations' loop above
                     onAnnotationAdd(currentPathString, annotationColor || 'red');
                 }
                 currentPathElement = null;
                 currentPathString = "";
            });

        overlay.call(drawDrag);
    }


    // Dynamic content bounds
    let maxY = 600;
    let maxX = 800;
    let minX = 0;
    let minY = 0;

    nodesToRender.forEach((d) => {
      const box = getRectBox(d);
      const offsetX = d.data.manualX || 0;
      const offsetY = d.data.manualY || 0;
      let absoluteX: number;
      let absoluteY: number;
      if (orientation === 'horizontal') {
        absoluteX = d.y + offsetX;
        absoluteY = d.x + offsetY;
      } else {
        absoluteX = d.x + offsetX;
        absoluteY = d.y + offsetY;
      }
      const left = absoluteX + box.x;
      const right = absoluteX + box.x + box.w;
      const top = absoluteY + box.y;
      const bottom = absoluteY + box.y + box.h;
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
    });

    maxX = Math.max(maxX, 800);
    maxY = Math.max(maxY, 600);

    // Print layout title block
    if (isPrintMode && activeProject) {
      const metadata = activeProject.printMetadata || DEFAULT_PRINT_METADATA;
      const blockW = 500;
      const blockH = 100;
      const xStart = maxX + 40;
      const yStart = maxY + 40 - blockH;

      const titleBlock = g
        .append('g')
        .attr('transform', `translate(${xStart}, ${yStart})`)
        .style('cursor', 'pointer');

      titleBlock
        .append('rect')
        .attr('width', blockW)
        .attr('height', blockH)
        .attr('fill', isDark ? '#1e293b' : '#ffffff')
        .attr('fill-opacity', 0.8)
        .attr('stroke', textColor)
        .attr('stroke-width', 2)
        .style('pointer-events', isCleanView ? 'none' : 'all') // Disable interactions in clean view
        .on('click', function (e) {
          if (isCleanView) return;
          if ((e as any).defaultPrevented) return;
          e.stopPropagation();
          if (onEditPrintSettings) onEditPrintSettings();
        });

      const dividerX = isRTL ? blockW * 0.35 : blockW * 0.65;
      const rowH = blockH / 3;

      titleBlock
        .append('line')
        .attr('x1', dividerX)
        .attr('y1', 0)
        .attr('x2', dividerX)
        .attr('y2', blockH)
        .attr('stroke', textColor)
        .attr('stroke-width', 1)
        .style('pointer-events', 'none');

      titleBlock
        .append('line')
        .attr('x1', 0)
        .attr('y1', rowH)
        .attr('x2', blockW)
        .attr('y2', rowH)
        .attr('stroke', textColor)
        .attr('stroke-width', 1)
        .style('pointer-events', 'none');

      titleBlock
        .append('line')
        .attr('x1', 0)
        .attr('y1', rowH * 2)
        .attr('x2', blockW)
        .attr('y2', rowH * 2)
        .attr('stroke', textColor)
        .attr('stroke-width', 1)
        .style('pointer-events', 'none');

      let wideColX: number;
      let narrowColX: number;

      if (isRTL) {
        narrowColX = dividerX / 2;
        wideColX = dividerX + (blockW - dividerX) / 2;
      } else {
        wideColX = dividerX / 2;
        narrowColX = dividerX + (blockW - dividerX) / 2;
      }

      const renderCell = (
        label: string,
        value: string,
        cx: number,
        cy: number,
        fieldKey: string
      ) => {
        const isWideField =
          fieldKey === 'projectName' ||
          fieldKey === 'organization' ||
          fieldKey === 'engineer';

        const cellW = isWideField
          ? isRTL
            ? blockW - dividerX
            : dividerX
          : isRTL
          ? dividerX
          : blockW - dividerX;

        let rx = 0;
        if (isRTL) {
          rx = isWideField ? dividerX : 0;
        } else {
          rx = isWideField ? 0 : dividerX;
        }

        titleBlock
          .append('rect')
          .attr('x', rx)
          .attr('y', cy - 10)
          .attr('width', cellW)
          .attr('height', rowH)
          .attr('fill', 'white')
          .attr('fill-opacity', 0.01)
          .style('cursor', 'pointer')
          .style('pointer-events', isCleanView ? 'none' : 'all') // Disable interactions in clean view
          .on('click', (e) => {
            if (isCleanView) return;
            if ((e as any).defaultPrevented) return;
            e.stopPropagation();
            if (onEditPrintSettings) onEditPrintSettings(fieldKey);
          })
          .append('title')
          .text(`Edit ${label}`);

        titleBlock
          .append('text')
          .attr('x', cx)
          .attr('y', cy)
          .text(label)
          .attr('fill', textColor)
          .attr('font-size', '9px')
          .attr('font-weight', 'bold')
          .attr('text-anchor', 'middle')
          .style('opacity', 0.7)
          .style('pointer-events', 'none');

        titleBlock
          .append('text')
          .attr('x', cx)
          .attr('y', cy + 14)
          .text(value)
          .attr('fill', textColor)
          .attr('font-size', '13px')
          .attr('text-anchor', 'middle')
          .style('pointer-events', 'none');
      };

      const yOffset = 10;

      renderCell(t.printLayout.project, activeProject.name, wideColX, yOffset, 'projectName');
      renderCell(t.printLayout.date, metadata.date, narrowColX, yOffset, 'date');

      renderCell(
        t.printLayout.org,
        metadata.organization,
        wideColX,
        rowH + yOffset,
        'organization'
      );
      renderCell(
        t.printLayout.rev,
        metadata.revision,
        narrowColX,
        rowH + yOffset,
        'revision'
      );

      renderCell(
        t.printLayout.engineer,
        metadata.engineer,
        wideColX,
        rowH * 2 + yOffset,
        'engineer'
      );
      renderCell(
        t.printLayout.approved,
        metadata.approvedBy,
        narrowColX,
        rowH * 2 + yOffset,
        'approvedBy'
      );

      if (!isCleanView) {
        titleBlock
            .on('mouseenter', function () {
            d3.select(this as SVGGElement)
                .select('rect')
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', 3);
            })
            .on('mouseleave', function () {
            d3.select(this as SVGGElement)
                .select('rect')
                .attr('stroke', textColor)
                .attr('stroke-width', 2);
            });
      }
    }

    // Legend
    const types = Object.values(ComponentType);
    const badgeItems = [
      { label: t.legend.meter, icon: 'speed', color: '#3b82f6' },
      { label: t.legend.generator, icon: 'letter_g', color: '#ef4444' },
      { label: t.legend.noMeter, icon: 'power_off', color: '#64748b' },
      { label: t.legend.ac, icon: 'ac_unit', color: '#06b6d4' },
      { label: t.legend.reserved, icon: 'lock', color: '#eab308' }
    ];

    const totalLegendItems = types.length + badgeItems.length + 1; // +1 for spacing/separator
    const legendW = 200;
    const legendH = 50 + totalLegendItems * 25;

    let legX: number;
    let legY: number;

    if (isPrintMode && activeProject) {
      const blockW = 500;
      const blockH = 100;
      const xStart = maxX + 40;
      const yStart = maxY + 40 - blockH;
      legX = xStart + blockW - legendW;
      legY = yStart - legendH - 10;
    } else {
      legX = maxX + 50;
      legY = minY;
    }

    const legendG = g
      .append('g')
      .attr('class', 'legend-group')
      .attr('transform', `translate(${legX}, ${legY})`);

    legendG
      .append('rect')
      .attr('width', legendW)
      .attr('height', legendH)
      .attr('rx', 8)
      .attr('fill', isDark ? '#1e293b' : '#ffffff')
      .attr('stroke', secondaryTextColor)
      .attr('stroke-width', 1)
      .attr('opacity', 0.95);

    legendG
      .append('text')
      .attr('x', legendW / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .attr('font-weight', 'bold')
      .attr('fill', textColor)
      .attr('font-size', '12px')
      .text(t.legend.title);

    // Render Components
    types.forEach((type, i) => {
      const y = 50 + i * 25;
      const config = COMPONENT_CONFIG[type];

      let iconX: number;
      let textX: number;
      let textAnchor: 'start' | 'middle' | 'end';

      if (isRTL) {
        iconX = legendW - 25;
        textX = legendW / 2;
        textAnchor = 'middle';
      } else {
        iconX = 25;
        textX = 45;
        textAnchor = 'start';
      }

      legendG
        .append('circle')
        .attr('cx', iconX)
        .attr('cy', y)
        .attr('r', 8)
        .attr('fill', isDark ? '#0f172a' : '#f8fafc')
        .attr('stroke', config.color)
        .attr('stroke-width', 1.5);

      legendG
        .append('path')
        .attr('d', ICON_PATHS[config.icon])
        .attr('transform', `translate(${iconX - 6}, ${y - 6}) scale(0.5)`)
        .attr('fill', config.color);

      legendG
        .append('text')
        .attr('x', textX)
        .attr('y', y)
        .attr('dominant-baseline', 'middle')
        .attr('fill', textColor)
        .attr('font-size', '11px')
        .attr('text-anchor', textAnchor)
        .text(t.componentTypes[type]);
    });

    // Separator line
    const sepY = 50 + types.length * 25 + 10;
    legendG.append('line')
       .attr('x1', 20)
       .attr('y1', sepY)
       .attr('x2', legendW - 20)
       .attr('y2', sepY)
       .attr('stroke', secondaryTextColor)
       .attr('stroke-width', 1)
       .attr('opacity', 0.5);

    // Render Status Badges
    badgeItems.forEach((item, i) => {
        const y = sepY + 20 + i * 25;
        let iconX: number;
        let textX: number;
        let textAnchor: 'start' | 'middle' | 'end';

        if (isRTL) {
            iconX = legendW - 25;
            textX = legendW / 2;
            textAnchor = 'middle';
        } else {
            iconX = 25;
            textX = 45;
            textAnchor = 'start';
        }

        // Mimic badge style
        legendG.append('rect')
            .attr('x', iconX - 10)
            .attr('y', y - 9)
            .attr('width', 20)
            .attr('height', 18)
            .attr('rx', 9)
            .attr('fill', isDark ? '#1e293b' : '#f1f5f9')
            .attr('stroke', item.color)
            .attr('stroke-width', 0.5);

        legendG.append('path')
            .attr('d', ICON_PATHS[item.icon])
            .attr('transform', `translate(${iconX - 6}, ${y - 6}) scale(0.5)`)
            .attr('fill', item.color);

        legendG
            .append('text')
            .attr('x', textX)
            .attr('y', y)
            .attr('dominant-baseline', 'middle')
            .attr('fill', textColor)
            .attr('font-size', '11px')
            .attr('text-anchor', textAnchor)
            .text(item.label);
    });

  }, [
    data,
    dimensions,
    onNodeClick,
    onLinkClick,
    selectedNodeId,
    selectedLinkId,
    orientation,
    searchMatches,
    isConnectMode,
    connectionSourceId,
    t,
    language,
    theme,
    onBackgroundClick,
    multiSelection,
    isPrintMode,
    activeProject,
    onEditPrintSettings,
    onAddRoot,
    onAddGenerator,
    onDuplicateChild,
    onDeleteNode,
    onToggleCollapse,
    onGroupNode,
    onNodeMove,
    onDisconnectLink,
    isCleanView,
    activeFilters,
    annotations,
    isAnnotating,
    annotationColor
  ]);

  return (
    <div
      ref={wrapperRef}
      className={`w-full h-full relative overflow-hidden ${
        isDark ? 'bg-slate-900' : 'bg-white'
      }`}
      style={{ touchAction: 'none' }}
    >
      <svg
        id="diagram-svg"
        ref={svgRef}
        width="100%"
        height="100%"
        className="block"
      />
    </div>
  );
};