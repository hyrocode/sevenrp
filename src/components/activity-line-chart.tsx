import React, { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ActivityLineChartProps {
  data: number[];
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      timeDetail: string;
      hourFormatted: string;
      eventos: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];

  return (
    <div className="rounded-lg border border-white/[0.12] bg-[#10131B]/95 px-3 py-2 shadow-2xl backdrop-blur-md">
      <p className="text-[11px] font-mono text-zinc-400">{item.payload.timeDetail}</p>
      <p className="mt-0.5 text-xs font-semibold text-white">
        <span className="font-bold text-purple-400">{item.value}</span> eventos
      </p>
    </div>
  );
}

export function ActivityLineChart({ data, className }: ActivityLineChartProps) {
  const gradientId = useId();
  const [isMounted, setIsMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState(1200);

  useEffect(() => {
    setIsMounted(true);
    setWindowWidth(window.innerWidth);

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 12 pontos horários (-11h até agora)
  const pointsData = data && data.length === 12 ? data : Array.from({ length: 12 }, () => 24);
  const rawPeak = Math.max(...pointsData, 10);
  const totalEvents = pointsData.reduce((acc, val) => acc + val, 0);
  const averageHourly = Math.round(totalEvents / pointsData.length);

  // Escala vertical com folga no topo para não cortar a curva
  const yMax = Math.ceil(rawPeak * 1.15);
  const midVal = Math.round(yMax / 2);

  // 12 intervalos de tempo
  const timeLabels = [
    "-12h", "-11h", "-10h", "-9h", "-8h", "-7h",
    "-6h", "-5h", "-4h", "-3h", "-2h", "Agora"
  ];

  const chartData = pointsData.map((val, idx) => {
    const hoursAgo = 11 - idx;
    const timeDetail = hoursAgo === 0 ? "Agora (últimos 60 min)" : `Há ${hoursAgo}h atrás`;

    return {
      index: idx,
      rawLabel: timeLabels[idx],
      timeDetail,
      eventos: val,
    };
  });

  const formatXAxisTick = (index: number) => {
    const isMobile = windowWidth < 640;
    if (index === 0) return "-12h";
    if (index === 11) return "Agora";
    if (index === 6) return "-6h";
    if (!isMobile && (index === 3 || index === 9)) {
      return index === 3 ? "-9h" : "-3h";
    }
    return "";
  };

  return (
    <div
      className={`relative w-full rounded-xl border border-white/[0.08] bg-[#0A0C10] p-4 sm:p-5 lg:p-6 shadow-2xl ${className ?? ""}`}
    >
      {/* Header com Alinhamento Perfeito no Design System */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
        {/* Lado Esquerdo */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
              TELEMETRIA DISCORD
            </span>
            <span className="size-1 rounded-full bg-white/20" />
            <span className="text-[10px] font-medium text-zinc-500">
              Servidor Oficial
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
            Atividade Operacional
          </h2>
          <p className="text-xs text-zinc-400">
            Fluxo contínuo de eventos, comandos e moderação registrados nas últimas 12 horas.
          </p>
        </div>

        {/* Lado Direito: Badges Alinhados */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0 pt-1 sm:pt-0">
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
        </div>
      </div>

      {/* Área do Gráfico Responsivo Utilizando 100% da Largura Útil */}
      <div className="relative mt-4 w-full h-[210px] sm:h-[230px] md:h-[250px] lg:h-[270px]">
        {!isMounted ? (
          <div className="w-full h-full rounded-lg bg-white/[0.02] animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 8, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.16} />
                  <stop offset="70%" stopColor="#7C3AED" stopOpacity={0.03} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              {/* Grid Horizontal Discreto */}
              <CartesianGrid
                stroke="rgba(255, 255, 255, 0.05)"
                strokeDasharray="3 3"
                vertical={false}
              />

              {/* Eixo X com Labels Distribuídos de Ponta a Ponta */}
              <XAxis
                dataKey="index"
                axisLine={false}
                tickLine={false}
                tickFormatter={formatXAxisTick}
                tick={{ fill: "#71717A", fontSize: 11, fontWeight: 500 }}
                dy={6}
                interval={0}
              />

              {/* Eixo Y Próximo à Margem Esquerda */}
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#71717A", fontSize: 10, fontWeight: 500 }}
                domain={[0, yMax]}
                ticks={[0, midVal, yMax]}
                width={36}
                allowDecimals={false}
              />

              {/* Tooltip Dark Glass */}
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "rgba(167, 139, 250, 0.4)",
                  strokeWidth: 1.2,
                  strokeDasharray: "3 3",
                }}
              />

              {/* Curva Suave Roxa Elegante */}
              <Area
                type="monotone"
                dataKey="eventos"
                stroke="#8B5CF6"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                dot={{
                  r: 2,
                  fill: "#8B5CF6",
                  stroke: "#0A0C10",
                  strokeWidth: 1,
                }}
                activeDot={{
                  r: 4.5,
                  fill: "#C4B5FD",
                  stroke: "#8B5CF6",
                  strokeWidth: 1.5,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
