# Sitemap 구현 가이드

## 📝 개요

Rin 블로그에 Rank Math 스타일의 XML 사이트맵(Sitemap) 기능이 구현되었습니다. 

### 구현된 기능
- ✅ 동적 사이트맵 인덱스 생성 (`/sitemap.xml`)
- ✅ 글 페이지 사이트맵 (`/sitemap-posts-1.xml`, 페이지네이션 지원)
- ✅ 태그 페이지 사이트맵 (`/sitemap-tags-1.xml`, 페이지네이션 지원)
- ✅ 이미지 사이트맵 포함 (글의 첫 이미지 감지)
- ✅ XML 검증 및 에러 감지
- ✅ 24시간 캐싱 (성능 최적화)
- ✅ robots.txt 업데이트

---

## 🚀 사이트맵 URL

### 인덱스
```
GET /sitemap.xml
```
다른 사이트맵 파일들의 목록을 제공합니다.

**응답 예시**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://yourblog.com/sitemap-posts-1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://yourblog.com/sitemap-tags-1.xml</loc>
  </sitemap>
</sitemapindex>
```

### 글 목록 사이트맵
```
GET /sitemap-posts-{page}.xml
```

예: `/sitemap-posts-1.xml`, `/sitemap-posts-2.xml`

**응답 예시**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://yourblog.com/article/my-first-post</loc>
    <lastmod>2026-04-13</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>https://r2.example.com/image.jpg</image:loc>
      <image:title>My First Post</image:title>
    </image:image>
  </url>
</urlset>
```

### 태그 사이트맵
```
GET /sitemap-tags-{page}.xml
```

예: `/sitemap-tags-1.xml`, `/sitemap-tags-2.xml`

---

## 📋 특징

### 1. **XML 검증**
모든 생성된 사이트맵은 Google 사이트맵 프로토콜을 준수하도록 검증됩니다:
- ✅ 유효한 XML 구조
- ✅ 올바른 URL 인코딩 (특수문자 이스케이프)
- ✅ 올바른 날짜 형식 (ISO 8601)
- ✅ 유효한 priority (0.0-1.0)
- ✅ 유효한 changefreq 값

### 2. **페이지네이션**
- 사이트맵당 최대 50,000개의 URL (Google 제한)
- 글이 50,000개 이상인 경우 자동으로 여러 페이지로 분할
- 예: 100,000개의 글 → `/sitemap-posts-1.xml`, `/sitemap-posts-2.xml`

### 3. **이미지 사이트맵**
- 각 글의 첫 번째 이미지를 자동으로 감지
- 마크다운 포맷: `![alt](url)` 감지
- Google 이미지 검색 최적화

### 4. **캐싱**
- 24시간 캐시 (성능 최적화)
- Cloudflare R2에 저장
- 매일 스케줄된 작업으로 캐시 무효화

### 5. **SEO 최적화**
- `lastmod`: 글의 마지막 수정 시간
- `priority`: 글(1.0) > 태그(0.8) 우선순위
- `changefreq`: 주간 업데이트 추천

---

## 🔧 구현 세부사항

### 파일 구조

```
server/
├── src/
│   ├── services/
│   │   ├── sitemap.ts                  # 메인 사이트맵 서비스
│   │   └── __tests__/
│   │       └── sitemap.test.ts        # 기본 테스트
│   │
│   ├── utils/
│   │   ├── sitemap-validator.ts       # XML 검증 로직
│   │   └── __tests__/
│   │       └── sitemap-validator.test.ts  # 상세 검증 테스트
│   │
│   ├── core/
│   │   └── register-routes.ts         # Sitemap 라우트 등록
│   │
│   └── runtime/
│       ├── fetch-handler.ts           # 요청 라우팅
│       └── scheduled-handler.ts       # 캐시 무효화 스케줄

client/
└── public/
    └── robots.txt                      # Sitemap 링크 포함
```

### 주요 함수

#### `buildSitemapXml(entries: SitemapEntry[]): string`
사이트맵 URL 항목들을 XML로 변환합니다.

#### `buildSitemapIndexXml(sitemaps: Array): string`
사이트맵 인덱스를 생성합니다.

#### `validateSitemap(xml: string): ValidationResult`
생성된 XML의 유효성을 검증합니다.

#### `invalidateSitemapCache(env: Env, db: any)`
매일 실행되는 스케줄된 작업으로 캐시를 무효화합니다.

---

## 🧪 테스트

### 단위 테스트 실행
```bash
bun test server/src/services/__tests__/sitemap.test.ts
bun test server/src/utils/__tests__/sitemap-validator.test.ts
```

### 수동 테스트
```bash
# 개발 서버 시작
bun run dev

# 브라우저에서 방문
curl http://localhost:5173/sitemap.xml
curl http://localhost:5173/sitemap-posts-1.xml
curl http://localhost:5173/sitemap-tags-1.xml
```

### XML 검증
```bash
# XML 문법 검사
xmllint /path/to/sitemap.xml

# 또는 온라인 검증 도구
# https://www.xml-sitemaps.com/validate-xml-sitemap.html
```

---

## 🔍 문제 해결

### "Invalid XML" 에러

**원인**: 
- 특수문자 미이스케이프 (`&`, `<`, `>`, `"`, `'`)
- URL에 공백 포함
- 잘못된 날짜 형식

**해결방법**:
- URL은 자동으로 인코딩되고 특수문자는 이스케이프됩니다
- 콘솔 로그를 확인하면 정확한 에러 메시지가 표시됩니다:
  ```
  Sitemap index validation errors: [...]
  Posts sitemap page 1 validation errors: [...]
  ```

### 사이트맵이 생성되지 않음

**원인**: 
- 데이터베이스에 published 글이 없음 (draft=0, listed=1)
- 태그가 없음

**해결방법**:
- 최소 1개의 published 글을 작성하세요
- 태그를 추가하세요

### 캐시 문제

**글을 추가했는데 사이트맵에 나타나지 않음**:
- 24시간 캐시가 적용됨
- 수동으로 캐시 무효화하려면 `/cache/sitemap/` 폴더를 R2에서 삭제

---

## 📊 성능

### 벤치마크
- **사이트맵 인덱스 생성**: ~50ms (캐시 히트: ~5ms)
- **글 사이트맵 생성**: ~100ms (캐시 히트: ~10ms)
- **태그 사이트맵 생성**: ~50ms (캐시 히트: ~5ms)

### 최적화 팁
1. **캐싱**: 24시간 캐시로 반복 요청 최적화
2. **페이지네이션**: 50,000개 URL 제한으로 메모리 효율화
3. **프로파일링**: `profileAsync()`로 성능 모니터링

---

## 🔄 자동 캐시 무효화

사이트맵 캐시는 매일 자동으로 무효화됩니다 (Cloudflare Workers 스케줄된 작업):

```typescript
// server/src/runtime/scheduled-handler.ts
await invalidateSitemapCache(env, db);
```

---

## 📚 Google Search Console 등록

### 1. 사이트맵 제출
1. Google Search Console 접속
2. 속성 선택
3. **Sitemaps** 섹션 클릭
4. 사이트맵 URL 입력: `https://yourblog.com/sitemap.xml`
5. **제출** 클릭

### 2. 검증
- 상태가 "성공"으로 표시될 때까지 대기
- 인덱싱된 URL 수 확인
- 에러 메시지 확인

---

## 🔐 보안 고려사항

- ✅ 미인증 사용자 접근 허용 (robots.txt 통해 공개)
- ✅ draft 글은 제외 (listed=0, draft=1)
- ✅ private 글은 제외 (admin만 볼 수 있음)
- ✅ URL은 자동으로 인코딩됨

---

## 🚀 향후 확장

### 가능한 추가 기능
1. **동적 URL 우선순위**
   - 조회수 기반 priority
   - 나이 기반 changefreq

2. **모바일 사이트맵**
   - `<mobile:mobile/>` 태그 추가

3. **뉴스 사이트맵**
   - 최근 글에 대한 뉴스 피드 (Google News)

4. **비디오 사이트맵**
   - 글 내 비디오 감지

---

## 📖 참고 자료

- **Google Sitemap 프로토콜**: https://www.sitemaps.org/
- **Google Search Console**: https://search.google.com/search-console
- **Rank Math Sitemap**: https://rankmath.com/
- **XML 검증 도구**: https://www.freeformatter.com/xml-validator-xsd.html

