import React, { useId, useState } from "react";

interface ActivityLineChartProps {
  data: number[];
  className?: string;
}

/**
 * Gráfico de Linhas Monotônico (Fritsch-Carlson)
 * Garante uma curva perfeitamente suave sem oscilações artificiais ou quebras.
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
  const pointsData = data && data.length === 12 ? data : Array.from({ length: 12 }, () => 24);
  const rawPeak = Math.max(...pointsData, 10);
  const totalEvents = pointsData.reduce((acc, val) => acc + val, 0);
  const averageHourly = Math.round(totalEvents / pointsData.length);

  // Escala vertical com folga de 15% no topo para estética refinada
  const yMax = Math.ceil(rawPeak * 1.15);

  // Dimensões SVG panorâmicas calibradas
  const width = 1000;
  const height = 230;
  const paddingLeft = 44;
  const paddingRight = 16;
  const paddingTop = 22;
  const paddingBottom = 32;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const bottomY = paddingTop + chartHeight;

  // Coordenadas calculadas para o fluxo operacional contínuo
  const coords = pointsData.map((val, idx) => {
    const x = paddingLeft + (idx / (pointsData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (val / (yMax || 1)) * chartHeight;
    return { x, y, val, idx };
  });

  const linePath = getMonotonePath(coords);
  const lastPoint = coords[coords.length - 1];
  const firstPoint = coords[0];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${bottomY.toFixed(1)} L ${firstPoint.x.toFixed(1)} ${bottomY.toFixed(1)} Z`;

  // Linhas horizontais de referência com valores
  const midVal = Math.round(yMax / 2);
  const gridLevels = [
    { label: String(yMax), y: paddingTop },
    { label: String(midVal), y: paddingTop + chartHeight / 2 },
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
  const hoursAgo = activePoint ? 11 - activePoint.idx : 0;
  const hourText = hoursAgo === 0 ? "Agora (últimos 60 min)" : `Há ${hoursAgo}h`;

  return (
    <div className={`relative w-full rounded-xl border border-white/[0.08] bg-[#0A0C10] p-6 shadow-2xl transition-all ${className ?? ""}`}>
      {/* Header Autêntico do Gráfico Operacional da SEVEN CITY */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        {/* Esquerda: Identificação do Gráfico */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
              TELEMETRIA DISCORD
            </span>
            <span className="size-1 rounded-full bg-white/20" />
            <span className="text-[10px] font-medium text-zinc-500">
              Servidor Oficial
            </span>
          </div>
          <h2 className="mt-0.5 text-base sm:text-lg font-bold tracking-tight text-white">
            Atividade Operacional
          </h2>
          <p className="text-xs text-zinc-400">
            Fluxo contínuo de eventos, comandos e moderação registrados nas últimas 12 horas.
          </p>
        </div>

        {/* Direita: Métricas e Indicador em Tempo Real */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Tempo Real</span>
          </div>

          <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
            Total: <span className="font-semibold text-white">{totalEvents}</span> eventos
          </div>

          <div className="rounded-full border border-purple-500/25 bg-purple-950/30 px-3 py-1 text-xs text-purple-300">
            Pico: <span className="font-semibold text-purple-200">{rawPeak}</span>/h
          </div>

          <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-zinc-400">
            Média: ~{averageHourly}/h
          </div>

          {activePoint && (
            <div className="flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-900/40 px-3 py-1 text-xs text-purple-100 animate-fade-in">
              <span className="size-1.5 rounded-full bg-purple-300" />
              <span className="font-semibold">{activePoint.val} eventos</span>
              <span className="text-purple-300/80 text-[11px]">({hourText})</span>
            </div>
          )}
        </div>
      </div>

      {/* Área do Gráfico SVG Panorâmico com o Roxo como Secundária */}
      <div className="relative mt-4 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56 sm:h-64 select-none cursor-crosshair overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Gradiente Roxo Elegante (Linear / Vercel style) */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#7C3AED" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade Horizontais com Valores no Eixo Y */}
          {gridLevels.map((lvl, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={lvl.y}
                x2={width - paddingRight}
                y2={lvl.y}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeDasharray="3 4"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={lvl.y + 3.5}
                fill="#71717A"
                fontSize="10"
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

          {/* Curva Monotônica em Roxo Profundo com Brilho Refinado */}
          <path
            d={linePath}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Pontos discretos ao longo da linha */}
          {coords.map((pt) => {
            const isHovered = hoverIndex === pt.idx;
            return (
              <circle
                key={pt.idx}
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5 : 2.5}
                fill={isHovered ? "#C4B5FD" : "#8B5CF6"}
                stroke="#0A0C10"
                strokeWidth={isHovered ? 2.5 : 1}
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
                strokeDasharray="3 3"
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
                fill="#A78BFA"
                stroke="#0A0C10"
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
                y={height - 6}
                fill="#71717A"
                fontSize="11"
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
