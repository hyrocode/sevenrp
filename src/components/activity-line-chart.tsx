import React, { useId, useState } from "react";

interface ActivityLineChartProps {
  data: number[];
  className?: string;
}

export function ActivityLineChart({ data, className }: ActivityLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  // 12 pontos horários (-11h até agora)
  const pointsData = data && data.length === 12 ? data : Array.from({ length: 12 }, () => 0);
  const peak = Math.max(1, ...pointsData);
  const totalEvents = pointsData.reduce((acc, val) => acc + val, 0);

  // Dimensões SVG
  const width = 600;
  const height = 180;
  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 28;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Coordenadas dos pontos
  const coords = pointsData.map((val, idx) => {
    const x = paddingLeft + (idx / (pointsData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (val / peak) * chartHeight;
    return { x, y, val, idx };
  });

  // Geração da curva suave de Bezier cúbico (Spline natural)
  function getSplinePath(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) return "";
    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  }

  const linePath = getSplinePath(coords);
  const lastX = coords[coords.length - 1]?.x ?? width;
  const firstX = coords[0]?.x ?? paddingLeft;
  const bottomY = paddingTop + chartHeight;
  const areaPath = `${linePath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

  // Linhas horizontais de referência (0%, 50%, 100%)
  const gridLevels = [
    { label: String(peak), y: paddingTop },
    { label: String(Math.round(peak / 2)), y: paddingTop + chartHeight / 2 },
    { label: "0", y: bottomY },
  ];

  const timeLabels = [
    { label: "-12h", idx: 0 },
    { label: "-9h", idx: 3 },
    { label: "-6h", idx: 6 },
    { label: "-3h", idx: 9 },
    { label: "Agora", idx: 11 },
  ];

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    let closestIndex = 0;
    let minDistance = Infinity;

    coords.forEach((pt, i) => {
      const dist = Math.abs(pt.x - relativeX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    });
    setHoverIndex(closestIndex);
  }

  function handlePointerLeave() {
    setHoverIndex(null);
  }

  const activePoint = hoverIndex !== null ? coords[hoverIndex] : null;
  const hoursAgo = activePoint ? (11 - activePoint.idx) : 0;
  const hourText = hoursAgo === 0 ? "Nesta hora" : `Há ${hoursAgo} hora${hoursAgo > 1 ? "s" : ""}`;

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      {/* Header Resumo da Métrica */}
      <div className="mb-3 flex items-center justify-between border-b border-white/[0.05] pb-2.5">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Total 12h
            </span>
            <p className="text-sm font-semibold text-zinc-100">
              {totalEvents} <span className="text-xs font-normal text-zinc-400">eventos</span>
            </p>
          </div>
          <div className="h-6 w-px bg-white/[0.06]" />
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Pico Horário
            </span>
            <p className="text-sm font-semibold text-purple-300">
              {peak} <span className="text-xs font-normal text-zinc-400">eventos/h</span>
            </p>
          </div>
        </div>

        {activePoint && (
          <div className="flex items-center gap-2 rounded-md border border-purple-500/30 bg-[#151724] px-2.5 py-1 text-xs">
            <span className="size-1.5 rounded-full bg-purple-400" />
            <span className="font-semibold text-white">{activePoint.val} eventos</span>
            <span className="text-[11px] text-zinc-400">({hourText})</span>
          </div>
        )}
      </div>

      {/* SVG Line Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 select-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.32" />
              <stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade Horizontais */}
          {gridLevels.map((lvl, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={lvl.y}
                x2={width - paddingRight}
                y2={lvl.y}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 6}
                y={lvl.y + 3}
                fill="#71717A"
                fontSize="9"
                fontFamily="inherit"
                textAnchor="end"
              >
                {lvl.label}
              </text>
            </g>
          ))}

          {/* Área Gradiente Sombreada */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Linha Curva Contínua */}
          <path
            d={linePath}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Linha de Referência Vertical no Hover */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={bottomY}
                stroke="rgba(167, 139, 250, 0.45)"
                strokeDasharray="2 2"
                strokeWidth="1.2"
              />
              {/* Outer Glow Halo */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7"
                fill="rgba(139, 92, 246, 0.25)"
              />
              {/* Inner Circle Dot */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="3.5"
                fill="#7C3AED"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Rótulos do Eixo X */}
          {timeLabels.map((item, i) => {
            const pt = coords[item.idx];
            return (
              <text
                key={i}
                x={pt.x}
                y={height - 6}
                fill="#71717A"
                fontSize="9.5"
                fontWeight="500"
                fontFamily="inherit"
                textAnchor={i === 0 ? "start" : i === timeLabels.length - 1 ? "end" : "middle"}
              >
                {item.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
