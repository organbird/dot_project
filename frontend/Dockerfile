# 1. Node.js 이미지 사용
FROM node:20-alpine

# 2. 작업 디렉토리 생성
WORKDIR /app

# 3. 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm install

# 4. 소스 코드 복사
COPY . .

# 5. Vite 개발 서버 포트 노출
EXPOSE 5173

# 6. 호스트 접속 허용을 위해 --host 옵션 추가
CMD ["npm", "run", "dev", "--", "--host"]