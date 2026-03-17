"""
ProcureAI - AI Service (FastAPI)
Parsing (OCR + LLM), validation, forecasting (Prophet / XGBoost).
"""
import io
import os
import json
from typing import Any, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="ProcureAI AI Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:latest")


# --- Parsing: OCR (PDF) + optional LLM extraction, confidence ---

class ParsedItem(BaseModel):
    name: Optional[str] = None
    quantity: float = 0
    unit: Optional[str] = None
    price: Optional[float] = None
    sum: Optional[float] = None
    vat: Optional[float] = None


class ParsedDocument(BaseModel):
    supplier: Optional[str] = None
    documentNumber: Optional[str] = None
    date: Optional[str] = None
    items: list[ParsedItem] = []
    total: Optional[float] = None
    confidence: Optional[float] = None  # 0..1; if < 0.7 backend sets needs_review


def _extract_text_pdf(content: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            parts = []
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
            return "\n".join(parts) if parts else ""
    except ImportError:
        return ""
    except Exception:
        return ""


def _extract_text_image(content: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        return pytesseract.image_to_string(img, lang="rus+eng") or ""
    except Exception:
        return ""


async def _llm_extract(text: str) -> tuple[Optional[str], Optional[str], Optional[str], list[dict], Optional[float], float]:
    """Call Ollama to extract supplier, documentNumber, date, items. Returns (supplier, doc_num, date, items, total, confidence)."""
    import httpx
    prompt = """Extract from the following invoice/receipt text into JSON only. No markdown, no explanation.
Output exactly this JSON structure (use null for missing):
{"supplier": "company name or null", "documentNumber": "number or null", "date": "YYYY-MM-DD or null", "total": number or null, "items": [{"name": "product name", "quantity": number, "unit": "kg/l/pcs or null", "price": number, "sum": number, "vat": number or null}, ...]}
Text:
"""
    prompt += text[:12000]
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            if r.status_code != 200:
                return None, None, None, [], None, 0.4
            out = r.json().get("response", "")
            # Find JSON in response
            start = out.find("{")
            end = out.rfind("}") + 1
            if start >= 0 and end > start:
                obj = json.loads(out[start:end])
                items = obj.get("items") or []
                conf = 0.85 if (obj.get("supplier") or items) else 0.5
                return (
                    obj.get("supplier"),
                    obj.get("documentNumber"),
                    obj.get("date"),
                    items,
                    obj.get("total"),
                    conf,
                )
    except Exception:
        pass
    return None, None, None, [], None, 0.4


@app.post("/parse-invoice", response_model=ParsedDocument)
async def parse_invoice(file: UploadFile = File(...)) -> Any:
    """Parse uploaded invoice (PDF/image): OCR + optional Ollama extraction, returns confidence."""
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(400, "Empty file")

    filename = (file.filename or "").lower()
    text = ""
    if filename.endswith(".pdf") or (file.content_type or "").startswith("application/pdf"):
        text = _extract_text_pdf(content)
    elif file.content_type and file.content_type.startswith("image/"):
        text = _extract_text_image(content)
    if not text or not text.strip():
        # No OCR deps or empty: return stub with low confidence so backend sets needs_review
        return ParsedDocument(
            supplier=None, documentNumber=None, date=None, items=[], total=None, confidence=0.5
        )

    supplier, doc_num, date, raw_items, total, confidence = await _llm_extract(text)
    items = []
    for it in raw_items:
        if isinstance(it, dict):
            items.append(
                ParsedItem(
                    name=it.get("name"),
                    quantity=float(it.get("quantity", 0) or 0),
                    unit=it.get("unit"),
                    price=it.get("price"),
                    sum=it.get("sum"),
                    vat=it.get("vat"),
                )
            )
    return ParsedDocument(
        supplier=supplier,
        documentNumber=doc_num,
        date=date,
        items=items,
        total=total,
        confidence=confidence,
    )


# --- Forecast (stub: returns constant; real impl would use Prophet/XGBoost) ---

class ForecastRequest(BaseModel):
    organization_id: str
    product_id: str
    supplier_id: Optional[str] = None
    horizon_days: int = 7  # 7, 14, 30


class ForecastPoint(BaseModel):
    date: str
    predicted_price: float


class ForecastResponse(BaseModel):
    product_id: str
    horizon_days: int
    forecasts: list[ForecastPoint]


@app.post("/forecast", response_model=ForecastResponse)
async def forecast(request: ForecastRequest) -> Any:
    """Generate price forecast for product. Stub returns flat line."""
    # TODO: load history from DB or passed payload, run Prophet/XGBoost
    from datetime import datetime, timedelta
    base = datetime.utcnow().date()
    forecasts = [
        ForecastPoint(date=(base + timedelta(days=i)).isoformat(), predicted_price=0.0)
        for i in range(1, request.horizon_days + 1)
    ]
    return ForecastResponse(
        product_id=request.product_id,
        horizon_days=request.horizon_days,
        forecasts=forecasts,
    )


# --- AI Procurement Agent (recommendations) ---

class ProcurementIn(BaseModel):
    product_prices: list[dict] = []
    price_forecasts: list[dict] = []
    stock_levels: list[dict] = []
    days_remaining: list[dict] = []  # [{"product_id": "...", "days": 2.5}]
    supplier_prices: list[dict] = []
    supplier_scores: list[dict] = []  # [{"supplier_id": "...", "total_score": 85}]
    consumption_rates: list[dict] = []


class RecommendedOrderLine(BaseModel):
    product_id: str
    supplier_id: str
    quantity: float
    estimated_total: float
    reason: str


class ProcurementOut(BaseModel):
    recommended_orders: list[RecommendedOrderLine]
    recommended_suppliers: list[dict]
    recommended_supplier: Optional[dict] = None  # single best for summary
    order_quantity: Optional[float] = None
    urgency_level: Optional[str] = None  # low, medium, high, critical
    expected_savings: float


@app.post("/procurement/recommendations", response_model=ProcurementOut)
async def procurement_recommendations(body: ProcurementIn) -> Any:
    """
    Heuristic + optional LLM: low stock / high consumption → order more;
    pick cheapest supplier per product from supplier_prices.
    """
    orders: list[RecommendedOrderLine] = []
    suppliers_map: dict[str, dict] = {}
    savings = 0.0
    by_product: dict[str, list[tuple[str, float]]] = {}
    for row in body.supplier_prices or body.product_prices:
        if not isinstance(row, dict):
            continue
        pid = str(row.get("product_id", ""))
        sid = str(row.get("supplier_id", "default"))
        price = float(row.get("price", 0) or 0)
        if not pid:
            continue
        by_product.setdefault(pid, []).append((sid, price))
    stock = {str(s.get("product_id")): float(s.get("days_of_cover", 99)) for s in (body.stock_levels or []) if isinstance(s, dict)}
    days_rem = {str(d.get("product_id")): float(d.get("days", 99)) for d in (body.days_remaining or []) if isinstance(d, dict)}
    for pid, days in days_rem.items():
        if pid not in stock:
            stock[pid] = days
    cons = {str(s.get("product_id")): float(s.get("units_per_day", 0) or 0) for s in (body.consumption_rates or []) if isinstance(s, dict)}
    urgency = "low"
    for pid, offers in by_product.items():
        if not offers:
            continue
        offers.sort(key=lambda x: x[1])
        best_sid, best_price = offers[0]
        alt_price = offers[1][1] if len(offers) > 1 else best_price
        days = stock.get(pid, 7)
        rate = cons.get(pid, 0.5)
        if days < 3 or rate > 0:
            qty = max(rate * 7, 1.0)
            if days < 1:
                urgency = "critical"
            elif days < 2 and urgency != "critical":
                urgency = "high"
            elif days < 3 and urgency not in ("critical", "high"):
                urgency = "medium"
            orders.append(
                RecommendedOrderLine(
                    product_id=pid,
                    supplier_id=best_sid,
                    quantity=round(qty, 2),
                    estimated_total=round(qty * best_price, 2),
                    reason="restock" if days < 3 else "consumption",
                )
            )
            suppliers_map[pid] = {"product_id": pid, "supplier_id": best_sid, "score": 1.0}
            if alt_price > best_price:
                savings += (alt_price - best_price) * qty
    best_order = orders[0] if orders else None
    return ProcurementOut(
        recommended_orders=orders,
        recommended_suppliers=list(suppliers_map.values()),
        recommended_supplier=({"supplier_id": best_order.supplier_id, "quantity": best_order.quantity} if best_order else None),
        order_quantity=best_order.quantity if best_order else None,
        urgency_level=urgency,
        expected_savings=round(savings, 2),
    )


@app.get("/health")
def health():
    return {"status": "ok"}
