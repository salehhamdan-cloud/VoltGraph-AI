
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ElectricalNode, ComponentType, Project } from '../types';
import { COMPONENT_CONFIG, ICON_PATHS, SNAP_GRID_SIZE } from '../constants';

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
  isLayoutLocked?: boolean;
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
  onAnnotationAdd,
  isLayoutLocked = false
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

    svg.on('click', (event) => {
      if (event.defaultPrevented) return;
      if (isCleanView && !isAnnotating) return;
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

    if (isAnnotating) {
        svg.style('cursor', 'crosshair');
        svg.append('rect')
           .attr('width', '100%')
           .attr('height', '100%')
           .attr('fill', 'transparent')
           .on('mousedown', function(event) {
               const coords = d3.pointer(event, g.node());
               let currentPath = `M ${coords[0]} ${coords[1]}`;
               
               const pathEl = g.append('path')
                   .attr('class', 'temp-drawing')
                   .attr('d', currentPath)
                   .attr('stroke', annotationColor)
                   .attr('stroke-width', 3)
                   .attr('fill', 'none')
                   .attr('stroke-linecap', 'round')
                   .attr('stroke-linejoin', 'round');

               d3.select(this)
                   .on('mousemove', (e) => {
                       const m = d3.pointer(e, g.node());
                       currentPath += ` L ${m[0]} ${m[1]}`;
                       pathEl.attr('d', currentPath);
                   })
                   .on('mouseup', () => {
                       d3.select(this).on('mousemove', null).on('mouseup', null);
                       if (onAnnotationAdd) onAnnotationAdd(currentPath, annotationColor);
                       pathEl.remove();
                   });
           });
    }

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
        .attr('d', "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z")
        .attr('transform', 'translate(-16, -16) scale(1.33)')
        .attr('fill', secondaryTextColor)
        .style('pointer-events', 'none');

      g.append('text')
        .attr('y', 60)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', secondaryTextColor)
        .text(t.addFirstNode);

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
        markerStart.append('path').attr('d', 'M10,0 L0,5 L10,10 z').attr('fill', 'context-stroke');
      else if (type === 'circle')
        markerStart.append('circle').attr('cx', 5).attr('cy', 5).attr('r', 4).attr('fill', 'context-stroke');
      else if (type === 'diamond')
        markerStart.append('path').attr('d', 'M5,0 L10,5 L5,10 L0,5 z').attr('fill', 'context-stroke');

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
        markerEnd.append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', 'context-stroke');
      else if (type === 'circle')
        markerEnd.append('circle').attr('cx', 5).attr('cy', 5).attr('r', 4).attr('fill', 'context-stroke');
      else if (type === 'diamond')
        markerEnd.append('path').attr('d', 'M5,0 L10,5 L5,10 L0,5 z').attr('fill', 'context-stroke');
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

      const isCircle = d.data.shape === 'circle';
      const isSquare = d.data.shape === 'square';

      if (isCircle || isSquare) {
        return { w: 80, h: 80 }; 
      }

      const displayName = getTranslatedName(d.data.name, d.data.type);
      const compNum = d.data.componentNumber || t.componentTypes[d.data.type] || d.data.type;
      const model = d.data.model || '';
      const desc = getTranslatedDescription(d.data.description);
      
      const descLines = desc.length > 25 ? Math.ceil(desc.length / 25) : 1;
      const descLen = Math.min(desc.length * 7, 220);

      let specText = '';
      if (d.data.amps) specText += `${d.data.amps}A`;
      if (d.data.voltage) specText += `${d.data.voltage}V`;
      if (d.data.kva) specText += `${d.data.kva}kVA`;

      const charWidth = 8.5;
      const nameLen = (displayName?.length || 0) * charWidth;
      const typeLen = (compNum?.length || 0) * 7.5;
      const specLen = specText.length * 7.5;
      const modelLen = model.length * 7;
      
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
      if (desc) contentHeight += (14 * descLines); 
      
      if (d.data.place || d.data.building || d.data.floor) {
          contentHeight += 14;
      }

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
      const lineType = target.data.connectionStyle?.lineType || 'orthogonal';

      if (orientation === 'horizontal') {
        const srcX = source.y + source.width + sXOffset;
        const srcY = source.x + sYOffset;
        const tgtX = target.y + tXOffset;
        const tgtY = target.x + tYOffset;

        if (lineType === 'straight') {
            return `M${srcX},${srcY} L${tgtX},${tgtY}`;
        } else {
            return `M${srcX},${srcY} H${(srcX + tgtX) / 2} V${tgtY} H${tgtX}`;
        }
      } else {
        const srcX = source.x + sXOffset;
        const srcY = source.y + source.height + sYOffset;
        const tgtX = target.x + tXOffset;
        const tgtY = target.y + tYOffset;

        if (lineType === 'straight') {
            return `M${srcX},${srcY} L${tgtX},${tgtY}`;
        } else {
            return `M${srcX},${srcY} V${(srcY + tgtY) / 2} H${tgtX} V${tgtY}`;
        }
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

    if (annotations.length > 0) {
        annotations.forEach(ant => {
            g.append('path')
             .attr('d', ant.path)
             .attr('stroke', ant.color)
             .attr('stroke-width', 3)
             .attr('fill', 'none')
             .attr('stroke-linecap', 'round')
             .attr('stroke-linejoin', 'round')
             .attr('opacity', 0.8);
        });
    }

    const linksGroup = g.append('g').attr('class', 'links');
    const nodesGroup = g.append('g').attr('class', 'nodes');
    const labelsGroup = g.append('g').attr('class', 'labels');

    const drag = d3
      .drag<SVGGElement, ExtendedHierarchyNode>()
      .filter((event) => !isLayoutLocked && !event.button) 
      .on('start', function (event, d) {
        if (isCleanView) return; 
        const node = d as ExtendedHierarchyNode;
        const descendants = node.descendants() as unknown as ExtendedHierarchyNode[];
        
        descendants.forEach((desc: ExtendedHierarchyNode) => {
          desc.__initialManualX = desc.data.manualX || 0;
          desc.__initialManualY = desc.data.manualY || 0;
          desc.__totalDx = 0;
          desc.__totalDy = 0;
        });
        
        d3.select(this).raise();
      })
      .on('drag', function (event, d) {
        if (isCleanView) return; 
        const node = d as ExtendedHierarchyNode;
        
        node.__totalDx = (node.__totalDx || 0) + event.dx;
        node.__totalDy = (node.__totalDy || 0) + event.dy;

        const descendants = node.descendants() as unknown as ExtendedHierarchyNode[];
        descendants.forEach((desc: ExtendedHierarchyNode) => {
          const rawX = (desc.__initialManualX || 0) + (node.__totalDx || 0);
          const rawY = (desc.__initialManualY || 0) + (node.__totalDy || 0);
          
          const snappedX = Math.round(rawX / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
          const snappedY = Math.round(rawY / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;

          const el = g.select(`g.node[data-id="${desc.data.id}"]`);
          if (orientation === 'horizontal') {
            el.attr('transform', `translate(${desc.y + snappedX},${desc.x + snappedY})`);
          } else {
            el.attr('transform', `translate(${desc.x + snappedX},${desc.y + snappedY})`);
          }
          
          (desc.data as any)._tempX = snappedX;
          (desc.data as any)._tempY = snappedY;
        });
        
        linkPathSelection.attr('d', (lk) => {
           const sX = (lk.source.data as any)._tempX ?? (lk.source.data.manualX || 0);
           const sY = (lk.source.data as any)._tempY ?? (lk.source.data.manualY || 0);
           const tX = (lk.target.data as any)._tempX ?? (lk.target.data.manualX || 0);
           const tY = (lk.target.data as any)._tempY ?? (lk.target.data.manualY || 0);
           
           const lineType = lk.target.data.connectionStyle?.lineType || 'orthogonal';

           if (orientation === 'horizontal') {
             const srcX = lk.source.y + lk.source.width + sX;
             const srcY = lk.source.x + sY;
             const tgtX = lk.target.y + tX;
             const tgtY = lk.target.x + tY;
             if (lineType === 'straight') return `M${srcX},${srcY} L${tgtX},${tgtY}`;
             return `M${srcX},${srcY} H${(srcX + tgtX) / 2} V${tgtY} H${tgtX}`;
           } else {
             const srcX = lk.source.x + sX;
             const srcY = lk.source.y + lk.source.height + sY;
             const tgtX = lk.target.x + tX;
             const tgtY = lk.target.y + tY;
             if (lineType === 'straight') return `M${srcX},${srcY} L${tgtX},${tgtY}`;
             return `M${srcX},${srcY} V${(srcY + tgtY) / 2} H${tgtX} V${tgtY}`;
           }
        });
      })
      .on('end', function (event, d) {
        if (isCleanView) return; 
        const node = d as ExtendedHierarchyNode;
        const descendants = node.descendants() as unknown as ExtendedHierarchyNode[];
        
        const finalUpdates: { id: string; x: number; y: number }[] = [];
        descendants.forEach((desc: ExtendedHierarchyNode) => {
          const rawX = (desc.__initialManualX || 0) + (node.__totalDx || 0);
          const rawY = (desc.__initialManualY || 0) + (node.__totalDy || 0);
          
          const snappedX = Math.round(rawX / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
          const snappedY = Math.round(rawY / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;

          finalUpdates.push({ id: desc.data.id, x: snappedX, y: snappedY });
          
          delete (desc.data as any)._tempX;
          delete (desc.data as any)._tempY;
        });

        if (onNodeMove) {
          onNodeMove(finalUpdates);
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

    const renderIcon = (parent: d3.Selection<SVGGElement, unknown, null, undefined>, iconName: string, color: string, defaultTransform: string) => {
        const iconData = ICON_PATHS[iconName] || ICON_PATHS['help'];
        
        if (Array.isArray(iconData)) {
             const normScale = 24 / 512; 
             iconData.forEach((path: any) => {
                 parent.append('path')
                    .attr('d', path.d)
                    .attr('fill', path.fill || color)
                    .attr('transform', `${defaultTransform} scale(${normScale}) ${path.transform || ''}`);
             });
        } else {
            parent.append('path')
                .attr('d', iconData)
                .attr('transform', defaultTransform)
                .attr('fill', color);
        }
    };
    
    const renderActionButtons = (nodeG: d3.Selection<SVGGElement, unknown, null, undefined>, d: ExtendedHierarchyNode, isPermanent: boolean = false) => {
        nodeG.selectAll('.action-buttons').remove();
        if (isCleanView) return;

        const actionsG = nodeG.append('g')
            .attr('class', 'action-buttons')
            .attr('opacity', isPermanent ? 1 : 0);

        const box = getRectBox(d);
        const btnY = box.y - 20; 
        const centerX = box.x + box.w / 2;

        const deleteBtn = actionsG.append('g')
            .attr('transform', `translate(${centerX - 24}, ${btnY})`)
            .style('cursor', 'pointer')
            .on('click', (e) => {
                e.stopPropagation();
                onDeleteNode(d.data);
            });
        deleteBtn.append('circle').attr('r', 8).attr('fill', '#ef4444');
        deleteBtn.append('path').attr('d', 'M-2.5,-2.5 L2.5,2.5 M-2.5,2.5 L2.5,-2.5').attr('stroke', 'white').attr('stroke-width', 1.5);

        const dupBtn = actionsG.append('g')
            .attr('transform', `translate(${centerX}, ${btnY})`)
            .style('cursor', 'pointer')
            .on('click', (e) => {
                e.stopPropagation();
                onDuplicateChild(d.data);
            });
        dupBtn.append('circle').attr('r', 8).attr('fill', '#3b82f6');
        dupBtn.append('path').attr('d', 'M-3,3 L-3,-3 L3,-3 L3,3 Z M0,-3 L0,3 M-3,0 L3,0').attr('stroke', 'white').attr('stroke-width', 1.5).attr('fill', 'none');

        if (d.children && d.children.length > 0) {
             const collapseBtn = actionsG.append('g')
                .attr('transform', `translate(${centerX + 24}, ${btnY})`)
                .style('cursor', 'pointer')
                .on('click', (e) => {
                    e.stopPropagation();
                    onToggleCollapse(d.data);
                });
             collapseBtn.append('circle').attr('r', 8).attr('fill', '#f59e0b');
             collapseBtn.append('path').attr('d', 'M-4,0 L4,0').attr('stroke', 'white').attr('stroke-width', 1.5);
        }

        if (!isPermanent) {
            actionsG.transition().duration(200).attr('opacity', 1);
        }
    };

    const nodesSelection = nodesGroup
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
        if (isCleanView) return;

        const isSelected = d.data.id === selectedNodeId || multiSelection.has(d.data.id);
        const isSource = d.data.id === connectionSourceId;
        const el = d3.select(this as SVGGElement);
        
        if (!isLayoutLocked) {
            el.style('cursor', 'move');
        }
        
        const hoverFill = isDark ? '#334155' : '#e2e8f0';
        el.select<SVGRectElement | SVGCircleElement>('.node-bg')
          .transition()
          .duration(200)
          .attr('fill', hoverFill)
          .attr('stroke', isSource ? '#f59e0b' : isSelected ? '#3b82f6' : '#64748b');

        if (!isSelected) {
            renderActionButtons(el, d, false);
        }
      })
      .on('mouseleave', function (event, d: ExtendedHierarchyNode) {
        const el = d3.select(this as SVGGElement);
        const isSelected = d.data.id === selectedNodeId || multiSelection.has(d.data.id);
        
        if (!isSelected) {
            el.selectAll('.action-buttons').transition().duration(200).attr('opacity', 0).remove();
        }
        
        if (isCleanView) return;
        
        const isSource = d.data.id === connectionSourceId;
            
        el.select<SVGRectElement | SVGCircleElement>('.node-bg')
          .transition()
          .duration(200)
          .attr('fill', (d2: ExtendedHierarchyNode) =>
             d2.data.customBgColor || (d2.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor)
          )
          .attr('stroke', isSource ? '#f59e0b' : isSelected ? '#3b82f6' : secondaryTextColor);
      })
      .style('cursor', () => isCleanView ? 'default' : isLayoutLocked ? 'pointer' : 'move')
      .style('filter', (d) => {
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
        if (d.parent && d.parent.data.id !== 'virtual-root' && searchMatches.has(d.parent.data.id)) return 1;
        if (d.children && d.children.some((c: any) => searchMatches.has(c.data.id))) return 1;
        return 0.2;
      });

    nodesSelection.each(function (d: any) {
      const nodeG = d3.select(this as SVGGElement);
      
      if (d.data.id === selectedNodeId) {
          renderActionButtons(nodeG, d, true);
      }

      const shape = d.data.shape || 'rectangle';
      const box = getRectBox(d);
      
      const fill = d.data.customBgColor || (d.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor);

      if (shape === 'circle') {
        nodeG.append('circle')
          .attr('class', 'node-bg')
          .attr('r', 40)
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('fill', fill)
          .attr('stroke', (dAny: any) => {
            if (dAny.data.id === connectionSourceId) return '#f59e0b';
            if (dAny.data.id === selectedNodeId || multiSelection.has(dAny.data.id)) return '#3b82f6';
            return dAny.data.type === ComponentType.SYSTEM_ROOT ? '#64748b' : secondaryTextColor;
          })
          .attr('stroke-width', (dAny: any) =>
            dAny.data.id === selectedNodeId || multiSelection.has(dAny.data.id) ? 3 : 1.5
          );
      } else if (shape === 'square') {
        nodeG.append('rect')
          .attr('class', 'node-bg')
          .attr('width', 80)
          .attr('height', 80)
          .attr('x', -40)
          .attr('y', -40)
          .attr('rx', 4)
          .attr('fill', fill)
          .attr('stroke', (dAny: any) => {
            if (dAny.data.id === connectionSourceId) return '#f59e0b';
            if (dAny.data.id === selectedNodeId || multiSelection.has(dAny.data.id)) return '#3b82f6';
            return secondaryTextColor;
          })
          .attr('stroke-width', (dAny: any) =>
            dAny.data.id === selectedNodeId || multiSelection.has(dAny.data.id) ? 3 : 1.5
          );
      } else {
        nodeG.append('rect')
          .attr('class', 'node-bg')
          .attr('width', box.w)
          .attr('height', box.h)
          .attr('x', box.x)
          .attr('y', box.y)
          .attr('rx', 12)
          .attr('fill', fill)
          .attr('stroke', (dAny: any) => {
            if (dAny.data.id === connectionSourceId) return '#f59e0b';
            if (dAny.data.id === selectedNodeId || multiSelection.has(dAny.data.id)) return '#3b82f6';
            return dAny.data.type === ComponentType.SYSTEM_ROOT ? '#64748b' : secondaryTextColor;
          })
          .attr('stroke-width', (dAny: any) =>
            dAny.data.id === selectedNodeId || multiSelection.has(dAny.data.id) || dAny.data.id === connectionSourceId ? 3 : 1.5
          );

        nodeG.append('path')
          .attr('d', (dAny: any) => {
            const r = 12;
            const box2 = getRectBox(dAny);
            return `M${box2.x},${box2.y + 6} v${-6 + r} a${r},${r} 0 0 1 ${r},${-r} h${
              box2.w - 2 * r
            } a${r},${r} 0 0 1 ${r},${r} v${6 - r}`;
          })
          .attr('fill', (dAny: ExtendedHierarchyNode) =>
            dAny.data.customColor || COMPONENT_CONFIG[dAny.data.type]?.color || '#94a3b8'
          );
      }
    });

    const contentG = nodesSelection.append('g')
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

    contentG.each(function (d) {
      const el = d3.select(this as SVGGElement);
      const iconColor = d.data.customColor || COMPONENT_CONFIG[d.data.type]?.color || '#94a3b8';

      if (d.data.customImage) {
        el.append('image')
          .attr('xlink:href', d.data.customImage)
          .attr('x', -20)
          .attr('y', -20)
          .attr('width', 40)
          .attr('height', 40)
          .style('clip-path', 'circle(20px at center)');
      } else {
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
        
        const iconName = COMPONENT_CONFIG[d.data.type]?.icon;
        const defaultTransform = 'translate(-9, -9) scale(0.75)';
        renderIcon(el, iconName, iconColor, defaultTransform);
      }
    });

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
          .style('fill', () => d.data.customColor || COMPONENT_CONFIG[d.data.type]?.color || '#94a3b8')
          .style('opacity', 0.9)
          .text(() => d.data.componentNumber || t.componentTypes[d.data.type] || d.data.type);

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
          const maxLength = 25;
          const lines = [];
          if (desc.length > maxLength) {
              const mid = Math.ceil(desc.length / 2);
              const splitIndex = desc.indexOf(' ', mid);
              if (splitIndex !== -1 && splitIndex < desc.length - 5) {
                 lines.push(desc.substring(0, splitIndex));
                 lines.push(desc.substring(splitIndex + 1));
              } else {
                 lines.push(desc.substring(0, maxLength));
                 lines.push(desc.substring(maxLength));
              }
          } else {
              lines.push(desc);
          }
          
          const textEl = el.append('text')
            .attr('x', 0)
            .attr('y', yOffset)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('fill', secondaryTextColor);

          lines.forEach((line, i) => {
              textEl.append('tspan')
                  .attr('x', 0)
                  .attr('dy', i === 0 ? 0 : '1.2em')
                  .text(line);
          });
          yOffset += (lines.length - 1) * 12;
        }

        if (d.data.place || d.data.building || d.data.floor) {
             yOffset += 14;
             const locText = [];
             if (d.data.building) locText.push(d.data.building);
             if (d.data.floor) locText.push(d.data.floor);
             if (d.data.place) locText.push(d.data.place);

             el.append('text')
                .attr('x', 0)
                .attr('y', yOffset)
                .attr('text-anchor', 'middle')
                .style('font-size', '9px')
                .style('font-weight', '500')
                .style('fill', isDark ? '#94a3b8' : '#64748b')
                .text(locText.join(', '));
        }
      }
    });

    nodesSelection
      .filter((d) => !!(d.data.isCollapsed && d._children && d._children.length > 0))
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
      .style('pointer-events', 'all')
      .on('click', function(e, d) {
          e.stopPropagation();
          onToggleCollapse(d.data);
      });

    nodesSelection
      .filter((d) => !!(d.data.isCollapsed && d._children && d._children.length > 0))
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

    const renderBadge = (
        gNode: d3.Selection<SVGGElement, unknown, null, undefined>, 
        textValue: string, 
        iconName: string, 
        color: string, 
        bgColorLight: string, 
        bgColorDark: string, 
        d: ExtendedHierarchyNode,
        xOffset: number,
        customTransform?: string
    ) => {
        const group = gNode.append('g');
        
        const text = group.append('text')
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

        group.insert('rect', 'text')
          .attr('height', 18)
          .attr('width', totalWidth)
          .attr('rx', 9)
          .attr('fill', isDark ? bgColorDark : bgColorLight)
          .attr('stroke', color)
          .attr('stroke-width', 0.5);

        const defaultTrans = customTransform || 'translate(3, 3) scale(0.5)';
        renderIcon(group, iconName, color, defaultTrans);
        
        if (d.data.shape && d.data.shape !== 'rectangle') {
             group.attr('transform', `translate(${xOffset}, -35)`);
        } else {
             const box = getRectBox(d);
             const y = box.y + box.h - 24;
             group.attr('transform', `translate(${box.x + 8 + xOffset}, ${y})`);
        }
        return totalWidth;
    };

    nodesSelection.each(function(d: any) {
        const gNode = d3.select(this as SVGGElement);
        let currentXOffset = 0;

        if (d.data.hasMeter) {
            const w = renderBadge(gNode, d.data.meterNumber || '', 'speed', '#3b82f6', '#dbeafe', '#1e3a8a', d, currentXOffset);
            currentXOffset += w + 5;
        }
        if (d.data.hasGeneratorConnection) {
            const w = renderBadge(gNode, d.data.generatorName || '', 'letter_g', '#ef4444', '#fee2e2', '#7f1d1d', d, currentXOffset);
            currentXOffset += w + 5;
        }
        if (d.data.isExcludedFromMeter) {
             const w = renderBadge(gNode, '', 'power_off', '#64748b', '#f1f5f9', '#334155', d, currentXOffset);
            currentXOffset += w + 5;
        }
        if (d.data.isAirConditioning) {
             const w = renderBadge(gNode, '', 'ac_unit', '#06b6d4', '#cffafe', '#155e75', d, currentXOffset);
            currentXOffset += w + 5;
        }
        if (d.data.isReserved) {
             const w = renderBadge(gNode, '', 'lock', '#eab308', '#fef9c3', '#713f12', d, currentXOffset);
            currentXOffset += w + 5;
        }
    });

    linksToRender.forEach((d: any) => {
        const cableText = d.target.data.connectionStyle?.cableSize;
        if (cableText) {
            const stroke = d.target.data.connectionStyle?.strokeColor || d.target.data.customColor || COMPONENT_CONFIG[d.target.data.type]?.color || linkColor;
            const tXOffset = d.target.data.manualX || 0;
            const tYOffset = d.target.data.manualY || 0;
            
            const tgtX = orientation === 'horizontal' ? d.target.y + tXOffset : d.target.x + tXOffset;
            const tgtY = orientation === 'horizontal' ? d.target.x + tYOffset : d.target.y + tYOffset;

            const labelG = labelsGroup.append('g');
            let xPos = tgtX;
            let yPos = tgtY;
            let rotation = 0;
            let textAnchor = 'end';

            if (orientation === 'horizontal') {
                 xPos = tgtX - 25; 
                 yPos = tgtY - 8;
                 textAnchor = 'end'; 
            } else {
                 xPos = tgtX - 5; 
                 yPos = tgtY - 35;
                 rotation = -90;
                 textAnchor = 'start'; 
            }

            labelG.attr('transform', `translate(${xPos}, ${yPos}) rotate(${rotation})`);

            const txt = labelG.append('text')
               .attr('text-anchor', textAnchor)
               .style('font-size', '10px')
               .style('font-weight', 'bold')
               .style('fill', '#ffffff')
               .style('direction', 'ltr') 
               .text(cableText);

            const bbox = txt.node()?.getBBox();
            if (bbox) {
                 labelG.insert('rect', 'text')
                    .attr('x', bbox.x - 4)
                    .attr('y', bbox.y - 2)
                    .attr('width', bbox.width + 8)
                    .attr('height', bbox.height + 4)
                    .attr('rx', 4)
                    .attr('fill', stroke)
                    .style('opacity', 0.9);
            }
        }
    });

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    if (nodesToRender.length > 0) {
        nodesToRender.forEach(d => {
            const w = d.width;
            const h = d.height;
            const offX = d.data.manualX || 0;
            const offY = d.data.manualY || 0;
            
            let x1, x2, y1, y2;
            
            if (orientation === 'horizontal') {
                const cx = d.y + offX;
                const cy = d.x + offY;
                x1 = cx;
                x2 = cx + w;
                y1 = cy - h / 2;
                y2 = cy + h / 2;
            } else {
                const cx = d.x + offX;
                const cy = d.y + offY;
                x1 = cx - w / 2;
                x2 = cx + w / 2;
                y1 = cy;
                y2 = cy + h;
            }
            if (x1 < minX) minX = x1;
            if (x2 > maxX) maxX = x2;
            if (y1 < minY) minY = y1;
            if (y2 > maxY) maxY = y2;
        });
    } else {
        minX = 0;
        maxX = width;
        minY = 0;
        maxY = height;
    }
    
    const types = Object.values(ComponentType);
    const badgeItems = [
      { label: t.legend.meter, icon: 'speed', color: '#3b82f6' },
      { label: t.legend.generator, icon: 'letter_g', color: '#ef4444' },
      { label: t.legend.noMeter, icon: 'power_off', color: '#64748b' },
      { label: t.legend.ac, icon: 'ac_unit', color: '#06b6d4' },
      { label: t.legend.reserved, icon: 'lock', color: '#eab308' }
    ];

    const totalLegendItems = types.length + badgeItems.length + 1; 
    const legendW = 200;
    const legendH = 50 + totalLegendItems * 25;

    let legX = maxX + 50;
    let legY = minY;

    if (isPrintMode && activeProject && activeProject.printMetadata) {
        const blockW = 500;
        const blockH = 100;
        const safeY = maxY + 60; 
        legX = Math.max(minX, maxX - legendW);
        legY = safeY;
        const titleX = Math.max(minX, maxX - blockW);
        const titleY = legY + legendH + 20;

        const titleBlockG = g.append('g')
            .attr('transform', `translate(${titleX}, ${titleY})`)
            .attr('class', 'print-title-block')
            .style('cursor', 'pointer');

        titleBlockG.append('rect')
            .attr('width', blockW)
            .attr('height', blockH)
            .attr('fill', 'white')
            .attr('stroke', 'black')
            .attr('stroke-width', 2)
            .style('pointer-events', 'all')
            .on('click', (event) => {
                if(event.defaultPrevented) return;
                event.stopPropagation();
                if(onEditPrintSettings) onEditPrintSettings();
            });

        titleBlockG.append('line').attr('x1', 0).attr('y1', 33).attr('x2', blockW).attr('y2', 33).attr('stroke', 'black').attr('stroke-width', 1);
        titleBlockG.append('line').attr('x1', 0).attr('y1', 66).attr('x2', blockW).attr('y2', 66).attr('stroke', 'black').attr('stroke-width', 1);

        const dividerX = isRTL ? 150 : 350;
        titleBlockG.append('line').attr('x1', dividerX).attr('y1', 0).attr('x2', dividerX).attr('y2', 100).attr('stroke', 'black').attr('stroke-width', 1);

        const pm = activeProject.printMetadata;

        const renderField = (label: string, value: string, x: number, y: number, w: number, fieldKey: string) => {
            const cell = titleBlockG.append('g').on('click', (e) => {
                if(e.defaultPrevented) return;
                e.stopPropagation();
                if(onEditPrintSettings) onEditPrintSettings(fieldKey);
            });
            cell.append('rect').attr('x', x - w/2).attr('y', y - 15).attr('width', w).attr('height', 30).attr('fill', 'transparent').style('pointer-events', 'all');
            cell.append('text').attr('x', x).attr('y', y - 8).attr('text-anchor', 'middle').style('font-size', '8px').style('fill', '#666').style('pointer-events', 'none').text(label);
            cell.append('text').attr('x', x).attr('y', y + 8).attr('text-anchor', 'middle').style('font-size', '12px').style('font-weight', 'bold').style('fill', 'black').style('pointer-events', 'none').text(value || '-');
        };

        const wideCenter = isRTL ? (150 + blockW) / 2 : 350 / 2;
        const narrowCenter = isRTL ? 150 / 2 : (350 + blockW) / 2;

        renderField(t.printLayout.project, activeProject.name, wideCenter, 16, 300, 'projectName');
        renderField(t.printLayout.org, pm.organization, wideCenter, 50, 300, 'organization');
        renderField(t.printLayout.engineer, pm.engineer, wideCenter, 84, 300, 'engineer');

        renderField(t.printLayout.date, pm.date, narrowCenter, 16, 140, 'date');
        renderField(t.printLayout.rev, pm.revision, narrowCenter, 50, 140, 'revision');
        renderField(t.printLayout.approved, pm.approvedBy, narrowCenter, 84, 140, 'approvedBy');
    }

    const legendG = g
      .append('g')
      .attr('class', 'legend-group')
      .attr('transform', `translate(${legX}, ${legY})`);

    legendG.append('rect').attr('width', legendW).attr('height', legendH).attr('rx', 8).attr('fill', isDark ? '#1e293b' : '#ffffff').attr('stroke', secondaryTextColor).attr('stroke-width', 1).attr('opacity', 0.95);
    legendG.append('text').attr('x', legendW / 2).attr('y', 25).attr('text-anchor', 'middle').attr('font-weight', 'bold').attr('fill', textColor).attr('font-size', '12px').text(t.legend.title);

    types.forEach((type, i) => {
      const y = 50 + i * 25;
      const config = COMPONENT_CONFIG[type];
      let iconX = isRTL ? legendW - 25 : 25;
      let textX = isRTL ? legendW / 2 : 45;
      legendG.append('circle').attr('cx', iconX).attr('cy', y).attr('r', 8).attr('fill', isDark ? '#0f172a' : '#f8fafc').attr('stroke', config.color).attr('stroke-width', 1.5);
      const itemG = legendG.append('g').attr('transform', `translate(${iconX - 6}, ${y - 6})`);
      renderIcon(itemG, config.icon, config.color, 'scale(0.5)');
      legendG.append('text').attr('x', textX).attr('y', y).attr('dominant-baseline', 'middle').attr('fill', textColor).attr('font-size', '11px').attr('text-anchor', isRTL ? 'middle' : 'start').text(t.componentTypes[type]);
    });

    const sepY = 50 + types.length * 25 + 10;
    legendG.append('line').attr('x1', 20).attr('y1', sepY).attr('x2', legendW - 20).attr('y2', sepY).attr('stroke', secondaryTextColor).attr('stroke-width', 1).attr('opacity', 0.5);

    badgeItems.forEach((item, i) => {
        const y = sepY + 20 + i * 25;
        let iconX = isRTL ? legendW - 25 : 25;
        let textX = isRTL ? legendW / 2 : 45;
        legendG.append('rect').attr('x', iconX - 10).attr('y', y - 9).attr('width', 20).attr('height', 18).attr('rx', 9).attr('fill', isDark ? '#1e293b' : '#f1f5f9').attr('stroke', item.color).attr('stroke-width', 0.5);
        const itemG = legendG.append('g').attr('transform', `translate(${iconX - 6}, ${y - 6})`);
        renderIcon(itemG, item.icon, item.color, 'scale(0.5)');
        legendG.append('text').attr('x', textX).attr('y', y).attr('dominant-baseline', 'middle').attr('fill', textColor).attr('font-size', '11px').attr('text-anchor', isRTL ? 'middle' : 'start').text(item.label);
    });

  }, [
    data, dimensions, onNodeClick, onLinkClick, selectedNodeId, selectedLinkId, orientation, searchMatches,
    isConnectMode, connectionSourceId, t, language, theme, onBackgroundClick, multiSelection, isPrintMode,
    activeProject, onEditPrintSettings, onAddRoot, onAddGenerator, onDuplicateChild, onDeleteNode,
    onToggleCollapse, onGroupNode, onNodeMove, onDisconnectLink, isCleanView, activeFilters, annotations,
    isAnnotating, annotationColor, isLayoutLocked
  ]);

  return (
    <div ref={wrapperRef} className={`w-full h-full relative overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-white'}`} style={{ touchAction: 'none' }}>
      <svg id="diagram-svg" ref={svgRef} width="100%" height="100%" className="block" />
    </div>
  );
};
