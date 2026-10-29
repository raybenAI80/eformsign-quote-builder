/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', 'sans-serif'],
                heading: ['Paperlogy', 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
