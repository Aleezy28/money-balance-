import { useId } from 'react';

interface SparklineProps {
  data: number[];
  stroke?: string;
  height?: number;
}

export default function Sparkline({
  data,
  stroke = '#10B981',
  height = 36,
}: SparklineProps) {
  const gradId = useId();
  const safeData = data.length >= 2 ? data : [0, ...data, 0];
  const width = 120;
  const pad = 4;

  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1;

  const points = safeData.map((val, idx) => {
    const x = (idx / (safeData.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((val - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const linePath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-9 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2.75"
        fill={stroke}
      />
    </svg>
  );
}
