# Rin 프로젝트 확장 로드맵 분석

> 워드프레스 같은 확장성 있는 블로그 플랫폼으로 발전시키기 위한 전략적 분석

## 📋 현재 프로젝트 구조 개요

### 기술 스택
- **프론트엔드**: React + TypeScript + Vite
- **백엔드**: Cloudflare Workers (Hono 프레임워크)
- **데이터베이스**: Cloudflare D1 (SQLite)
- **스토리지**: Cloudflare R2 (S3 호환)
- **에디터**: Monaco Editor (마크다운)
- **패키지 관리**: Monorepo (Turborepo + Bun)

### 프로젝트 아키텍처
```
Root
├── client/               # React 프론트엔드 (Vite)
├── server/              # Cloudflare Workers 백엔드
├── cli/                 # CLI 도구
└── packages/
    ├── api/             # 타입 정의 & 공유 로직
    ├── config/          # 설정 관리
    └── ui/              # 공유 UI 컴포넌트
```

---

## ✅ 현재 구현된 기능

### 1. **RSS Feed** ✓ (이미 구현됨)
- **위치**: `server/src/services/rss.ts`
- **라우트**: `/rss.xml`, `/atom.xml`, `/rss.json`, `/feed.json`, `/feed.xml`
- **상태**: 완전 구현 + 캐싱 지원

### 2. **태그 시스템** ✓ (이미 구현됨)
- **위치**: `server/src/services/tag.ts`
- **테이블**: `hashtags`, `feed_hashtags` (중간 테이블)
- **기능**:
  - 글별 해시태그 관리
  - 태그별 글 조회
  - 태그 페이지 존재

### 3. **기본 콘텐츠 관리** ✓
- 마크다운 에디터 (Monaco Editor)
- 드래그앤드롭 이미지 업로드
- 이미지 자동 최적화 & R2 저장
- 임시 저장 (Local Draft)

---

## 🚀 추천 확장 작업 (우선순위 순)

### Phase 1: 검색 & 발견성 강화 (1-2주)

#### 1.1 **Sitemap 생성** ⭐⭐⭐⭐⭐ [가장 먼저]
**왜**: SEO의 기본, 검색 엔진 크롤링 필수
- **구현 난도**: ⭐ 낮음
- **영향도**: ⭐⭐⭐⭐⭐ 매우 높음

**할 일**:
```
1. server/src/services/sitemap.ts 생성
2. XML 포맷 sitemap 구현 (google sitemap 표준)
3. 라우트: /sitemap.xml, /sitemap.json (옵션)
4. Cache-Control 헤더 설정 (1일)
5. robots.txt 추가 (/public/robots.txt)
```

**코드 스케치**:
```typescript
// GET /sitemap.xml
- 모든 published 글 조회
- URL 생성: domain/article/{alias}
- lastmod: updatedAt 사용
- priority: 1.0 (글), 0.8 (태그 페이지)
- changefreq: weekly
```

#### 1.2 **검색 최적화** (이미 부분 구현)
- `server/src/services/feed.ts`에 SearchService 존재
- 현재: 제목 & 내용으로 검색
- **개선안**: 검색 인덱싱 강화 (선택사항)

---

### Phase 2: 콘텐츠 구조화 (2-3주)

#### 2.1 **카테고리 시스템** ⭐⭐⭐⭐
**왜**: 워드프레스의 핵심 - 글 조직화, 사용자 네비게이션 개선
- **구현 난도**: ⭐⭐ 중간
- **영향도**: ⭐⭐⭐⭐⭐ 매우 높음

**해야 할 일**:

```
1. 데이터베이스 스키마 추가 (마이그레이션)
   - categories 테이블: id, name, slug, description, icon, color, order
   - feed_categories 테이블: feed_id, category_id (다대다 또는 일대다?)
   
2. 백엔드 구현
   - CategoryService (CRUD)
   - FeedService 수정 (category 필터링)
   
3. 프론트엔드 구현
   - 글 작성 시 카테고리 선택 UI
   - 카테고리별 글 목록 페이지
   - 홈페이지 카테고리별 탐색

4. SEO 최적화
   - /category/{slug} 라우트
   - Category page sitemap 포함
```

**설계 결정**:
- **카테고리 관계**: 글당 1개 카테고리 OR 다중 카테고리?
  - **추천**: 1개 primary + 다중 tag로 분리 (워드프레스 방식)
  - 테이블: feed.category_id (FK) + 기존 hashtags (tags)

---

### Phase 3: 에디터 개선 (1-2주)

#### 3.1 **TiptapEditor 도입** ⭐⭐⭐⭐
**현재**: Monaco Editor (코드 에디터 형식)
**목표**: WYSIWYG 에디터로 전환 (마크다운 작성 제거)

**왜**: 
- 일반 사용자 친화적
- 더 나은 포매팅 UI
- 블록 기반 콘텐츠 구조

**구현 난도**: ⭐⭐⭐ 중간 (에디터 전환은 수고로움)
**영향도**: ⭐⭐⭐⭐ 높음

**할 일**:
```
1. 의존성 추가
   - npm install @tiptap/react @tiptap/starter-kit
   - 또는 Plate (더 고급), Lexical (메타의 에디터)

2. 마크다운 → HTML 전환
   - 내용 포맷: HTML 저장 (현재: 마크다운 문자열)
   - 마이그레이션 필요 (기존 글 유지)
   
3. 에디터 컴포넌트 구현
   - client/src/components/tiptap-editor.tsx
   - 슬래시 커맨드 지원 (/h1, /h2, /code 등)
   
4. 마크다운 렌더링 유지
   - 백엔드에서 HTML → 마크다운 변환 (선택사항)
   - 또는 클라이언트에서 HTML 직접 렌더링

5. 이미지 임베딩
   - 현재 방식 (마크다운 링크) → HTML img 태그
```

**실행 전략**:
- **Option A**: TiptapEditor 도입 + 기존 마크다운 병행 (마이그레이션 점진적)
- **Option B**: 모든 글을 HTML로 마이그레이션 (한 번에, 대규모 변경)
- **추천**: Option A (덜 위험함)

---

### Phase 4: REST API 자동화 (1-2주)

#### 4.1 **글 작성 REST API** ⭐⭐⭐⭐
**왜**: 외부 앱, 스크립트, 봇에서 자동으로 글 작성

**현재 상태**: 
- FeedService에 POST /feed 존재 (아마도 웹 UI에서만 사용)

**할 일**:
```
1. API 인증 강화
   - 현재: GitHub OAuth (웹 UI)
   - API 토큰 추가 (API 키 기반 인증)
   - user.ts에 API 키 관리 로직 추가

2. POST /feed 엔드포인트 최적화
   - title, content, category, tags, listed, draft 파라미터
   - 응답: { id, alias, url }

3. 문서화
   - API 문서 작성 (OpenAPI 또는 간단한 마크다운)
```

---

## 📊 추천 우선순위 로드맵

```
┌─────────────────────────────────────────────────────────┐
│ Week 1: Sitemap + 기본 SEO                              │
│  └─ /sitemap.xml                                        │
│  └─ /robots.txt                                         │
│  └─ robots.txt 에러 수정                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Week 2-3: 카테고리 시스템                                │
│  └─ DB 마이그레이션                                      │
│  └─ 백엔드 CategoryService                              │
│  └─ 프론트엔드 UI                                        │
│  └─ 카테고리별 페이지                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Week 4-5: TiptapEditor (선택사항, 큰 변경)               │
│  └─ 의존성 추가 & 테스트                                 │
│  └─ 에디터 컴포넌트                                      │
│  └─ 마이그레이션 전략                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Week 6: REST API + 문서화                               │
│  └─ API 토큰 시스템                                      │
│  └─ 자동화 예제                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 각 기능별 상세 분석

### Sitemap 구현 상세

**난도**: ⭐ (가장 쉬움)
**파일**: `server/src/services/sitemap.ts` (신규)

```typescript
// 필요한 쿼리
- feeds 테이블에서 draft=0, listed=1 글만 조회
- 각 글의 alias, updatedAt 사용
- hashtags (태그 페이지)도 sitemap에 포함 고려

// XML 구조 (Google 표준)
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yourblog.com/article/{alias}</loc>
    <lastmod>2026-04-13</lastmod>
    <priority>1.0</priority>
    <changefreq>weekly</changefreq>
  </url>
  ...
</urlset>
```

### 카테고리 시스템 상세

**난도**: ⭐⭐ (중간)

**DB 설계**:
```sql
-- 추가할 테이블
CREATE TABLE IF NOT EXISTS `categories` (
  `id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL UNIQUE,
  `description` text,
  `icon` text,
  `color` text,
  `order` integer DEFAULT 0,
  `uid` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`uid`) REFERENCES `users`(`id`)
);

-- feeds 테이블 수정
ALTER TABLE feeds ADD COLUMN category_id integer;
```

**API 엔드포인트**:
- `GET /category` - 모든 카테고리
- `POST /category` - 카테고리 생성 (admin)
- `GET /category/:slug` - 카테고리별 글 목록
- `DELETE /category/:id` - 카테고리 삭제 (admin)

---

## ⚠️ 주의사항 & 고려사항

### 1. 마크다운 vs HTML
- **현재**: 마크다운 저장 + 클라이언트 렌더링
- **변경 시**: 기존 글 호환성 문제
  - 솔루션: 마이그레이션 스크립트 작성 (필요시)
  - 또는: 듀얼 서포트 (마크다운 + HTML)

### 2. 데이터베이스 마이그레이션
- D1은 SQLite 기반 (문법 제한 있음)
- `ALTER TABLE`은 제한적 (컬럼 추가는 가능)
- 마이그레이션 파일: `server/sql/000X.sql`

### 3. 캐시 관리
- Cloudflare Workers 캐시 레이어 존재
- 새 기능 추가 시 캐시 무효화 로직 필요
- `server/src/services/clear-feed-cache.ts` 참고

### 4. 성능 최적화
- 현재: `server/core/server-timing.ts`로 프로파일링
- 새 쿼리 추가 시 인덱싱 고려

---

## 📈 워드프레스 기능 대비 맵

| 기능 | 현재 상태 | 우선순위 | 난도 |
|------|---------|---------|------|
| **Sitemap** | ❌ | ⭐⭐⭐⭐⭐ | ⭐ |
| **카테고리** | ❌ | ⭐⭐⭐⭐ | ⭐⭐ |
| **태그** | ✅ | - | - |
| **RSS** | ✅ | - | - |
| **이미지 업로드** | ✅ | - | - |
| **WYSIWYG 에디터** | ❌ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **REST API** | ⚙️ 부분 | ⭐⭐⭐ | ⭐⭐ |
| **댓글** | ✅ | - | - |
| **메뉴** | ❌ | ⭐⭐ | ⭐⭐ |
| **플러그인 시스템** | ❌ | ⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 다음 단계

1. **Sitemap 구현부터 시작** (가장 쉽고 영향도 높음)
2. **카테고리 시스템 추가** (구조화 강화)
3. **필요시 TiptapEditor 검토** (큰 변경, 신중히)
4. **REST API 문서화** (자동화 지원)

---

## 📚 참고 자료

- **Rin 공식 문서**: https://docs.openrin.org
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Hono 프레임워크**: https://hono.dev
- **Drizzle ORM**: https://orm.drizzle.team

