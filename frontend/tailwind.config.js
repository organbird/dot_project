/** @type {import('tailwindcss').Config} */
export default {
    // 다크모드 활성화: 'class' 기반으로 <html class="dark">일 때 다크모드 적용
    darkMode: 'class',
    // 핵심: Tailwind가 어떤 파일을 읽어서 스타일을 만들지 지정합니다.
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}", // src 폴더 내 모든 파일 감시
    ],
    theme: {
        extend: {
            colors: {
                "primary": "#f27f0d",
                "primary-hover": "#d96d00",
                "background-light": "#fcfaf8",
                "background-dark": "#221910",
                "card-dark": "#2d241b",
                "text-main": "#1c140d",
                "text-muted": "#9c7349",
                "border-light": "#e8dbce",
                "border-dark": "#4a3b2f",
            },
            fontFamily: {
                "display": ["Space Grotesk", "Noto Sans KR", "sans-serif"],
                "body": ["Noto Sans KR", "sans-serif"],
            },
        },
    },
    plugins: [],
}