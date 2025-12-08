"use client";

import { ResponsiveContainer, Tooltip, Pie, Cell, Legend, PieChart } from 'recharts';

export interface CategoryChartData {
    name: string;
    value: number;
    fill: string;
}

interface CategoryChartProps {
    data: CategoryChartData[];
}

export default function CategoryChart({ data }: CategoryChartProps) {
    return (
        <ResponsiveContainer width="100%" height={150}>
            <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return value > 0 ? (
                        <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                            {`${value}`}
                        </text>
                    ) : null;
                }}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} />
            </PieChart>
        </ResponsiveContainer>
    );
}
