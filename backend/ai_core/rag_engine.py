"""
RAG (Retrieval-Augmented Generation) 엔진 모듈

이 모듈은 PDF 문서를 벡터 데이터베이스에 저장하고,
자연어 질의를 통해 관련 문서를 검색하는 기능을 제공합니다.

주요 기능:
    - PDF 문서 로딩 및 텍스트 추출
    - 문서를 작은 청크(chunk)로 분할하여 벡터화
    - ChromaDB를 이용한 벡터 임베딩 저장
    - 유사도 기반 문서 검색 (Similarity Search)

사용 기술:
    - LangChain: 문서 로딩 및 텍스트 분할
    - HuggingFace Embeddings: 한국어 특화 임베딩 모델
    - ChromaDB: 벡터 데이터베이스

작성일: 2025
작성자: DOT-Project Team
"""

import os
import uuid
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings  # 업데이트된 패키지명

class RAGEngine:
    """
    RAG (Retrieval-Augmented Generation) 엔진 클래스

    PDF 문서를 벡터화하여 저장하고, 질의에 대한 관련 문서를 검색하는 기능을 제공합니다.
    CPU 모드로 동작하여 GPU 메모리 부담을 줄이고, 도커 환경에서 안정적으로 작동합니다.

    Attributes:
        embeddings (HuggingFaceEmbeddings): 텍스트를 벡터로 변환하는 임베딩 모델
            - 모델명: 'jhgan/ko-sbert-nli' (한국어 특화)
            - 디바이스: CPU (VRAM 절약)
            - 정규화: 활성화 (유사도 계산 정확도 향상)

        db_path (str): ChromaDB 데이터 저장 경로
            - 도커 볼륨 마운트 경로: /app/uploads/chroma_db
            - 영구 저장됨 (컨테이너 재시작 시에도 유지)

        vector_store (Chroma): ChromaDB 벡터 저장소 인스턴스
            - 컬렉션명: 'dot_project_docs'
            - 문서 임베딩 및 검색 기능 제공

    Note:
        - GPU가 없는 환경(워커 컨테이너)에서도 안정적으로 동작
        - 임베딩 모델 로딩에 초기 시간이 소요될 수 있음 (약 5-10초)
        - ChromaDB는 자동으로 디스크에 데이터를 영속화함
    """

    def __init__(self):
        """
        RAGEngine 초기화

        임베딩 모델을 로드하고 ChromaDB 벡터 저장소에 연결합니다.
        모든 처리는 CPU에서 수행되며, 데이터는 영구 저장됩니다.

        Raises:
            Exception: 임베딩 모델 로딩 실패 시
            Exception: ChromaDB 연결 실패 시

        Examples:
            >>> rag = RAGEngine()
            📥 [RAGEngine] 임베딩 모델 로딩 중... (CPU 모드)
            ✅ [RAGEngine] ChromaDB 연결 완료: /ai_models/chroma_db
        """
        # 1. 임베딩 모델 설정 (중요: VRAM 아끼기 위해 CPU 사용!)
        # 한국어 성능이 좋은 'jhgan/ko-sbert-nli' 모델 사용
        # 이 모델은 SentenceBERT 기반으로 문장 간 유사도 측정에 최적화됨
        print("📥 [RAGEngine] 임베딩 모델 로딩 중... (CPU 모드)")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="jhgan/ko-sbert-nli",  # 한국어 자연어 추론(NLI) 학습된 모델
            model_kwargs={'device': 'cpu'}, 
            encode_kwargs={'normalize_embeddings': True}  # L2 정규화로 코사인 유사도 계산 최적화
        )

        # 2. 벡터 DB 연결 (ChromaDB)
        # 데이터는 도커 볼륨(/app/uploads/chroma_db)에 영구 저장
        # 컨테이너가 재시작되어도 데이터가 유지됨
        self.db_path = "/app/uploads/chroma_db"
        self.vector_store = Chroma(
            persist_directory=self.db_path,  # 데이터 저장 경로 (자동 생성)
            embedding_function=self.embeddings,  # 텍스트 벡터화에 사용할 함수
            collection_name="dot_project_docs"  # 컬렉션명 (테이블 개념)
        )
        print(f"✅ [RAGEngine] ChromaDB 연결 완료: {self.db_path}")

    def ingest_pdf(self, file_path: str):
        """
        PDF 파일을 읽어서 벡터 데이터베이스에 저장

        PDF 문서를 로드하여 텍스트를 추출하고, 작은 청크로 분할한 후
        벡터화하여 ChromaDB에 저장합니다. 이 과정을 통해 나중에
        유사도 검색이 가능해집니다.

        Args:
            file_path (str): 처리할 PDF 파일의 절대 경로
                예: '/app/documents/2025_IT_Trends.pdf'

        Returns:
            str: 작업 결과 메시지
                - 성공: '✅ 저장 완료! (총 N개의 조각으로 분할됨)'
                - 실패: '❌ 오류: 파일을 찾을 수 없습니다. (경로)'

        Raises:
            Exception: PDF 로딩 실패 (손상된 파일, 암호화된 파일 등)
            Exception: 텍스트 분할 실패
            Exception: ChromaDB 저장 실패

        Process:
            1. 파일 존재 여부 확인
            2. PyPDFLoader로 PDF 페이지별 텍스트 추출
            3. RecursiveCharacterTextSplitter로 텍스트 청크 분할
                - chunk_size: 500자 (한 청크의 최대 길이)
                - chunk_overlap: 50자 (앞뒤 청크와 겹치는 부분, 문맥 유지)
            4. 각 청크를 임베딩 모델로 벡터화
            5. ChromaDB에 저장 (메타데이터 포함)

        Examples:
            >>> rag = RAGEngine()
            >>> result = rag.ingest_pdf('/app/docs/sample.pdf')
            📄 문서 처리 시작: /app/docs/sample.pdf
            ✅ 저장 완료! (총 42개의 조각으로 분할됨)

        Note:
            - 큰 PDF 파일의 경우 처리 시간이 오래 걸릴 수 있음
            - chunk_size와 chunk_overlap은 문서 특성에 따라 조정 가능
            - 같은 파일을 여러 번 저장하면 중복 데이터가 생김 (주의)
        """
        # 파일 존재 여부 사전 검증
        if not os.path.exists(file_path):
            return f"❌ 오류: 파일을 찾을 수 없습니다. ({file_path})"

        print(f"📄 문서 처리 시작: {file_path}")

        # 1. PDF 로드
        # PyPDFLoader는 PDF를 페이지별로 읽어서 Document 객체 리스트로 반환
        # 각 Document는 page_content(텍스트)와 metadata(페이지 번호, 출처 등) 포함
        loader = PyPDFLoader(file_path)
        docs = loader.load()

        # 2. 텍스트 자르기 (Chunking)
        # 500자 단위로 자르고, 앞뒤 50자는 겹치게(Overlap) 해서 문맥 유지
        # Overlap이 없으면 문장이 잘려서 의미가 손실될 수 있음
        # RecursiveCharacterTextSplitter는 문장, 단락 경계를 고려하여 분할
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,  # 한 청크의 최대 문자 수
            chunk_overlap=50  # 이전 청크와 겹치는 문자 수 (문맥 보존)
        )
        splits = text_splitter.split_documents(docs)

        # 3. DB에 저장 (벡터 변환은 내부에서 자동 수행)
        # add_documents()는 각 청크를 self.embeddings로 벡터화한 후
        # ChromaDB에 저장함 (메타데이터도 함께 저장)
        self.vector_store.add_documents(documents=splits)

        return f"✅ 저장 완료! (총 {len(splits)}개의 조각으로 분할됨)"

    def search(self, query: str, k=3, threshold=1.0):
        """
        질문과 관련된 문서 조각을 유사도 기반으로 검색

        사용자의 자연어 질의를 벡터화하여 데이터베이스에 저장된
        문서 청크들과 유사도를 비교하고, 가장 관련성 높은 결과를 반환합니다.
        유사도 임계값(threshold)을 사용하여 관련성이 낮은 결과를 필터링합니다.

        Args:
            query (str): 사용자의 검색 질의 (자연어)
                예: '2025년 IT 트렌드는 무엇인가요?'

            k (int, optional): 반환할 최대 문서 개수. 기본값은 3.
                실제 반환되는 개수는 threshold 필터링 후 k개 이하

            threshold (float, optional): 유사도 점수 임계값. 기본값은 1.0.
                - 점수가 낮을수록 유사도가 높음 (L2 거리 기반)
                - threshold보다 점수가 높은 문서는 제외됨
                - 권장 범위: 0.8 ~ 1.2 (데이터셋에 따라 조정 필요)

        Returns:
            list[dict]: 검색된 문서 정보 리스트 (유사도 순으로 정렬)
                각 딕셔너리는 다음 키를 포함:
                - content (str): 문서 청크의 텍스트 내용
                - source (str): 원본 파일 경로
                - page (int): 페이지 번호 (PDF 기준, 0부터 시작)
                - score (float): 유사도 점수 (낮을수록 유사함)

        Examples:
            >>> rag = RAGEngine()
            >>> results = rag.search('인공지능 트렌드', k=5, threshold=1.0)
            >>> for res in results:
            ...     print(f"유사도: {res['score']:.4f}")
            ...     print(f"내용: {res['content'][:100]}...")
            유사도: 0.4523
            내용: 2025년 인공지능 산업은 생성형 AI를 중심으로...

        Note:
            - query가 짧거나 모호하면 관련성 낮은 결과가 반환될 수 있음
            - threshold 값은 실험을 통해 최적값 찾기 권장
            - 결과가 없으면 빈 리스트 반환 (에러 발생 안 함)
            - 내부적으로 코사인 유사도 또는 L2 거리 사용 (모델 설정 따름)

        Raises:
            Exception: 임베딩 생성 실패 시
            Exception: ChromaDB 검색 실패 시
        """
        # ChromaDB에서 유사도 검색 수행
        # similarity_search_with_score()는 (Document, score) 튜플의 리스트 반환
        # score는 L2 거리 기반 (낮을수록 유사함)
        docs = self.vector_store.similarity_search_with_score(query, k=k)

        results = []
        for doc, score in docs:
            # ★ 핵심: 점수가 너무 높으면(거리가 멀면) 버린다!
            # (데이터에 따라 이 숫자는 조절 필요, 보통 1.0 ~ 1.2 사이 권장)
            # threshold보다 큰 점수는 관련성이 낮다고 판단하여 제외
            if score > threshold:
                continue

            # 결과를 사용하기 쉬운 딕셔너리 형태로 변환
            results.append({
                "content": doc.page_content,  # 문서 청크의 실제 텍스트
                "source": doc.metadata.get("source", "unknown"),  # 원본 파일 경로
                "page": doc.metadata.get("page", 0),  # PDF 페이지 번호
                "score": score  # 유사도 점수 (낮을수록 관련성 높음)
            })

        return results

    def delete_by_source(self, file_path: str):
        """
        특정 파일 경로의 모든 벡터를 ChromaDB에서 삭제

        Args:
            file_path (str): 삭제할 문서의 파일 경로
                예: 'uploads/documents/abc-123.pdf'

        Returns:
            str: 작업 결과 메시지
                - 성공: '✅ 삭제 완료! (총 N개의 벡터 삭제됨)'
                - 문서 없음: '⚠️ 해당 파일의 벡터가 없습니다.'

        Note:
            - 파일 경로는 ingest_pdf() 시 저장된 메타데이터 'source'와 일치해야 함
            - ChromaDB에서 조건에 맞는 모든 청크를 삭제

        Examples:
            >>> rag = RAGEngine()
            >>> result = rag.delete_by_source('uploads/documents/abc-123.pdf')
            ✅ 삭제 완료! (총 42개의 벡터 삭제됨)
        """
        try:
            # ChromaDB에서 해당 파일의 모든 문서 조회
            # where 조건으로 메타데이터 'source' 필터링
            results = self.vector_store.get(
                where={"source": file_path}
            )

            if not results or not results.get('ids'):
                print(f"⚠️ [RAGEngine] 파일 '{file_path}'의 벡터가 ChromaDB에 없음")
                return "⚠️ 해당 파일의 벡터가 없습니다."

            # 조회된 ID 리스트
            ids_to_delete = results['ids']
            count = len(ids_to_delete)

            # ChromaDB에서 삭제
            self.vector_store.delete(ids=ids_to_delete)

            print(f"✅ [RAGEngine] 파일 '{file_path}' 벡터 삭제 완료 (총 {count}개)")
            return f"✅ 삭제 완료! (총 {count}개의 벡터 삭제됨)"

        except Exception as e:
            error_msg = f"🔥 벡터 삭제 중 에러: {str(e)}"
            print(error_msg)
            return error_msg

    def store_precomputed_vectors(self, embeddings: list, texts: list, metadatas: list):
        """
        PC2 Worker에서 사전 계산된 벡터를 ChromaDB에 직접 저장

        Worker가 GPU로 임베딩을 생성한 후 HTTP로 전송한 벡터를
        재계산 없이 ChromaDB에 바로 저장합니다.

        Args:
            embeddings (list): 벡터 임베딩 리스트 (float 리스트의 리스트)
            texts (list): 원본 텍스트 청크 리스트
            metadatas (list): 메타데이터 딕셔너리 리스트 (source, page 등)

        Returns:
            str: 작업 결과 메시지
        """
        try:
            collection = self.vector_store._collection
            ids = [str(uuid.uuid4()) for _ in texts]

            collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas
            )

            print(f"✅ [RAGEngine] 사전 계산 벡터 저장 완료 ({len(texts)}개 청크)")
            return f"✅ 저장 완료! (총 {len(texts)}개의 청크 저장됨)"

        except Exception as e:
            error_msg = f"🔥 사전 계산 벡터 저장 중 에러: {str(e)}"
            print(error_msg)
            return error_msg
