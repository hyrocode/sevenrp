import React, { useId, useState } from "react";

interface ActivityLineChartProps {
  data: number[];
  className?: string;
}

/**
 * Gráfico de Linhas Monotônico (Fritsch-Carlson) com interpolação cúbica suave
 * e garantia matemática de que a curva nunca oscila abaixo de zero nem ultrapassa picos.
 */
function getMonotonePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  const n = points.length;
  const dxs: number[] = [];
  const dys: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs.push(dx);
    dys.push(dy);
    slopes.push(dx === 0 ? 0 : dy / dx);
  }

  const tangents: number[] = [slopes[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents.push(0);
    } else {
      tangents.push((slopes[i - 1] + slopes[i]) / 2);
    }
  }
  tangents.push(slopes[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (dys[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / slopes[i];
      const beta = tangents[i + 1] / slopes[i];
      const s = alpha * alpha + beta * beta;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        tangents[i] = tau * alpha * slopes[i];
        tangents[i + 1] = tau * beta * slopes[i];
      }
    }
  }

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = dxs[i];
    const cp1x = p1.x + dx / 3;
    const cp1y = p1.y + (tangents[i] * dx) / 3;
    const cp2x = p2.x - dx / 3;
    const cp2y = p2.y - (tangents[i + 1] * dx) / 3;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return path;
}

export function ActivityLineChart({ data, className }: ActivityLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  // 12 pontos horários (-11h até agora)
  const pointsData = data && data.length === 12 ? data : Array.from({ length: 12 }, () => 0);
  const rawPeak = Math.max(...pointsData);
  const peak = Math.max(1, rawPeak);
  const totalEvents = pointsData.reduce((acc, val) => acc + val, 0);
  const averageHourly = Math.round(totalEvents / pointsData.length);

  // Dimensões SVG perfeitamente calibradas
  const width = 640;
  const height = 180;
  const paddingLeft = 42;
  const paddingRight = 18;
  const paddingTop = 16;
  const paddingBottom = 26;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const bottomY = paddingTop + chartHeight;

  // Coordenadas calculadas
  const coords = pointsData.map((val, idx) => {
    const x = paddingLeft + (idx / (pointsData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (val / peak) * chartHeight;
    return { x, y, val, idx };
  });

  const linePath = getMonotonePath(coords);
  const lastX = coords[coords.length - 1]?.x ?? (width - paddingRight);
  const firstX = coords[0]?.x ?? paddingLeft;
  const areaPath = `${linePath} L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`;

  // Linhas horizontais de referência (0, metade, pico)
  const halfValue = Math.round(peak / 2);
  const gridLevels = [
    { label: String(peak), y: paddingTop },
    { label: String(halfValue), y: paddingTop + chartHeight / 2 },
    { label: "0", y: bottomY },
  ];

  const timeLabels = [
    { label: "-11h", idx: 0 },
    { label: "-8h", idx: 3 },
    { label: "-5h", idx: 6 },
    { label: "-2h", idx: 9 },
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
  const hoursAgo = activePoint ? 11 - activePoint.idx : 0;
  const hourText = hoursAgo === 0 ? "Agora (últimos 60 min)" : `Há ${hoursAgo}h atrás`;

  return (
    <div className={`relative flex flex-col justify-between h-full w-full ${className ?? ""}`}>
      {/* Header com Estatísticas Alinhadas */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] pb-2.5">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Total 12h
            </span>
            <p className="text-sm font-semibold text-zinc-100">
              {totalEvents.toLocaleString("pt-BR")}{" "}
              <span className="text-xs font-normal text-zinc-400">eventos</span>
            </p>
          </div>
          <div className="h-6 w-px bg-white/[0.07]" />
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Pico Horário
            </span>
            <p className="text-sm font-semibold text-purple-300">
              {rawPeak.toLocaleString("pt-BR")}{" "}
              <span className="text-xs font-normal text-zinc-400">eventos/h</span>
            </p>
          </div>
          <div className="h-6 w-px bg-white/[0.07]" />
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Média
            </span>
            <p className="text-sm font-semibold text-zinc-300">
              ~{averageHourly.toLocaleString("pt-BR")}{" "}
              <span className="text-xs font-normal text-zinc-400">eventos/h</span>
            </p>
          </div>
        </div>

        {activePoint ? (
          <div className="flex items-center gap-2 rounded-md border border-purple-500/30 bg-[#141724] px-2.5 py-1 text-xs">
            <span className="size-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="font-semibold text-white">{activePoint.val} eventos</span>
            <span className="text-[11px] text-zinc-400">({hourText})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span>Fluxo Contínuo • Passe o mouse para inspecionar</span>
          </div>
        )}
      </div>

      {/* Área do Gráfico SVG Monotônico */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 select-none overflow-visible cursor-crosshair"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#7C3AED" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
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
                x={paddingLeft - 8}
                y={lvl.y + 3.5}
                fill="#71717A"
                fontSize="9.5"
                fontFamily="inherit"
                fontWeight="500"
                textAnchor="end"
              >
                {lvl.label}
              </text>
            </g>
          ))}

          {/* Área Gradiente Preenchida */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Linha Curva Monotônica Sem Overshoot */}
          <path
            d={linePath}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Pontos de dados sutis ao longo da linha */}
          {coords.map((pt) => {
            const isHovered = hoverIndex === pt.idx;
            return (
              <circle
                key={pt.idx}
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 4.5 : 2}
                fill={isHovered ? "#C4B5FD" : "#8B5CF6"}
                stroke="#0A0C10"
                strokeWidth={isHovered ? 2 : 1}
                className="transition-all duration-150"
              />
            );
          })}

          {/* Indicador no Hover */}
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
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7"
                fill="rgba(139, 92, 246, 0.25)"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="3.5"
                fill="#8B5CF6"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Rótulos de Tempo no Eixo X */}
          {timeLabels.map((item, i) => {
            const pt = coords[item.idx];
            return (
              <text
                key={i}
                x={pt.x}
                y={height - 4}
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
