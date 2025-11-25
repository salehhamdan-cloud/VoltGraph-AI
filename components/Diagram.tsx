
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ElectricalNode, ComponentType } from '../types';
import { COMPONENT_CONFIG, ICON_PATHS } from '../constants';

interface DiagramProps {
  data: ElectricalNode[];
  onNodeClick: (node: ElectricalNode) => void;
  onLinkClick: (targetNode: ElectricalNode) => void;
  onDuplicateChild: (node: ElectricalNode) => void;
  onDeleteNode: (node: ElectricalNode) => void;
  onToggleCollapse: (node: ElectricalNode) => void;
  onGroupNode: (node: ElectricalNode) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onAddRoot?: () => void;
  onAddGenerator?: () => void;
  onBackgroundClick?: () => void;
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  orientation: 'horizontal' | 'vertical';
  searchMatches: Set<string> | null;
  isConnectMode?: boolean;
  connectionSourceId?: string | null;
  t: any;
  language: string;
  theme: 'light' | 'dark';
}

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
    selectedLinkId,
    orientation,
    searchMatches,
    isConnectMode = false,
    connectionSourceId = null,
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

  // Theme Colors
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
    
    svg.on("click", (event) => {
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
    
    // Markers
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

    // --- Dynamic Sizing with Badge Overlap Protection ---
    const getNodeSize = (d: d3.HierarchyNode<ElectricalNode>) => {
        if (d.data.id === 'virtual-root') return { w: 1, h: 1 };

        const displayName = getTranslatedName(d.data.name, d.data.type);
        const compNum = d.data.componentNumber || t.componentTypes[d.data.type] || d.data.type;
        const model = d.data.model || '';
        const desc = getTranslatedDescription(d.data.description);
        
        let specText = "";
        if (d.data.amps) specText += `${d.data.amps}A`;
        if (d.data.voltage) specText += `${d.data.voltage}V`;
        if (d.data.kva) specText += `${d.data.kva}kVA`;
        
        // Character width estimation
        const charWidth = 8.5;
        const nameLen = (displayName?.length || 0) * charWidth; 
        const typeLen = (compNum?.length || 0) * 7.5;
        const specLen = specText.length * 7.5;
        const modelLen = model.length * 7;
        const descLen = Math.min(desc.length * 7, 220);

        // Calculate Badge Widths to prevent overlap
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
            badgeWidth += 30; // Spacing between badges if both exist
        }

        // Ensure node is wide enough for text AND badges
        const contentWidth = Math.max(nameLen, typeLen, specLen, modelLen, descLen, badgeWidth, 90); 
        const nodeW = contentWidth + 30; 

        // Height Calculation
        let contentHeight = 25; 
        contentHeight += 24; // Name
        contentHeight += 16; // Number
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
        const depthSpacing = 200;
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

    const nodesToRender = root.descendants().filter(d => d.depth > 0);
    const linksToRender = root.links().filter(d => d.source.data.id !== 'virtual-root');

    const nodeLookup = new Map<string, d3.HierarchyNode<ElectricalNode>>();
    nodesToRender.forEach(d => nodeLookup.set(d.data.id, d));

    const drag = d3.drag<SVGGElement, d3.HierarchyNode<ElectricalNode>>()
        .filter((event, d) => d.depth === 1) 
        .on("start", function(event, d) {
             (this as any).__isDragging = false;
             (this as any).__totalDx = 0;
             (this as any).__totalDy = 0;
             d3.select(this).attr("data-is-dragging", "false");
        })
        .on("drag", function(event, d) {
             (this as any).__totalDx += event.dx;
             (this as any).__totalDy += event.dy;
             const distSq = (this as any).__totalDx * (this as any).__totalDx + (this as any).__totalDy * (this as any).__totalDy;
             if (distSq > 25) {
                 (this as any).__isDragging = true;
                 d3.select(this).attr("data-is-dragging", "true");
                 d3.select(this).classed("active", true).raise();
             }
             if ((this as any).__isDragging) {
                 if (orientation === 'horizontal') {
                     d.data.manualX = (d.data.manualX || 0) + event.dx; 
                     d.data.manualY = (d.data.manualY || 0) + event.dy;
                     d3.select(this).attr("transform", `translate(${d.y + (d.data.manualX || 0)},${d.x + (d.data.manualY || 0)})`);
                 } else {
                     d.data.manualX = (d.data.manualX || 0) + event.dx;
                     d.data.manualY = (d.data.manualY || 0) + event.dy;
                     d3.select(this).attr("transform", `translate(${d.x + (d.data.manualX || 0)},${d.y + (d.data.manualY || 0)})`);
                 }
             }
        })
        .on("end", function(event, d) {
            if ((this as any).__isDragging) {
                d3.select(this).classed("active", false);
                d3.select(this).attr("data-is-dragging", null);
                if (onNodeMove) onNodeMove(d.data.id, d.data.manualX || 0, d.data.manualY || 0);
            }
        });

    const extraLinksToRender: { source: d3.HierarchyNode<ElectricalNode>; target: d3.HierarchyNode<ElectricalNode>; }[] = [];
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

    // --- ALIGNMENT LOGIC (Fix for "same top line") ---
    const getRectBox = (d: any) => {
        const w = d.width;
        const h = d.height;
        if (orientation === 'horizontal') {
            // Horizontal: Left-Aligned. Anchor (y, x) corresponds to (Left, MiddleY).
            // Box starts at x=0 relative to anchor.
            // Box centered vertically relative to anchor.
            return { x: 0, y: -h/2, w, h };
        } else {
            // Vertical: Top-Aligned. Anchor (x, y) corresponds to (MiddleX, Top).
            // Box starts at y=0 relative to anchor.
            // Box centered horizontally relative to anchor.
            return { x: -w/2, y: 0, w, h };
        }
    };

    const linkGenerator = (source: any, target: any) => {
        const sXOffset = source.data.manualX || 0;
        const sYOffset = source.data.manualY || 0;
        const tXOffset = target.data.manualX || 0;
        const tYOffset = target.data.manualY || 0;

        if (orientation === 'horizontal') {
            // Source (Parent) exits at Right Edge
            const srcX = source.y + source.width + sXOffset;
            const srcY = source.x + sYOffset;

            // Target (Child) enters at Left Edge
            const tgtX = target.y + tXOffset;
            const tgtY = target.x + tYOffset;

            return `M${srcX},${srcY}
                    H${(srcX + tgtX) / 2}
                    V${tgtY}
                    H${tgtX}`;
        } else {
            // Source (Parent) exits at Bottom
            const srcX = source.x + sXOffset;
            const srcY = source.y + source.height + sYOffset;

            // Target (Child) enters at Top
            const tgtX = target.x + tXOffset;
            const tgtY = target.y + tYOffset;
            
            return `M${srcX},${srcY}
                    V${(srcY + tgtY) / 2}
                    H${tgtX}
                    V${tgtY}`;
        }
    };

    const linksGroup = g.append('g').attr('class', 'links');

    const renderLinks = (selection: any, className: string, isHitArea = false) => {
        selection
          .attr('class', className)
          .attr('d', (d: any) => linkGenerator(d.source, d.target))
          .attr('fill', 'none')
          .each(function(d: any) {
              if (isHitArea) return;
              const style = d.target.data.connectionStyle || {};
              const stroke = style.strokeColor || d.target.data.customColor || COMPONENT_CONFIG[d.target.data.type]?.color || linkColor; 
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

    linksGroup.selectAll('path.link-visible').data(linksToRender).enter().append('path').call(renderLinks, 'link-visible');
    linksGroup.selectAll('path.link-extra').data(extraLinksToRender).enter().append('path').call(renderLinks, 'link-extra');
    linksGroup.selectAll('path.link-hit').data(linksToRender).enter().append('path')
        .attr('class', 'link-hit')
        .attr('d', d => linkGenerator(d.source, d.target))
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 15)
        .style('cursor', 'pointer')
        .on('click', (e, d) => { e.stopPropagation(); onLinkClick(d.target.data); });

    const nodes = g.selectAll('g.node')
      .data(nodesToRender)
      .enter()
      .append('g')
      .attr('class', (d) => `node group ${d.data.id === selectedNodeId ? 'selected' : ''}`)
      .attr('transform', (d) => {
          const offsetX = d.data.manualX || 0;
          const offsetY = d.data.manualY || 0;
          return orientation === 'horizontal' 
            ? `translate(${d.y + offsetX},${d.x + offsetY})` 
            : `translate(${d.x + offsetX},${d.y + offsetY})`;
      })
      .call(drag as any)
      .on('click', function(event, d) {
        if ((this as any).__isDragging) { event.stopPropagation(); return; }
        if (event.defaultPrevented) return;
        event.stopPropagation();
        onNodeClick(d.data);
      })
      .on('mouseenter', function(event, d) {
          const isSelected = d.data.id === selectedNodeId;
          const isSource = d.data.id === connectionSourceId;
          const el = d3.select(this);
          if (d.depth === 1) el.style('cursor', 'move');
          el.select('.action-buttons').style('opacity', 1).style('pointer-events', 'all');
          el.select('rect.node-bg').transition().duration(200)
            .attr('fill', isDark ? '#334155' : '#e2e8f0')
            .attr('stroke', isSource ? '#f59e0b' : (isSelected ? '#3b82f6' : '#64748b'));
      })
      .on('mouseleave', function(event, d) {
          const isSelected = d.data.id === selectedNodeId;
          const isSource = d.data.id === connectionSourceId;
          const el = d3.select(this);
          if (!isSelected) el.select('.action-buttons').style('opacity', 0).style('pointer-events', 'none');
          el.select('rect.node-bg').transition().duration(200)
            .attr('fill', (d: any) => d.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor)
            .attr('stroke', isSource ? '#f59e0b' : (isSelected ? '#3b82f6' : secondaryTextColor));
      })
      .style('cursor', (d) => d.depth === 1 ? 'move' : (isConnectMode ? 'crosshair' : 'pointer'))
      .style('opacity', (d) => {
         if (!searchMatches) return 1;
         if (searchMatches.has(d.data.id)) return 1;
         if (d.parent && d.parent.data.id !== 'virtual-root' && searchMatches.has(d.parent.data.id)) return 1;
         if (d.children && d.children.some(c => searchMatches.has(c.data.id))) return 1;
         if ((d as any)._children && (d as any)._children.some((c: any) => searchMatches.has(c.data.id))) return 1;
         return 0.2;
      });

    nodes.append('rect')
      .attr('class', 'node-bg')
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('x', d => getRectBox(d).x)
      .attr('y', d => getRectBox(d).y)
      .attr('rx', 12)
      .attr('fill', (d) => d.data.type === ComponentType.SYSTEM_ROOT ? rootNodeBgColor : nodeBgColor)
      .attr('stroke', (d) => {
          if (d.data.id === connectionSourceId) return '#f59e0b'; 
          if (d.data.id === selectedNodeId) return '#3b82f6'; 
          return d.data.type === ComponentType.SYSTEM_ROOT ? '#64748b' : secondaryTextColor;
      })
      .attr('stroke-width', (d) => (d.data.id === selectedNodeId || d.data.id === connectionSourceId) ? 3 : 1.5)
      .style('filter', (d) => (d.data.id === selectedNodeId || d.data.id === connectionSourceId) ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');

    nodes.filter((d: any) => d.data.isCollapsed && d._children && d._children.length > 0)
         .append('circle')
         .attr('r', 8)
         .attr('cx', d => orientation === 'horizontal' ? d.width : 0)
         .attr('cy', d => orientation === 'horizontal' ? 0 : d.height)
         .attr('fill', dotColor)
         .attr('stroke', secondaryTextColor)
         .attr('stroke-width', 1)
         .style('pointer-events', 'none');
    
    nodes.filter((d: any) => d.data.isCollapsed && d._children && d._children.length > 0)
         .append('text')
         .attr('text-anchor', 'middle')
         .attr('dominant-baseline', 'central')
         .attr('x', d => orientation === 'horizontal' ? d.width : 0)
         .attr('y', d => orientation === 'horizontal' ? 0 : d.height)
         .attr('fill', secondaryTextColor)
         .style('font-size', '12px')
         .style('font-weight', 'bold')
         .text('+');

    // Color Bar
    nodes.append('path')
      .attr('d', d => {
          const r = 12;
          const box = getRectBox(d);
          return `M${box.x},${box.y + 6} v${-6 + r} a${r},${r} 0 0 1 ${r},${-r} h${box.w - 2*r} a${r},${r} 0 0 1 ${r},${r} v${6 - r}`;
      })
      .attr('fill', (d) => d.data.customColor || COMPONENT_CONFIG[d.data.type]?.color || '#94a3b8');

    // Content Group
    const contentG = nodes.append('g')
        .attr('transform', d => {
            const box = getRectBox(d);
            // Content starts ~25px below the top edge
            if (orientation === 'horizontal') {
                return `translate(${d.width/2}, ${box.y + 25})`;
            } else {
                return `translate(0, ${box.y + 25})`;
            }
        });

    contentG.append('circle')
        .attr('r', 16).attr('cx', 0).attr('cy', 0)
        .attr('fill', isDark ? '#1e293b' : '#ffffff')
        .attr('stroke', (d) => d.data.customColor || COMPONENT_CONFIG[d.data.type]?.color || '#94a3b8')
        .attr('stroke-width', 1.5);

    contentG.append('path')
        .attr('d', d => ICON_PATHS[COMPONENT_CONFIG[d.data.type]?.icon] || ICON_PATHS['help'])
        .attr('transform', 'translate(-9, -9) scale(0.75)') 
        .attr('fill', (d) => d.data.customColor || COMPONENT_CONFIG[d.data.type]?.color || '#94a3b8');

    // Name
    contentG.append('text').attr('x', 0).attr('y', 32).attr('text-anchor', 'middle')
      .style('font-size', '14px').style('font-weight', 'bold').style('fill', textColor) 
      .text((d) => getTranslatedName(d.data.name, d.data.type));

    // Number/Type
    contentG.append('text').attr('x', 0).attr('y', 48).attr('text-anchor', 'middle')
      .style('font-size', '10px').style('font-weight', 'bold')
      .style('fill', (d) => d.data.customColor || COMPONENT_CONFIG[d.data.type]?.color || '#94a3b8').style('opacity', 0.9)
      .text((d) => d.data.componentNumber || t.componentTypes[d.data.type] || d.data.type);

    // Specs
    contentG.append('text').attr('x', 0).attr('y', 62).attr('text-anchor', 'middle')
      .style('font-size', '11px').style('fill', secondaryTextColor)
      .text((d) => {
         const specs = [];
         if (d.data.amps) specs.push(`${d.data.amps}A`);
         if (d.data.voltage) specs.push(`${d.data.voltage}V`);
         if (d.data.kva) specs.push(`${d.data.kva}kVA`);
         return specs.join(' | ');
      });
    
    contentG.each(function(d) {
        let yOffset = 62;
        const g = d3.select(this);
        if (d.data.model) {
            yOffset += 14;
            g.append('text').attr('x', 0).attr('y', yOffset).attr('text-anchor', 'middle')
                .style('font-size', '10px').style('font-style', 'italic').style('fill', secondaryTextColor).text(d.data.model);
        }
        const desc = getTranslatedDescription(d.data.description);
        if (desc) {
            yOffset += 14;
             g.append('text').attr('x', 0).attr('y', yOffset).attr('text-anchor', 'middle')
                .style('font-size', '10px').style('fill', secondaryTextColor).text(desc.length > 30 ? desc.substring(0, 28) + '...' : desc);
        }
    });

    // --- Badge Helper ---
    const getBadgeBaseY = (d: any) => {
        const box = getRectBox(d);
        // Place near bottom of rect
        return box.y + box.h - 24; 
    };

    // Meter Badge
    nodes.filter(d => !!d.data.hasMeter)
        .append('g')
        .attr('transform', d => {
             const box = getRectBox(d);
             const y = getBadgeBaseY(d);
             // Place at left side (+padding)
             return `translate(${box.x + 8}, ${y})`;
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
             g.append('title').text(d => d.data.meterNumber ? `${t.legend.meter}: ${d.data.meterNumber}` : t.legend.meter);
        });

    // Generator Badge
    nodes.filter(d => !!d.data.hasGeneratorConnection)
        .append('g')
        .attr('transform', function(d) {
             const box = getRectBox(d);
             const y = getBadgeBaseY(d);
             const textWidth = (d.data.generatorName?.length || 0) * 8 + 10;
             const totalWidth = 24 + (d.data.generatorName ? textWidth : 0);
             // Place at right side (-padding)
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
             g.append('title').text(d => d.data.generatorName ? `${t.inputPanel.includesGenerator}: ${d.data.generatorName}` : t.inputPanel.includesGenerator);
        });

    // Action Buttons
    nodes.append('g')
        .attr('class', 'action-buttons')
        .attr('transform', d => {
            const box = getRectBox(d);
            // Position outside to the right
            return `translate(${box.x + box.w + 12}, ${box.y + box.h/2})`;
        })
        .style('opacity', d => d.data.id === selectedNodeId ? 1 : 0)
        .style('pointer-events', d => d.data.id === selectedNodeId ? 'all' : 'none')
        .style('transition', 'opacity 0.2s')
        .call(g => {
            // Add
            g.append('g').attr('transform', 'translate(0, -28)').style('cursor', 'pointer')
                .on('click', (e, d) => { e.stopPropagation(); onDuplicateChild(d.data); })
                .call(btn => {
                    btn.append('circle').attr('r', 10).attr('fill', '#2563eb').attr('stroke', '#1e40af').attr('stroke-width', 1);
                    btn.append('path').attr('d', ICON_PATHS['add']).attr('transform', 'translate(-8, -8) scale(0.66)').attr('fill', 'white');
                    btn.append('title').text(t.inputPanel.addConnection);
                });
            
            // Collapse
            g.filter((d: any) => (d.children && d.children.length > 0) || (d._children && d._children.length > 0))
                .append('g').attr('transform', 'translate(0, 0)').style('cursor', 'pointer')
                .on('click', (e, d) => { e.stopPropagation(); onToggleCollapse(d.data); })
                .call(btn => {
                    btn.append('circle').attr('r', 10).attr('fill', '#475569').attr('stroke', '#334155').attr('stroke-width', 1);
                    btn.append('path').attr('d', d => ICON_PATHS[d.data.isCollapsed ? 'visibility_off' : 'visibility'])
                       .attr('transform', 'translate(-8, -8) scale(0.66)').attr('fill', 'white');
                    btn.append('title').text(d => d.data.isCollapsed ? t.inputPanel.expand : t.inputPanel.collapse);
                });

            // Group
            g.filter(d => d.depth > 1).append('g').attr('transform', 'translate(0, 28)').style('cursor', 'pointer')
                .on('click', (e, d) => { e.stopPropagation(); onGroupNode(d.data); })
                .call(btn => {
                    btn.append('circle').attr('r', 10).attr('fill', '#eab308').attr('stroke', '#ca8a04').attr('stroke-width', 1);
                    btn.append('path').attr('d', ICON_PATHS['folder_open']).attr('transform', 'translate(-8, -8) scale(0.66)').attr('fill', 'white');
                    btn.append('title').text(t.inputPanel.groupNode);
                });

            // Delete
            g.append('g').attr('transform', 'translate(0, 56)').style('cursor', 'pointer')
                .on('click', (e, d) => { e.stopPropagation(); onDeleteNode(d.data); })
                .call(btn => {
                    btn.append('circle').attr('r', 10).attr('fill', '#ef4444').attr('stroke', '#b91c1c').attr('stroke-width', 1);
                    btn.append('path').attr('d', ICON_PATHS['delete']).attr('transform', 'translate(-8, -8) scale(0.66)').attr('fill', 'white');
                    btn.append('title').text(t.inputPanel.deleteComponent);
                });
        });

  }, [data, dimensions, onNodeClick, onLinkClick, selectedNodeId, selectedLinkId, orientation, searchMatches, isConnectMode, connectionSourceId, t, language, theme, onBackgroundClick]);

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
