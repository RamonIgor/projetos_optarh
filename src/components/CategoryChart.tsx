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
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
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
