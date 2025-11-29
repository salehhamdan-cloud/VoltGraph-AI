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
  onNodeMove?: (updates: {id: string, x: number, y: number}[]) => void;
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
}

type ExtendedHierarchyNode = Omit<d3.HierarchyPointNode<ElectricalNode>, 'parent' | 'children'> & {
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

type ExtendedHierarchyLink = {
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
    theme
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
          "Main Supply": t.defaultDesc.grid,
          "Standby Power": t.defaultDesc.gen,
          "Step Down/Up": t.defaultDesc.trans,
          "Independent Load": t.defaultDesc.load,
          "Grouped Components": t.inputPanel.groupNode
      };
      return defaults[desc] || desc;
  };

  const getTranslatedName = (name: string, type: string) => {
      if (!name || name.toUpperCase() === type || name.replace(/_/g, ' ').toUpperCase() === type.replace(/_/g, ' ')) {
          return t.componentTypes[type] || name;
      }
      return name;
  };

  useEffect(() => {
    if (wrapperRef.current) {
      setDimensions({
        width: wrapperRef.current.offsetWidth,
        height: wrapperRef.current.offsetHeight
      });
    }
    const handleResize = () => {
       if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight
        });
       }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Background click handler
    svg.on("click", (event) => {
        if (event.defaultPrevented) return; // Zoom drag
        onBackgroundClick?.();
    });

    const defs = svg.append('defs');
    const pattern = defs.append('pattern')
        .attr('id', 'dot-pattern')
        .attr('width', 20)
        .attr('height', 20)
        .attr('patternUnits', 'userSpaceOnUse');
    
    pattern.append('circle')
        .attr('cx', 2)
        .attr('cy', 2)
        .attr('r', 1)
        .attr('fill', dotColor);

    svg.style('background-color', bgColor)
       .style('background-image', 'url(#dot-pattern)');

    const { width, height } = dimensions;
    
    if (!data || data.length === 0) {
         const g = svg.append("g")
             .attr("transform", `translate(${width/2},${height/2})`);
         
         g.append("circle")
             .attr("r", 40)
             .attr("fill", rootNodeBgColor)
             .attr("stroke", secondaryTextColor)
             .attr("stroke-width", 2)
             .attr("stroke-dasharray", "5,5")
             .style("cursor", "pointer")
             .on("click", (e) => {
                 e.stopPropagation();
                 onAddRoot && onAddRoot();
             });

         g.append("path")
             .attr("d", ICON_PATHS['domain'])
             .attr("transform", "translate(-16, -16) scale(1.33)")
             .attr("fill", secondaryTextColor)
             .style("pointer-events", "none");

         g.append("text")
             .attr("y", 60)
             .attr("text-anchor", "middle")
             .style("font-size", "14px")
             .style("fill", secondaryTextColor)
             .text(t.addFirstNode);

         const genG = svg.append("g")
             .attr("transform", `translate(${width/2},${height/2 + 120})`);

         genG.append("rect")
             .attr("x", -80)
             .attr("y", -20)
             .attr("width", 160)
             .attr("height", 40)
             .attr("rx", 20)
             .attr("fill", "transparent")
             .attr("stroke", secondaryTextColor)
             .attr("stroke-dasharray", "4,4")
             .style("cursor", "pointer")
             .on("click", (e) => {
                 e.stopPropagation();
                 onAddGenerator && onAddGenerator();
             });
          
         genG.append("text")
             .attr("text-anchor", "middle")
             .attr("dominant-baseline", "central")
             .style("font-size", "12px")
             .style("fill", secondaryTextColor)
             .style("pointer-events", "none")
             .text(t.addStandaloneGen);
         
         return;
    }

    const margin = { top: 100, right: 150, bottom: 100, left: 150 }; 
    
    ['arrow', 'circle', 'diamond'].forEach(type => {
        const markerStart = defs.append('marker')
            .attr('id', `${type}-start`)
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 5)
            .attr('refY', 5)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto-start-reverse');
        
        if (type === 'arrow') markerStart.append('path').attr('d', 'M10,0 L0,5 L10,10 z').attr('fill', 'context-stroke');
        else if (type === 'circle') markerStart.append('circle').attr('cx', 5).attr('cy', 5).attr('r', 4).attr('fill', 'context-stroke');
        else if (type === 'diamond') markerStart.append('path').attr('d', 'M5,0 L10,5 L5,10 L0,5 z').attr('fill', 'context-stroke');

        const markerEnd = defs.append('marker')
            .attr('id', `${type}-end`)
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 5)
            .attr('refY', 5)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto');

        if (type === 'arrow') markerEnd.append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', 'context-stroke');
        else if (type === 'circle') markerEnd.append('circle').attr('cx', 5).attr('cy', 5).attr('r', 4).attr('fill', 'context-stroke');
        else if (type === 'diamond') markerEnd.append('path').attr('d', 'M5,0 L10,5 L5,10 L0,5 z').attr('fill', 'context-stroke');
    });

    defs.append('marker')
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


    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        g.attr("transform", event.transform);
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

    const getNodeSize = (d: d3.HierarchyNode<ElectricalNode>) => {
        if (d.data.id === 'virtual-root') return { w: 1, h: 1 };
        
        // Shape override handling
        const isCircle = d.data.shape === 'circle';
        const isSquare = d.data.shape === 'square';

        if (isCircle || isSquare) {
            return { w: 80, h: 80 }; // Fixed size for simple shapes
        }

        const displayName = getTranslatedName(d.data.name, d.data.type);
        const compNum = d.data.componentNumber || t.componentTypes[d.data.type] || d.data.type;
        const model = d.data.model || '';
        const desc = getTranslatedDescription(d.data.description);
        
        let specText = "";
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
             const mTextW = (d.data.meterNumber?.length || 0) * 8 + 10;
             badgeWidth += 24 + (d.data.meterNumber ? mTextW : 0);
        }
        if (d.data.hasGeneratorConnection) {
             const gTextW = (d.data.generatorName?.length || 0) * 8 + 10;
             badgeWidth += 24 + (d.data.generatorName ? gTextW : 0);
        }
        if (d.data.hasMeter && d.data.hasGeneratorConnection) {
            badgeWidth += 30; 
        }

        const contentWidth = Math.max(nameLen, typeLen, specLen, modelLen, descLen, badgeWidth, 90); 
        const nodeW = contentWidth + 30; 

        let contentHeight = 25; 
        contentHeight += 24; 
        contentHeight += 16; 
        if (specText) contentHeight += 14;
        if (model) contentHeight += 14;
        if (desc) contentHeight += 14;
        if (d.data.hasMeter || d.data.hasGeneratorConnection) contentHeight += 26;
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

    let treeLayout;
    if (orientation === 'horizontal') {
        const depthSpacing = 350; 
        const dynamicHeight = Math.max(height, leafCount * 140); 
        const dynamicWidth = Math.max(width, depthCount * depthSpacing);
        
        treeLayout = d3.tree<ElectricalNode>()
            .size([dynamicHeight, dynamicWidth])
            .nodeSize([140, depthSpacing]) 
            .separation((a, b) => {
                const aH = (a as any).height || 100;
                const bH = (b as any).height || 100;
                const totalHeight = (aH + bH) / 2 + 20; 
                return (totalHeight / 140) * (a.parent === b.parent ? 1 : 1.2);
            }); 
    } else {
        const depthSpacing = 300; // Increased to give more space for vertical text
        const dynamicWidth = Math.max(width, leafCount * 200);
        const dynamicHeight = Math.max(height, depthCount * depthSpacing);
        treeLayout = d3.tree<ElectricalNode>()
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

    const nodesToRender = root.descendants().filter(d => d.depth > 0) as unknown as ExtendedHierarchyNode[];
    const nodeLookup = new Map<string, ExtendedHierarchyNode>();
    nodesToRender.forEach((node) => nodeLookup.set(node.data.id, node));

    const linksToRender: ExtendedHierarchyLink[] = root
        .links()
        .filter((d) => d.source.data.id !== 'virtual-root')
        .map((link) => ({
            source: nodeLookup.get(link.source.data.id) || (link.source as unknown as ExtendedHierarchyNode),
            target: nodeLookup.get(link.target.data.id) || (link.target as unknown as ExtendedHierarchyNode)
        }));

    const getRectBox = (d: ExtendedHierarchyNode) => {
        const w = d.width;
        const h = d.height;
        if (orientation === 'horizontal') {
            return { x: 0, y: -h/2, w, h };
        } else {
            return { x: -w/2, y: 0, w, h };
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

    const extraLinksToRender: ExtendedHierarchyLink[] = [];

    nodesToRender.forEach(d => {
        if (d.data.extraConnections) {
            d.data.extraConnections.forEach(targetId => {
                const targetNode = nodeLookup.get(targetId);
                if (targetNode) {
                    extraLinksToRender.push({ source: targetNode, target: d });
                }
            });
        }
    });

    const linksGroup = g.append('g').attr('class', 'links');

    const drag = d3.drag<SVGGElement, ExtendedHierarchyNode>()
        .on("start", function(event, d) {
             const descendants = d.descendants() as unknown as ExtendedHierarchyNode[];
             descendants.forEach((desc) => {
                 desc.__initialManualX = desc.data.manualX || 0;
                 desc.__initialManualY = desc.data.manualY || 0;
             });
             d3.select(this).attr("data-is-dragging", "false");
        })
        .on("drag", function(event, d) {
             if (!d.__isDragging && (event.dx*event.dx + event.dy*event.dy) > 0) {
                 d.__totalDx = (d.__totalDx || 0) + event.dx;
                 d.__totalDy = (d.__totalDy || 0) + event.dy;
                 if (((d.__totalDx)**2 + (d.__totalDy)**2 > 16)) {
                     d.__isDragging = true;
                 }
             }

             if (d.__isDragging) {
                 const descendants = d.descendants() as unknown as ExtendedHierarchyNode[];
                 descendants.forEach((desc) => {
                     const currentX = (desc.data.manualX || 0) + event.dx;
                     const currentY = (desc.data.manualY || 0) + event.dy;
                     desc.data.manualX = currentX;
                     desc.data.manualY = currentY;
                     
                     const el = g.select(`g.node[data-id="${desc.data.id}"]`);
                     const offsetX = desc.data.manualX || 0;
                     const offsetY = desc.data.manualY || 0;
                     
                     if (orientation === 'horizontal') {
                         el.attr("transform", `translate(${desc.y + offsetX},${desc.x + offsetY})`);
                     } else {
                         el.attr("transform", `translate(${desc.x + offsetX},${desc.y + offsetY})`);
                     }
                     // Update links during drag (simplified refresh would be costly)
                 });
             }
        })
        .on("end", function(event, d) {
            if (d.__isDragging) {
                d.__isDragging = false;
                d.__totalDx = 0; d.__totalDy = 0;
                const updates: {id: string, x: number, y: number}[] = [];
                const descendants = d.descendants() as unknown as ExtendedHierarchyNode[];
                descendants.forEach((desc) => {
                    updates.push({
                        id: desc.data.id,
                        x: desc.data.manualX || 0,
                        y: desc.data.manualY || 0
                    });
                });
                if (onNodeMove) {
                    onNodeMove(updates);
                }
            }
        });

    const renderLinks = (
        selection: d3.Selection<SVGPathElement, ExtendedHierarchyLink, SVGGElement, unknown>,
        className: string,
        isHitArea = false
    ) => {
        selection
          .attr('class', className)
          .attr('data-target-id', (d) => d.target.data.id)
          .attr('d', (d) => linkGenerator(d.source, d.target))
          .attr('fill', 'none')
          .each(function(d) {
              if (isHitArea) return;
              const style = d.target.data.connectionStyle || {};
              const stroke = style.strokeColor || d.target.data.customColor || COMPONENT_CONFIG[d.target.data.type]?.color || linkColor;
              const isSelected = d.target.data.id === selectedLinkId;
              
              if (className === 'link-extra') {
                  d3.select(this).attr('stroke', isDark ? '#f59e0b' : '#d97706').attr('stroke-width', 2.5)
                    .attr('stroke-dasharray', '8,5').attr('marker-end', 'url(#arrow-end-extra)').attr('opacity', 0.8);
              } else {
                  d3.select(this).attr('stroke', stroke).attr('stroke-width', isSelected ? 4 : 2.5)
                    .attr('stroke-dasharray', style.lineStyle === 'dashed' ? '8,4' : style.lineStyle === 'dotted' ? '2,4' : 'none')
                    .attr('marker-start', style.startMarker && style.startMarker !== 'none' ? `url(#${style.startMarker}-start)` : null)
                    .attr('marker-end', style.endMarker && style.endMarker !== 'none' ? `url(#${style.endMarker}-end)` : null)
                    .style('filter', isSelected ? 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.3))' : 'none')
                    .attr('opacity', (d: any) => {
                        if (!searchMatches) return 0.8;
                        const isMatch = searchMatches.has(d.source.data.id) || searchMatches.has(d.target.data.id);
                        return isMatch ? 1 : 0.1;
                    });
              }
          });
    };

    const linkPathSelection = linksGroup.selectAll<SVGPathElement, ExtendedHierarchyLink>('path.link-visible')
        .data(linksToRender)
        .enter()
        .append('path')
        .call(renderLinks, 'link-visible');
    linksGroup.selectAll<SVGPathElement, ExtendedHierarchyLink>('path.link-extra')
        .data(extraLinksToRender)
        .enter()
        .append('path')
        .call(renderLinks, 'link-extra');
    linksGroup.selectAll<SVGPathElement, ExtendedHierarchyLink>('path.link-hit')
        .data(linksToRender)
        .enter()
        .append('path')
        .attr('class', 'link-hit')
        .attr('data-target-id', (d) => d.target.data.id)
        .attr('d', (d) => linkGenerator(d.source, d.target))
        .attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 15).style('cursor', 'pointer')
        .on('click', (e, d) => {
            e.stopPropagation();
            onLinkClick(d.source.data.id, d.target.data.id);
        });

    // 1. Render Nodes First (So they are behind labels)
    const nodes = g.selectAll<SVGGElement, ExtendedHierarchyNode>('g.node')
      .data(nodesToRender)
      .enter()
      .append('g')
      .attr('class', (d) => `node group ${d.data.id === selectedNodeId || multiSelection.has(d.data.id) ? 'selected' : ''}`)
      .attr('data-id', (d) => d.data.id) 
      .attr('transform', (d) => {
          const offsetX = d.data.manualX || 0;
          const offsetY = d.data.manualY || 0;
          return orientation === 'horizontal' 
            ? `translate(${d.y + offsetX},${d.x + offsetY})` 
            : `translate(${d.x + offsetX},${d.y + offsetY})`;
      })
      .call(drag as any)
      .on('click', function(event, d) {
        if (d.__isDragging) { event.stopPropagation(); return; }
        if (event.defaultPrevented) return;
        event.stopPropagation();
        onNodeClick(d.data, event.shiftKey);
      })
      .on('mouseenter', function(event, d) {
          const isSelected = d.data.id === selectedNodeId || multiSelection.has(d.data.id);
          const isSource = d.data.id === connectionSourceId;
          const el = d3.select(this);
          el.style('cursor', 'move'); 
          el.select('.action-buttons').style('opacity', 1).style('pointer-events', 'all');
          el.select('.node-bg').transition().duration(200)
            .attr('fill', isDark ? '#334155' : '#e2e8f0')
            .attr('stroke', isSource ? '#f59e0b' : (isSelected ? '#3b82f6' : '#64748b'));
      })
      .on('mouseleave', function(event, d) {
          const isSelected = d.data.id === selectedNodeId || multiSelection.has(d.data.id);
          const isSource = d.data.id === connectionSourceId;
          const el = d3.select(this);
          if (!isSelected) el.select('.action-buttons').style('opacity', 0).style('pointer-events', 'none');
          el.select('.node-bg').transition().duration(200)
            .attr('fill', (d: any) => d.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor)
            .attr('stroke', isSource ? '#f59e0b' : (isSelected ? '#3b82f6' : secondaryTextColor));
      })
      .style('cursor', (d) => 'move')
      .style('opacity', (d) => {
         if (!searchMatches) return 1;
         if (searchMatches.has(d.data.id)) return 1;
         if (d.parent && d.parent.data.id !== 'virtual-root' && searchMatches.has(d.parent.data.id)) return 1;
         if (d.children && d.children.some(c => searchMatches.has(c.data.id))) return 1;
         if ((d as any)._children && (d as any)._children.some((c: any) => searchMatches.has(c.data.id))) return 1;
         return 0.2;
      });

    // Node Shape Rendering Logic
    nodes.each(function(d: ExtendedHierarchyNode) {
        const nodeG = d3.select<SVGGElement, ExtendedHierarchyNode>(this);
        const shape = d.data.shape || 'rectangle';
        const box = getRectBox(d);
        
        if (shape === 'circle') {
             nodeG.append('circle')
                .attr('class', 'node-bg')
                .attr('r', 40)
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('fill', d.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor)
                .attr('stroke', (d) => {
                  if (d.data.id === connectionSourceId) return '#f59e0b';
                  if (d.data.id === selectedNodeId || multiSelection.has(d.data.id)) return '#3b82f6';
                  return d.data.type === ComponentType.SYSTEM_ROOT ? '#64748b' : secondaryTextColor;
                })
                .attr('stroke-width', (d) => (d.data.id === selectedNodeId || multiSelection.has(d.data.id)) ? 3 : 1.5)
                .style('filter', (d) => (d.data.id === selectedNodeId || multiSelection.has(d.data.id)) ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');
        } else if (shape === 'square') {
             nodeG.append('rect')
                .attr('class', 'node-bg')
                .attr('width', 80).attr('height', 80)
                .attr('x', -40).attr('y', -40).attr('rx', 4)
                .attr('fill', d.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor)
                .attr('stroke', (d) => {
                    if (d.data.id === connectionSourceId) return '#f59e0b';
                    if (d.data.id === selectedNodeId || multiSelection.has(d.data.id)) return '#3b82f6';
                    return secondaryTextColor;
                })
                .attr('stroke-width', (d) => (d.data.id === selectedNodeId || multiSelection.has(d.data.id)) ? 3 : 1.5);
        } else {
             // Rectangle (Default)
             nodeG.append('rect')
                .attr('class', 'node-bg')
                .attr('width', box.w).attr('height', box.h)
                .attr('x', box.x).attr('y', box.y).attr('rx', 12)
                .attr('fill', d.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor)
                .attr('stroke', (d) => {
                    if (d.data.id === connectionSourceId) return '#f59e0b'; 
                    if (d.data.id === selectedNodeId || multiSelection.has(d.data.id)) return '#3b82f6'; 
                    return d.data.type === ComponentType.SYSTEM_ROOT ? '#64748b' : secondaryTextColor;
                })
                .attr('stroke-width', (d) => (d.data.id === selectedNodeId || multiSelection.has(d.data.id) || d.data.id === connectionSourceId) ? 3 : 1.5)
                .style('filter', (d) => (d.data.id === selectedNodeId || multiSelection.has(d.data.id) || d.data.id === connectionSourceId) ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');
                
             // Color Bar for Rectangle
             nodeG.append('path')
                .attr('d', (d: any) => {
                    const r = 12; const box = getRectBox(d);
                    return `M${box.x},${box.y + 6} v${-6 + r} a${r},${r} 0 0 1 ${r},${-r} h${box.w - 2*r} a${r},${r} 0 0 1 ${r},${r} v${6 - r}`;
                })
                .attr('fill', (d) => d.data.customColor || COMPONENT_CONFIG[d.data.type]?.color || '#94a3b8');
        }
    });

    // Content Group (Icon + Text)
    const contentG = nodes.append('g')
        .attr('transform', d => {
            const shape = d.data.shape || 'rectangle';
            const box = getRectBox(d);
            if (shape === 'circle' || shape === 'square') {
                return `translate(0, 0)`;
            }
            if (orientation === 'horizontal') return `translate(${d.width/2}, ${box.y + 25})`;
            else return `translate(0, ${box.y + 25})`;
        });

    // Icon / Custom Image
    contentG.each(function(d: ExtendedHierarchyNode) {
        const el = d3.select<SVGGElement, ExtendedHierarchyNode>(this);
        const iconColor = d.data.customColor || COMPONENT_CONFIG[d.data.type]?.color || '#94a3b8';
        
        if (d.data.customImage) {
            // Render Custom Image
             el.append('image')
                .attr('xlink:href', d.data.customImage)
                .attr('x', -20).attr('y', -20)
                .attr('width', 40).attr('height', 40)
                .style('clip-path', 'circle(20px at center)'); // Simple circular clip
        } else {
            // Render Standard Icon
            const shape = d.data.shape || 'rectangle';
            if (shape === 'rectangle') {
                 el.append('circle').attr('r', 16).attr('cx', 0).attr('cy', 0)
                    .attr('fill', isDark ? '#1e293b' : '#ffffff')
                    .attr('stroke', iconColor)
                    .attr('stroke-width', 1.5);
            }
            el.append('path').attr('d', ICON_PATHS[COMPONENT_CONFIG[d.data.type]?.icon] || ICON_PATHS['help'])
                .attr('transform', 'translate(-9, -9) scale(0.75)') 
                .attr('fill', iconColor);
        }
    });

    // Text Labels (Only for Rectangle for full details, simple name for others)
    contentG.each(function(d: ExtendedHierarchyNode) {
        const el = d3.select<SVGGElement, ExtendedHierarchyNode>(this);
        const shape = d.data.shape || 'rectangle';
        
        if (shape === 'circle' || shape === 'square') {
             el.append('text').attr('x', 0).attr('y', 28).attr('text-anchor', 'middle')
                .style('font-size', '10px').style('font-weight', 'bold').style('fill', textColor)
                .text((d) => getTranslatedName(d.data.name, d.data.type));
        } else {
             // Full details for Rectangle
             el.append('text').attr('x', 0).attr('y', 32).attr('text-anchor', 'middle')
                .style('font-size', '14px').style('font-weight', 'bold').style('fill', textColor) 
                .text((d) => getTranslatedName(d.data.name, d.data.type));

             el.append('text').attr('x', 0).attr('y', 48).attr('text-anchor', 'middle')
                .style('font-size', '10px').style('font-weight', 'bold')
                .style('fill', (d) => d.data.customColor || COMPONENT_CONFIG[d.data.type]?.color || '#94a3b8').style('opacity', 0.9)
                .text((d) => d.data.componentNumber || t.componentTypes[d.data.type] || d.data.type);

             el.append('text').attr('x', 0).attr('y', 62).attr('text-anchor', 'middle')
                .style('font-size', '11px').style('fill', secondaryTextColor)
                .text((d) => {
                    const specs = [];
                    if (d.data.amps) specs.push(`${d.data.amps}A`);
                    if (d.data.voltage) specs.push(`${d.data.voltage}V`);
                    if (d.data.kva) specs.push(`${d.data.kva}kVA`);
                    return specs.join(' | ');
                });
             
             let yOffset = 62;
             if (d.data.model) {
                yOffset += 14;
                el.append('text').attr('x', 0).attr('y', yOffset).attr('text-anchor', 'middle')
                    .style('font-size', '10px').style('font-style', 'italic').style('fill', secondaryTextColor).text(d.data.model);
             }
             const desc = getTranslatedDescription(d.data.description);
             if (desc) {
                yOffset += 14;
                 el.append('text').attr('x', 0).attr('y', yOffset).attr('text-anchor', 'middle')
                    .style('font-size', '10px').style('fill', secondaryTextColor).text(desc.length > 30 ? desc.substring(0, 28) + '...' : desc);
             }
        }
    });

    nodes.filter((d: ExtendedHierarchyNode) => !!(d.data.isCollapsed && d._children && d._children.length > 0))
         .append('circle').attr('r', 8)
         .attr('cx', (d: ExtendedHierarchyNode) => {
              const shape = d.data.shape || 'rectangle';
              return shape === 'rectangle' ? (orientation === 'horizontal' ? d.width : 0) : 35;
         })
         .attr('cy', (d: ExtendedHierarchyNode) => {
              const shape = d.data.shape || 'rectangle';
              return shape === 'rectangle' ? (orientation === 'horizontal' ? 0 : d.height) : 35;
         })
         .attr('fill', dotColor).attr('stroke', secondaryTextColor).attr('stroke-width', 1).style('pointer-events', 'none');
    
    nodes.filter((d: ExtendedHierarchyNode) => !!(d.data.isCollapsed && d._children && d._children.length > 0))
         .append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
         .attr('x', (d: ExtendedHierarchyNode) => {
             const shape = d.data.shape || 'rectangle';
             return shape === 'rectangle' ? (orientation === 'horizontal' ? d.width : 0) : 35;
         })
         .attr('y', (d: ExtendedHierarchyNode) => {
             const shape = d.data.shape || 'rectangle';
             return shape === 'rectangle' ? (orientation === 'horizontal' ? 0 : d.height) : 35;
         })
         .attr('fill', secondaryTextColor).style('font-size', '12px').style('font-weight', 'bold').text('+');


    const getBadgeBaseY = (d: ExtendedHierarchyNode) => { 
        if (d.data.shape && d.data.shape !== 'rectangle') return 35;
        const box = getRectBox(d); return box.y + box.h - 24; 
    };

    nodes.filter(d => !!d.data.hasMeter).append('g')
        .attr('transform', d => {
            if (d.data.shape && d.data.shape !== 'rectangle') return `translate(25, -35)`;
            return `translate(${getRectBox(d).x + 8}, ${getBadgeBaseY(d)})`
        })
        .call(g => {
             const textWidth = (d: any) => (d.data.meterNumber?.length || 0) * 8 + 10;
             const totalWidth = (d: any) => 24 + (d.data.meterNumber ? textWidth(d) : 0);
             g.append('rect').attr('height', 18).attr('width', totalWidth).attr('rx', 9)
                .attr('fill', isDark ? '#1e3a8a' : '#dbeafe').attr('stroke', '#3b82f6').attr('stroke-width', 0.5);
             g.append('path').attr('d', ICON_PATHS['speed']).attr('transform', 'translate(3, 3) scale(0.5)').attr('fill', '#3b82f6');
             g.append('text').attr('x', 20).attr('y', 9).attr('dominant-baseline', 'central').attr('text-anchor', 'start')
                .style('font-size', '9px').style('font-weight', 'bold').style('fill', '#3b82f6').style('direction', 'ltr')
                .text(d => d.data.meterNumber || '');
        });

    nodes.filter(d => !!d.data.hasGeneratorConnection).append('g')
        .attr('transform', function(d) {
             const textWidth = (d.data.generatorName?.length || 0) * 8 + 10;
             const totalWidth = 24 + (d.data.generatorName ? textWidth : 0);
             if (d.data.shape && d.data.shape !== 'rectangle') return `translate(-${totalWidth + 25}, -35)`;
             const box = getRectBox(d); const y = getBadgeBaseY(d);
             return `translate(${box.x + box.w - totalWidth - 8}, ${y})`;
        })
        .call(g => {
             const textWidth = (d: any) => (d.data.generatorName?.length || 0) * 8 + 10;
             const totalWidth = (d: any) => 24 + (d.data.generatorName ? textWidth(d) : 0);
             g.append('rect').attr('height', 18).attr('width', totalWidth).attr('rx', 9)
                .attr('fill', isDark ? '#7f1d1d' : '#fee2e2').attr('stroke', '#ef4444').attr('stroke-width', 0.5);
             g.append('path').attr('d', ICON_PATHS['letter_g']).attr('transform', 'translate(3, 3) scale(0.5)').attr('fill', '#ef4444');
             g.append('text').attr('x', 20).attr('y', 9).attr('dominant-baseline', 'central').attr('text-anchor', 'start')
                .style('font-size', '9px').style('font-weight', 'bold').style('fill', '#ef4444').style('direction', 'ltr')
                .text(d => d.data.generatorName || '');
        });

    nodes.append('g')
        .attr('class', 'action-buttons')
        .attr('transform', d => { 
            if (d.data.shape === 'circle' || d.data.shape === 'square') {
                return `translate(50, 0)`;
            }
            const box = getRectBox(d); return `translate(${box.x + box.w + 12}, ${box.y + box.h/2})`; 
        })
        .style('opacity', d => d.data.id === selectedNodeId ? 1 : 0)
        .style('pointer-events', d => d.data.id === selectedNodeId ? 'all' : 'none')
        .style('transition', 'opacity 0.2s')
        .call(g => {
            g.append('g').attr('transform', 'translate(0, -28)').style('cursor', 'pointer')
                .on('click', (e, d) => { e.stopPropagation(); onDuplicateChild(d.data); })
                .call(btn => {
                    btn.append('circle').attr('r', 10).attr('fill', '#2563eb').attr('stroke', '#1e40af').attr('stroke-width', 1);
                    btn.append('path').attr('d', ICON_PATHS['add']).attr('transform', 'translate(-8, -8) scale(0.66)').attr('fill', 'white');
                    btn.append('title').text(t.inputPanel.addConnection);
                });
            g.filter((d: any) => (d.children && d.children.length > 0) || (d._children && d._children.length > 0))
                .append('g').attr('transform', 'translate(0, 0)').style('cursor', 'pointer')
                .on('click', (e, d) => { e.stopPropagation(); onToggleCollapse(d.data); })
                .call(btn => {
                    btn.append('circle').attr('r', 10).attr('fill', '#475569').attr('stroke', '#334155').attr('stroke-width', 1);
                    btn.append('path').attr('d', d => ICON_PATHS[d.data.isCollapsed ? 'visibility_off' : 'visibility'])
                       .attr('transform', 'translate(-8, -8) scale(0.66)').attr('fill', 'white');
                    btn.append('title').text(d => d.data.isCollapsed ? t.inputPanel.expand : t.inputPanel.collapse);
                });
            g.filter(d => d.depth > 1).append('g').attr('transform', 'translate(0, 28)').style('cursor', 'pointer')
                .on('click', (e, d) => { e.stopPropagation(); onGroupNode(d.data); })
                .call(btn => {
                    btn.append('circle').attr('r', 10).attr('fill', '#eab308').attr('stroke', '#ca8a04').attr('stroke-width', 1);
                    btn.append('path').attr('d', ICON_PATHS['folder_open']).attr('transform', 'translate(-8, -8) scale(0.66)').attr('fill', 'white');
                    btn.append('title').text(t.inputPanel.groupNode);
                });
            g.append('g').attr('transform', 'translate(0, 56)').style('cursor', 'pointer')
                .on('click', (e, d) => { e.stopPropagation(); onDeleteNode(d.data); })
                .call(btn => {
                    btn.append('circle').attr('r', 10).attr('fill', '#ef4444').attr('stroke', '#b91c1c').attr('stroke-width', 1);
                    btn.append('path').attr('d', ICON_PATHS['delete']).attr('transform', 'translate(-8, -8) scale(0.66)').attr('fill', 'white');
                    btn.append('title').text(t.inputPanel.deleteComponent);
                });
        });

    // 2. Create Labels Group AFTER nodes (So text is on top)
    const labelsGroup = g.append('g').attr('class', 'labels');

    // --- Cable Size Labels (Rendered into labelsGroup) ---
    linksToRender.forEach((d: any) => {
        if (d.target.data.connectionStyle?.cableSize) {
             const source = d.source as any;
             const target = d.target as any;
             
             // Calculate coordinates including drag offsets
             const sXOffset = source.data.manualX || 0;
             const sYOffset = source.data.manualY || 0;
             const tXOffset = target.data.manualX || 0;
             const tYOffset = target.data.manualY || 0;
             
             let srcX, srcY, tgtX, tgtY;
             
             if (orientation === 'horizontal') {
                 srcX = source.y + source.width + sXOffset;
                 srcY = source.x + sYOffset;
                 tgtX = target.y + tXOffset;
                 tgtY = target.x + tYOffset;
             } else {
                 srcX = source.x + sXOffset;
                 srcY = source.y + source.height + sYOffset;
                 tgtX = target.x + tXOffset;
                 tgtY = target.y + tYOffset;
             }

             // Position Calculation
             let labelX, labelY;
             let rotation = 0;
             let textAnchor = 'middle';
             const offset = 25; // Space from node

             if (orientation === 'horizontal') {
                 labelX = tgtX - offset;
                 labelY = tgtY;
                 rotation = 0;
                 // RTL Support: Anchor text appropriately so it grows away from node
                 textAnchor = isRTL ? 'start' : 'end'; 
             } else {
                 labelX = tgtX;
                 labelY = tgtY - offset;
                 rotation = -90; 
                 // Vertical RTL Support
                 textAnchor = isRTL ? 'end' : 'start';
             }

             if (!isNaN(labelX) && !isNaN(labelY)) {
                 const labelGroup = labelsGroup.append('g')
                     .attr('transform', `translate(${labelX}, ${labelY}) rotate(${rotation})`)
                     .style('pointer-events', 'none');
                 
                 // Link Color for background
                 const style = d.target.data.connectionStyle || {};
                 const linkStroke = style.strokeColor || d.target.data.customColor || COMPONENT_CONFIG[d.target.data.type]?.color || linkColor;

                 // Background for text (rect) - initially empty, sized later
                 const bgRect = labelGroup.append('rect')
                     .attr('rx', 4)
                     .attr('fill', linkStroke)
                     .attr('stroke', isDark ? '#ffffff' : 'none')
                     .attr('stroke-width', 1)
                     .attr('opacity', 1);
                     
                 const text = labelGroup.append('text')
                     .attr('text-anchor', textAnchor)
                     .attr('dominant-baseline', 'middle')
                     .style('font-size', '10px')
                     .style('font-weight', 'bold')
                     .style('fill', '#ffffff') // White text
                     .text(d.target.data.connectionStyle.cableSize);
                     
                 // Adjust rect size based on text bounding box
                 const bbox = text.node()?.getBBox();
                 if (bbox) {
                     const padding = 3;
                     bgRect
                         .attr('x', bbox.x - padding)
                         .attr('y', bbox.y - padding)
                         .attr('width', bbox.width + (padding * 2))
                         .attr('height', bbox.height + (padding * 2));
                 }
             }
        }
    });

    // --- Visual Link Disconnect Icon (Rendered into labelsGroup) ---
    if (selectedLinkId) {
        const selectedLink = linksToRender.find(d => d.target.data.id === selectedLinkId) || extraLinksToRender.find(d => d.target.data.id === selectedLinkId);
        
        if (selectedLink) {
             const source = selectedLink.source as any;
             const target = selectedLink.target as any;
             
             const sXOffset = source.data.manualX || 0;
             const sYOffset = source.data.manualY || 0;
             const tXOffset = target.data.manualX || 0;
             const tYOffset = target.data.manualY || 0;
             
             let srcX, srcY, tgtX, tgtY;
             
             if (orientation === 'horizontal') {
                 srcX = source.y + source.width + sXOffset;
                 srcY = source.x + sYOffset;
                 tgtX = target.y + tXOffset;
                 tgtY = target.x + tYOffset;
             } else {
                 srcX = source.x + sXOffset;
                 srcY = source.y + source.height + sYOffset;
                 tgtX = target.x + tXOffset;
                 tgtY = target.y + tYOffset;
             }

             const midX = (srcX + tgtX) / 2;
             const midY = (srcY + tgtY) / 2;
             
             if (!isNaN(midX) && !isNaN(midY)) {
                 const btnGroup = labelsGroup.append('g')
                    .attr('class', 'link-delete-btn')
                    .attr('transform', `translate(${midX}, ${midY})`)
                    .style('cursor', 'pointer')
                    .on('click', (e) => {
                        e.stopPropagation();
                        if (onDisconnectLink) onDisconnectLink();
                    });
                 
                 btnGroup.append('circle')
                    .attr('r', 10)
                    .attr('fill', '#ef4444')
                    .attr('stroke', '#ffffff')
                    .attr('stroke-width', 2);
                 
                 btnGroup.append('path')
                    .attr('d', 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z') // Close icon
                    .attr('transform', 'translate(-12, -12) scale(1)') 
                    .attr('fill', 'white');
                 
                 btnGroup.append('title').text(t.inputPanel.disconnect);
             }
        }
    }

    // --- Calculate Dynamic Content Bounds ---
    const leaves = root.leaves();
    let maxY = 600;
    let maxX = 800;
    let minX = 0;
    let minY = 0;

    nodesToRender.forEach((d: any) => {
        const box = getRectBox(d);
        const offsetX = d.data.manualX || 0;
        const offsetY = d.data.manualY || 0;
        let absoluteX, absoluteY;
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

    // --- PRINT LAYOUT TITLE BLOCK ---
    if (isPrintMode && activeProject) {
        const metadata = activeProject.printMetadata || DEFAULT_PRINT_METADATA;
        const blockW = 500; // Fixed Width
        const blockH = 100; // Fixed Height
        const xStart = maxX + 40; 
        const yStart = maxY + 40 - blockH;

        const titleBlock = g.append('g')
            .attr('transform', `translate(${xStart}, ${yStart})`)
            .style('cursor', 'pointer');
            
        // Main Background (Captures general clicks)
        titleBlock.append('rect')
            .attr('width', blockW).attr('height', blockH)
            .attr('fill', isDark ? '#1e293b' : '#ffffff').attr('fill-opacity', 0.8)
            .attr('stroke', textColor).attr('stroke-width', 2)
            .style('pointer-events', 'all') 
            .on('click', function(e) {
                if (e.defaultPrevented) return;
                e.stopPropagation();
                if (onEditPrintSettings) onEditPrintSettings();
            });
        
        const dividerX = isRTL ? blockW * 0.35 : blockW * 0.65;
        const rowH = blockH / 3;

        // Lines
        titleBlock.append('line').attr('x1', dividerX).attr('y1', 0).attr('x2', dividerX).attr('y2', blockH)
            .attr('stroke', textColor).attr('stroke-width', 1).style('pointer-events', 'none');
        titleBlock.append('line').attr('x1', 0).attr('y1', rowH).attr('x2', blockW).attr('y2', rowH)
            .attr('stroke', textColor).attr('stroke-width', 1).style('pointer-events', 'none');
        titleBlock.append('line').attr('x1', 0).attr('y1', rowH*2).attr('x2', blockW).attr('y2', rowH*2)
            .attr('stroke', textColor).attr('stroke-width', 1).style('pointer-events', 'none');

        // Helper for text alignment
        let wideColX, narrowColX;
        if (isRTL) {
            narrowColX = dividerX / 2;
            wideColX = dividerX + ((blockW - dividerX) / 2);
        } else {
            wideColX = dividerX / 2;
            narrowColX = dividerX + ((blockW - dividerX) / 2);
        }

        const renderCell = (label: string, value: string, cx: number, cy: number, fieldKey: string) => {
             // Invisible hit area for cell
             const cellW = (fieldKey === 'projectName' || fieldKey === 'organization' || fieldKey === 'engineer') 
                ? (isRTL ? blockW - dividerX : dividerX) 
                : (isRTL ? dividerX : blockW - dividerX);
             
             // Approximate x/y for hit rect
             let rx = 0;
             if (isRTL) {
                rx = (fieldKey === 'projectName' || fieldKey === 'organization' || fieldKey === 'engineer') ? dividerX : 0;
             } else {
                rx = (fieldKey === 'projectName' || fieldKey === 'organization' || fieldKey === 'engineer') ? 0 : dividerX;
             }

             // Append click handler rect for this cell
             titleBlock.append('rect')
                .attr('x', rx).attr('y', cy - 10) // Adjust y to match row start roughly
                .attr('width', cellW).attr('height', rowH)
                .attr('fill', 'white').attr('fill-opacity', 0.01) // Nearly transparent for reliable hit testing
                .style('cursor', 'pointer')
                .style('pointer-events', 'all')
                .on('click', (e) => {
                    if (e.defaultPrevented) return;
                    e.stopPropagation();
                    if (onEditPrintSettings) onEditPrintSettings(fieldKey);
                })
                .append('title').text(`Edit ${label}`);

             titleBlock.append('text')
                .attr('x', cx).attr('y', cy)
                .text(label)
                .attr('fill', textColor).attr('font-size', '9px').attr('font-weight', 'bold')
                .attr('text-anchor', 'middle') .style('opacity', 0.7)
                .style('pointer-events', 'none');
             
             titleBlock.append('text')
                .attr('x', cx).attr('y', cy + 14)
                .text(value)
                .attr('fill', textColor).attr('font-size', '13px')
                .attr('text-anchor', 'middle')
                .style('pointer-events', 'none');
        };

        const yOffset = 10;
        
        // Row 1
        renderCell(t.printLayout.project, activeProject.name, wideColX, yOffset, 'projectName');
        renderCell(t.printLayout.date, metadata.date, narrowColX, yOffset, 'date');

        // Row 2
        renderCell(t.printLayout.org, metadata.organization, wideColX, rowH + yOffset, 'organization');
        renderCell(t.printLayout.rev, metadata.revision, narrowColX, rowH + yOffset, 'revision');

        // Row 3
        renderCell(t.printLayout.engineer, metadata.engineer, wideColX, rowH*2 + yOffset, 'engineer');
        renderCell(t.printLayout.approved, metadata.approvedBy, narrowColX, rowH*2 + yOffset, 'approvedBy');

        titleBlock.on('mouseenter', function() {
            d3.select(this).select('rect').attr('stroke', '#3b82f6').attr('stroke-width', 3);
        }).on('mouseleave', function() {
            d3.select(this).select('rect').attr('stroke', textColor).attr('stroke-width', 2);
        });
    }

    // --- COMPONENT LEGEND ---
    const types = Object.values(ComponentType);
    const legendW = 200; 
    const legendH = 50 + types.length * 25; 
    
    let legX, legY;

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

    const legendG = g.append('g')
        .attr('class', 'legend-group')
        .attr('transform', `translate(${legX}, ${legY})`); 

    legendG.append('rect')
        .attr('width', legendW)
        .attr('height', legendH)
        .attr('rx', 8)
        .attr('fill', isDark ? '#1e293b' : '#ffffff') 
        .attr('stroke', secondaryTextColor)
        .attr('stroke-width', 1)
        .attr('opacity', 0.95);

    legendG.append('text')
        .attr('x', legendW / 2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .attr('fill', textColor)
        .attr('font-size', '12px')
        .text(t.legend.title);

    types.forEach((type, i) => {
        const y = 50 + i * 25;
        const config = COMPONENT_CONFIG[type];
        
        let iconX, textX, textAnchor;
        
        if (isRTL) {
            iconX = legendW - 25;
            textX = legendW / 2;
            textAnchor = 'middle';
        } else {
            iconX = 25;
            textX = 45;
            textAnchor = 'start';
        }

        legendG.append('circle')
            .attr('cx', iconX)
            .attr('cy', y)
            .attr('r', 8)
            .attr('fill', isDark ? '#0f172a' : '#f8fafc')
            .attr('stroke', config.color)
            .attr('stroke-width', 1.5);
        
        legendG.append('path')
            .attr('d', ICON_PATHS[config.icon])
            .attr('transform', `translate(${iconX - 6}, ${y - 6}) scale(0.5)`) 
            .attr('fill', config.color);
            
        legendG.append('text')
            .attr('x', textX) 
            .attr('y', y) // Align with icon center
            .attr('dominant-baseline', 'middle') // Vertical centering
            .attr('fill', textColor)
            .attr('font-size', '11px')
            .attr('text-anchor', textAnchor as any) 
            .text(t.componentTypes[type]);
    });

  }, [data, dimensions, onNodeClick, onLinkClick, selectedNodeId, selectedLinkId, orientation, searchMatches, isConnectMode, connectionSourceId, t, language, theme, onBackgroundClick, multiSelection, isPrintMode, activeProject, onEditPrintSettings]);

  return (
    <div ref={wrapperRef} className={`w-full h-full relative overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-white'}`} style={{ touchAction: 'none' }}>
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