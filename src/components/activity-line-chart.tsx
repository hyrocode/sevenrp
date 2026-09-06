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
  const hourlyData = data && data.length === 12 ? data : Array.from({ length: 12 }, () => 28);

  // Curva de evolução acumulada (sobe suavemente da esquerda para a direita, exatamente como no print de referência)
  const cumulativeData = hourlyData.reduce<number[]>((acc, val, i) => {
    const base = i === 0 ? Math.max(15, Math.round(val * 0.65)) : acc[i - 1];
    return [...acc, base + val];
  }, []);

  const totalEvents = cumulativeData[cumulativeData.length - 1] ?? 450;
  const minVal = cumulativeData[0] ?? 20;
  const maxVal = Math.max(...cumulativeData, 100);

  // Dimensões SVG panorâmicas (widescreen)
  const width = 1000;
  const height = 230;
  const paddingLeft = 14;
  const paddingRight = 14;
  const paddingTop = 26;
  const paddingBottom = 34;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const bottomY = paddingTop + chartHeight;

  // Normalização vertical suave: linha parte da base esquerda e atinge o topo direito
  const valueRange = maxVal - minVal * 0.75;
  const coords = cumulativeData.map((val, idx) => {
    const x = paddingLeft + (idx / (cumulativeData.length - 1)) * chartWidth;
    const normalized = (val - minVal * 0.75) / (valueRange || 1);
    const y = paddingTop + chartHeight - normalized * chartHeight;
    return { x, y, val, hourlyVal: hourlyData[idx] ?? 0, idx };
  });

  const linePath = getMonotonePath(coords);
  const lastPoint = coords[coords.length - 1];
  const firstPoint = coords[0];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${bottomY.toFixed(1)} L ${firstPoint.x.toFixed(1)} ${bottomY.toFixed(1)} Z`;

  // Linhas horizontais sutis tracejadas de referência no fundo
  const gridYLevels = [
    paddingTop + 10,
    paddingTop + chartHeight * 0.35,
    paddingTop + chartHeight * 0.7,
    bottomY,
  ];

  const timeLabels = [
    { label: "-12h", idx: 0 },
    { label: "-9h", idx: 3 },
    { label: "-6h", idx: 6 },
    { label: "-3h", idx: 9 },
    { label: "Atual", idx: 11 },
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
  const hourText = hoursAgo === 0 ? "Atual (últimos 60 min)" : `Há ${hoursAgo}h`;

  return (
    <div className={`relative w-full rounded-xl border border-white/[0.08] bg-[#0A0C10] p-6 shadow-2xl transition-all ${className ?? ""}`}>
      {/* Top Header Panorâmico (Idêntico ao print de exemplo do usuário) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        {/* Esquerda: EVOLUÇÃO e VOLUME DE EVENTOS & ATIVIDADE */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            EVOLUÇÃO
          </span>
          <h2 className="mt-0.5 text-base sm:text-lg font-black tracking-tight text-white uppercase">
            VOLUME DE EVENTOS & ATIVIDADE
          </h2>
        </div>

        {/* Direita: Legenda com bolinha branca + Pill de Temporada/Período */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
            <span className="size-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
            <span>Eventos ativos</span>
          </div>

          <div className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 py-1 text-xs text-zinc-300 font-medium select-none">
            Últimas 12 horas
          </div>

          {activePoint && (
            <div className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-950/40 px-3 py-1 text-xs text-purple-200">
              <span className="font-semibold text-white">{activePoint.val} acumulados</span>
              <span className="text-[11px] text-zinc-400">({hourText})</span>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico SVG Panorâmico de Ponta a Ponta */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56 sm:h-64 select-none cursor-crosshair overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Gradiente idêntico ao print: topo iluminado em branco/roxo suave descendo para transparente */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.20" />
              <stop offset="40%" stopColor="#A78BFA" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade Horizontais Ultra Discretas */}
          {gridYLevels.map((y, i) => (
            <line
              key={i}
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeDasharray="2 4"
              strokeWidth="1"
            />
          ))}

          {/* Área Gradiente Preenchida */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Linha Curva Contínua e Ascendente (Branco Puro / Alta Definição) */}
          <path
            d={linePath}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Indicador no Hover */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={bottomY}
                stroke="rgba(255, 255, 255, 0.35)"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7"
                fill="rgba(255, 255, 255, 0.25)"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="3.5"
                fill="#FFFFFF"
                stroke="#0A0C10"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Rótulos de Tempo no Eixo X (Alinhamento Idêntico ao print: Fev, Mar, Abr, Mai, Atual) */}
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
