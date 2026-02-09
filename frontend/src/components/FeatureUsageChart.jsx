import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { Loader2, MessageSquare, FileText, FileAudio, Image } from 'lucide-react';
import { API_BASE } from '../utils/api';

const FeatureUsageChart = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${API_BASE}/api/admin/feature-usage`);
                setData(response.data);
            } catch (error) {
                console.error("기능 사용량 데이터 로드 실패:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const totalUsage = data.reduce((sum, d) => sum + d.value, 0);

    const icons = {
        'AI 챗봇': MessageSquare,
        '문서 관리': FileText,
        '회의록 분석': FileAudio,
        '이미지 생성': Image,
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            const percentage = totalUsage > 0 ? ((item.value / totalUsage) * 100).toFixed(1) : 0;
            return (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg border border-border-light dark:border-border-dark">
                    <p className="font-bold text-sm dark:text-white">{item.name}</p>
                    <p className="text-xs text-text-muted">
                        {item.value.toLocaleString()}건 ({percentage}%)
                    </p>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* 차트 */}
            <div className="w-full lg:w-1/2">
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={4}
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={800}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    stroke="none"
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
                {/* 중앙 텍스트 */}
                <div className="text-center -mt-[160px] mb-[110px]">
                    <p className="text-2xl font-black dark:text-white">{totalUsage.toLocaleString()}</p>
                    <p className="text-xs text-text-muted">총 사용량</p>
                </div>
            </div>

            {/* 범례 */}
            <div className="w-full lg:w-1/2 space-y-3">
                {data.map((item, index) => {
                    const IconComponent = icons[item.name] || FileText;
                    const percentage = totalUsage > 0 ? ((item.value / totalUsage) * 100).toFixed(1) : 0;

                    return (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="p-2 rounded-lg"
                                    style={{ backgroundColor: `${item.color}20` }}
                                >
                                    <IconComponent size={18} style={{ color: item.color }} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold dark:text-white">{item.name}</p>
                                    <p className="text-xs text-text-muted">{percentage}%</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black dark:text-white">{item.value.toLocaleString()}</p>
                                <p className="text-[10px] text-text-muted">건</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FeatureUsageChart;
