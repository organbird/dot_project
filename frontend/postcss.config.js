// frontend/postcss.config.js
export default {
    plugins: {
        "@tailwindcss/postcss": {}, // 'tailwindcss' 대신 이걸 사용해야 합니다
        "autoprefixer": {},
    },
}