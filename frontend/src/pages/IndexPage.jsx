import React from 'react';
import { Link } from "react-router-dom";
import { Zap, Brain, Shield, ArrowRight } from 'lucide-react';

export default function IndexPage() {
    return (
        <div className="min-h-screen bg-[#FFF6EB] text-gray-900 font-sans selection:bg-orange-200">

            {/* ================= HEADER ================= */}
            <header className="sticky top-0 z-50 bg-[#FFF6EB]/90 backdrop-blur-md border-b border-orange-100/50">
                <div className="max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
                    <h1 className="font-black text-xl tracking-tighter text-orange-500 hover:scale-105 transition-transform cursor-pointer">
                        Ai DOT.
                    </h1>

                    <div className="flex items-center gap-8">
                        <Link to="/login" className="text-sm font-bold text-gray-600 hover:text-orange-500 transition">
                            로그인
                        </Link>
                        <Link to="/signup" className="px-6 py-2.5 text-sm font-bold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition shadow-lg shadow-orange-200 active:scale-95">
                            회원가입
                        </Link>
                    </div>
                </div>
            </header>

            {/* ================= HERO SECTION ================= */}
            <main className="max-w-7xl mx-auto px-6 sm:px-10 py-16 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">

                {/* LEFT CONTENT (7/12) */}
                <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.15] tracking-tight">
                        내 손안의 <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-yellow-500">
                            똑똑한 AI 비서
                        </span>
                    </h2>

                    <p className="text-lg md:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-medium">
                        복잡한 업무부터 간단한 대화까지, 가장 똑똑한 비서와 함께하세요. <br />
                        <span className="text-gray-900 font-bold border-b-4 border-orange-200/60">
                            AiDOT은 실무에 바로 투입 가능한
                        </span> AI 솔루션입니다.
                    </p>

                    <div className="flex justify-center lg:justify-start pt-2">
                        <Link to="/signup" className="group flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:bg-orange-500 hover:shadow-xl hover:shadow-orange-200 transition-all active:scale-95">
                            지금 바로 시작하기
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>

                {/* RIGHT IMAGE */}
                <div className="lg:col-span-5 flex justify-center lg:justify-end">
                    <div className="relative w-full max-w-md">
                        {/* 배경 블러 */}
                        <div className="absolute -inset-10 bg-orange-300 rounded-full blur-[80px] opacity-20 animate-pulse"></div>

                        <div className="relative bg-white rounded-[3.5rem] shadow-2xl p-12 md:p-16 border-4 border-white/50 backdrop-blur-sm">
                            <img
                                src="/icon/aibotIcon.png"
                                alt="AiDOT Bot"
                                className="w-full h-auto object-contain transform scale-110 drop-shadow-xl"
                            />
                        </div>
                    </div>
                </div>
            </main>

            {/* ================= FEATURES SECTION ================= */}
            <section className="bg-white py-24 border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-6 sm:px-10">
                    <div className="text-center mb-16">
                        <h3 className="text-3xl md:text-4xl font-black mb-5 tracking-tight">
                            왜 <span className="text-orange-500 underline decoration-orange-100 decoration-4 underline-offset-4">AiDOT</span> 인가요?
                        </h3>
                        <p className="text-gray-500 max-w-2xl mx-auto text-lg leading-relaxed font-medium">
                            단순한 챗봇이 아닌, 당신의 실무를 완벽하게 보조하는 <br />
                            최첨단 지능형 비서 플랫폼입니다.
                        </p>
                    </div>

                    {/* 카드 영역 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Zap className="w-8 h-8" />}
                            title="압도적 속도"
                            desc="질문에 즉시 반응하고 필요한 데이터를 수 초 내에 분석하여 제공합니다."
                        />
                        <FeatureCard
                            icon={<Brain className="w-8 h-8" />}
                            title="스마트 분석"
                            desc="맥락을 깊이 이해하고 인간의 의도에 가장 가까운 해결책을 제시합니다."
                        />
                        <FeatureCard
                            icon={<Shield className="w-8 h-8" />}
                            title="철저한 보안"
                            desc="모든 데이터는 강력하게 암호화되어 관리되며 유출 걱정 없이 사용 가능합니다."
                        />
                    </div>
                </div>
            </section>

            {/* ================= FOOTER ================= */}
            <footer className="bg-[#FFF6EB] border-t border-orange-100/50 py-8">
                <div className="max-w-7xl mx-auto px-6 sm:px-10 text-center">
                    <p className="text-sm text-gray-400">
                        © 2026 Ai DOT. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc }) {
    return (
        <div className="bg-[#FFF8EE]/60 rounded-[2.5rem] border border-orange-50 p-10 text-center hover:bg-white hover:shadow-2xl hover:shadow-orange-100/50 transition-all duration-300 group cursor-default">
            <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-2xl bg-white shadow-md text-orange-500 mb-8 group-hover:bg-orange-500 group-hover:text-white transition-all transform group-hover:rotate-6 duration-300">
                {icon}
            </div>
            <h4 className="text-xl font-black mb-4 group-hover:text-orange-600 transition-colors">{title}</h4>
            <p className="text-gray-500 leading-relaxed text-sm md:text-base break-keep font-medium opacity-90">
                {desc}
            </p>
        </div>
    );
}
