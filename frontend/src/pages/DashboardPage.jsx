import React from 'react';
import AdminLayout from '../components/AdminLayout';
import StatCards from '../components/StatCards';
import SystemLogTable from '../components/SystemLogTable';
import DeptPieChart from '../components/DeptPieChart';
import DeptActivityChart from '../components/DeptActivityChart';
import ServerHealthBar from '../components/ServerHealthBar';
import DailyActivityChart from '../components/DailyActivityChart';
import FeatureUsageChart from '../components/FeatureUsageChart';
import ProcessTable from '../components/ProcessTable';

const DashboardPage = ({ user, setUser }) => {
    return (
        <AdminLayout user={user} setUser={setUser}>
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 md:gap-8">

                {/* 1. 상단 헤더 */}
                <div className="flex justify-between items-end border-b border-border-light dark:border-border-dark pb-6">
                    <div>
                        <p className="text-primary text-[10px] md:text-xs font-bold uppercase tracking-tighter mb-1">Control Tower</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight dark:text-white">시스템 통합 대시보드</h1>
                        <p className="text-text-muted text-sm mt-1">실시간 시스템 현황 및 AI 기능 사용 통계</p>
                    </div>
                </div>

                {/* 2. 서버 리소스 상태 */}
                <section>
                    <ServerHealthBar />
                </section>

                {/* 3. 실행 중인 프로세스 */}
                <section>
                    <ProcessTable />
                </section>

                {/* 4. 통계 카드 (시스템 + AI 기능) */}
                <section>
                    <StatCards />
                </section>

                {/* 5. 차트 섹션 - 일별 활동 추이 & 기능별 사용량 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    {/* 일별 활동 추이 */}
                    <div className="bg-white dark:bg-card-dark p-6 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1.5 h-5 bg-primary rounded-full"></div>
                            <h2 className="text-lg font-bold dark:text-white">일별 활동 추이</h2>
                            <span className="text-xs text-text-muted ml-auto">최근 7일</span>
                        </div>
                        <DailyActivityChart />
                    </div>

                    {/* 기능별 사용량 */}
                    <div className="bg-white dark:bg-card-dark p-6 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
                            <h2 className="text-lg font-bold dark:text-white">AI 기능 사용 현황</h2>
                        </div>
                        <FeatureUsageChart />
                    </div>
                </div>

                {/* 6. 부서 통계 섹션 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    {/* 부서별 인원 분포 */}
                    <div className="bg-white dark:bg-card-dark p-6 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1.5 h-5 bg-emerald-500 rounded-full"></div>
                            <h2 className="text-lg font-bold dark:text-white">부서별 인원 분포</h2>
                        </div>
                        <DeptPieChart />
                    </div>

                    {/* 부서별 활동 빈도 */}
                    <div className="bg-white dark:bg-card-dark p-6 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1.5 h-5 bg-amber-500 rounded-full"></div>
                            <h2 className="text-lg font-bold dark:text-white">부서별 시스템 사용량</h2>
                        </div>
                        <DeptActivityChart />
                    </div>
                </div>

                {/* 7. 시스템 로그 */}
                <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/10">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-red-500 rounded-full"></div>
                            <h2 className="text-lg font-bold dark:text-white">실시간 로그 모니터링</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-xs text-text-muted font-medium">LIVE</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <SystemLogTable />
                    </div>
                </div>

            </div>
        </AdminLayout>
    );
};

export default DashboardPage;
