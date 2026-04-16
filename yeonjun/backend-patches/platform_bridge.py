"""
beauty-platform (Fastify :3001) 프록시 브릿지
itdasy 앱의 기존 코드 변경 없이, beauty-platform 기능을 /platform/* 경로로 노출.
"""
import os
import httpx
from fastapi import APIRouter, Request, HTTPException

router = APIRouter(prefix="/platform", tags=["Beauty Platform Bridge"])

PLATFORM_URL = os.getenv("BEAUTY_PLATFORM_URL", "http://localhost:3001")


async def _proxy(method: str, path: str, request: Request):
    """beauty-platform으로 요청 프록시. Authorization 헤더 그대로 전달."""
    headers = {}
    auth = request.headers.get("authorization")
    if auth:
        headers["Authorization"] = auth
    headers["Content-Type"] = request.headers.get("content-type", "application/json")

    body = await request.body() if method in ("POST", "PATCH", "PUT", "DELETE") else None

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.request(
                method=method,
                url=f"{PLATFORM_URL}{path}",
                headers=headers,
                content=body,
            )
            return resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Beauty Platform 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.")


# AI 이미지 생성
@router.post("/ai/generate-image")
async def proxy_ai_generate(request: Request):
    return await _proxy("POST", "/v1/ai/generate-image", request)


# 배경 제거 (누끼)
@router.post("/image/remove-bg")
async def proxy_remove_bg(request: Request):
    return await _proxy("POST", "/v1/image/remove-bg", request)


# 갤러리
@router.get("/gallery")
async def proxy_gallery(request: Request):
    qs = f"?{request.query_params}" if request.query_params else ""
    return await _proxy("GET", f"/v1/gallery{qs}", request)


# 결제 상태
@router.get("/billing/entitlements")
async def proxy_billing(request: Request):
    return await _proxy("GET", "/v1/billing/entitlements", request)


# 프로필
@router.get("/profile")
async def proxy_profile(request: Request):
    return await _proxy("GET", "/v1/profile", request)


# Instagram 피드 (Meta API)
@router.get("/meta/feed")
async def proxy_meta_feed(request: Request):
    qs = f"?{request.query_params}" if request.query_params else ""
    return await _proxy("GET", f"/v1/meta/feed{qs}", request)


# Instagram 프로필
@router.get("/meta/profile")
async def proxy_meta_profile(request: Request):
    return await _proxy("GET", "/v1/meta/profile", request)


# 헬스체크
@router.get("/health")
async def proxy_health(request: Request):
    return await _proxy("GET", "/healthz", request)
