# OTA智能调价助手 MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MVP of hotel OTA pricing tool: room/cost management, competitor management with manual price entry, off-season pricing engine, suggestion dashboard, and price history.

**Architecture:** Python FastAPI backend on port 8888 serving REST API + Vue 3 frontend with Element Plus on Vite dev server. SQLite database stored locally. Backend and frontend are separate processes, CORS enabled.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, Pydantic v2, SQLite, Vue 3 (Composition API), Element Plus, Vite, Axios

---

## File Structure

```
ota-pricing-tool/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, router registration
│   ├── database.py             # SQLAlchemy engine, session, Base
│   ├── models.py               # All ORM models
│   ├── schemas.py              # All Pydantic request/response schemas
│   ├── seed.py                 # Seed default pricing_rules row
│   ├── engine/
│   │   └── pricing.py          # Off-season pricing algorithm
│   └── api/
│       ├── __init__.py
│       ├── rooms.py            # /api/rooms CRUD
│       ├── competitors.py      # /api/competitors CRUD
│       ├── competitor_prices.py # /api/competitor-prices CRUD
│       ├── pricing_rules.py    # /api/pricing-rules GET/PUT
│       ├── pricing.py          # /api/pricing/calculate POST, /api/suggestions GET
│       └── price_history.py    # /api/price-history GET/POST
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── style.css
│       ├── router/index.js
│       ├── api/index.js        # Axios instance + all API functions
│       ├── views/
│       │   ├── Dashboard.vue
│       │   ├── RoomTypes.vue
│       │   ├── Competitors.vue
│       │   ├── PricingRules.vue
│       │   └── PriceHistory.vue
│       └── components/
│           └── AppLayout.vue   # Sidebar + router-view layout
└── start.bat                   # Windows startup script
```

---

### Task 1: Project Scaffolding — Backend

**Files:**
- Create: `ota-pricing-tool/backend/main.py`
- Create: `ota-pricing-tool/backend/database.py`
- Create: `ota-pricing-tool/backend/__init__.py`
- Create: `ota-pricing-tool/backend/engine/__init__.py`
- Create: `ota-pricing-tool/backend/api/__init__.py`
- Create: `ota-pricing-tool/backend/requirements.txt`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p /d/project/ota-pricing-tool/backend/engine
mkdir -p /d/project/ota-pricing-tool/backend/api
```

- [ ] **Step 2: Write requirements.txt**

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
pydantic==2.9.2
```

- [ ] **Step 3: Write database.py**

```python
"""SQLAlchemy database setup."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./ota_pricing.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Call on startup."""
    Base.metadata.create_all(bind=engine)
```

- [ ] **Step 4: Write main.py**

```python
"""OTA Pricing Tool — FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from api import rooms, competitors, competitor_prices, pricing_rules, pricing, price_history
from seed import seed_defaults


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_defaults()
    yield


app = FastAPI(title="OTA智能调价助手", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router, prefix="/api", tags=["rooms"])
app.include_router(competitors.router, prefix="/api", tags=["competitors"])
app.include_router(competitor_prices.router, prefix="/api", tags=["competitor-prices"])
app.include_router(pricing_rules.router, prefix="/api", tags=["pricing-rules"])
app.include_router(pricing.router, prefix="/api", tags=["pricing"])
app.include_router(price_history.router, prefix="/api", tags=["price-history"])


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 5: Install Python dependencies**

```bash
cd /d/project/ota-pricing-tool/backend && pip install -r requirements.txt
```

- [ ] **Step 6: Verify backend starts**

```bash
cd /d/project/ota-pricing-tool/backend && python -c "from main import app; print('FastAPI app created OK')"
```

Expected: `FastAPI app created OK`

- [ ] **Step 7: Commit**

```bash
git add ota-pricing-tool/backend/requirements.txt ota-pricing-tool/backend/main.py ota-pricing-tool/backend/database.py
git commit -m "feat: scaffold FastAPI backend with SQLite and CORS"
```

---

### Task 2: Database Models

**Files:**
- Create: `ota-pricing-tool/backend/models.py`

- [ ] **Step 1: Write models.py**

```python
"""SQLAlchemy ORM models for OTA Pricing Tool."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, Float, String, Text, DateTime, ForeignKey, func
)
from database import Base


class RoomType(Base):
    __tablename__ = "room_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="房型名称")
    ota_name = Column(String(100), nullable=False, default="", comment="携程上对应房型名")
    beyondh_name = Column(String(100), nullable=False, default="", comment="别样红上对应房型名")
    cost_price = Column(Float, nullable=False, default=0.0, comment="成本底价")
    total_rooms = Column(Integer, nullable=False, default=0, comment="该房型总间数")
    current_price = Column(Float, nullable=False, default=0.0, comment="当前售价")
    available_rooms = Column(Integer, nullable=False, default=0, comment="今日剩余可售间数")
    is_active = Column(Integer, nullable=False, default=1, comment="是否启用 1=是 0=否")


class Competitor(Base):
    __tablename__ = "competitors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, comment="酒店名称")
    ctrip_url = Column(String(500), nullable=False, default="", comment="携程搜索链接")
    notes = Column(Text, nullable=False, default="", comment="备注")
    created_at = Column(DateTime, nullable=False, default=func.now())


class CompetitorPrice(Base):
    __tablename__ = "competitor_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    competitor_id = Column(Integer, ForeignKey("competitors.id"), nullable=False)
    room_type = Column(String(100), nullable=False, comment="房型名称")
    price = Column(Float, nullable=False, comment="价格")
    date = Column(String(20), nullable=False, default=func.date("now"), comment="入住日期")
    source = Column(String(20), nullable=False, default="manual", comment="数据来源: manual/scraped")
    scraped_at = Column(DateTime, nullable=False, default=func.now())


class PricingRule(Base):
    __tablename__ = "pricing_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    inventory_high_threshold = Column(Float, nullable=False, default=0.40, comment="库存高阈值")
    inventory_low_threshold = Column(Float, nullable=False, default=0.20, comment="库存低阈值")
    aggressive_discount = Column(Float, nullable=False, default=5.0, comment="激进降价幅度(元)")
    balance_margin = Column(Float, nullable=False, default=30.0, comment="平衡模式最低利润(元)")
    price_increase_pct = Column(Float, nullable=False, default=0.10, comment="涨价幅度(%)")
    daily_update_time = Column(String(10), nullable=False, default="09:00", comment="每日调价时间")
    mode = Column(String(20), nullable=False, default="off_season", comment="当前模式")
    profit_margin = Column(Float, nullable=False, default=0.30, comment="旺季目标利润率")


class PriceSuggestion(Base):
    __tablename__ = "price_suggestions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_type_id = Column(Integer, ForeignKey("room_types.id"), nullable=False)
    current_price = Column(Float, nullable=False, comment="当前价格")
    suggested_price = Column(Float, nullable=False, comment="建议价格")
    reason = Column(Text, nullable=False, default="", comment="调价理由")
    mode = Column(String(20), nullable=False, default="off_season", comment="模式")
    is_executed = Column(Integer, nullable=False, default=0, comment="是否已执行")
    created_at = Column(DateTime, nullable=False, default=func.now())


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_type_id = Column(Integer, ForeignKey("room_types.id"), nullable=False)
    old_price = Column(Float, nullable=False)
    new_price = Column(Float, nullable=False)
    operator = Column(String(50), nullable=False, default="系统")
    created_at = Column(DateTime, nullable=False, default=func.now())
```

- [ ] **Step 2: Update database.py imports**

Edit `ota-pricing-tool/backend/database.py` — ensure `from models import *` is NOT needed here. Models are imported via `main.py` → `api/*` → `models`. Verify `init_db` discovers all models. Add this after `Base = declarative_base()`:

```python
# Models are imported in main.py via api modules before init_db() is called
```

- [ ] **Step 3: Verify tables are created**

```bash
cd /d/project/ota-pricing-tool/backend && python -c "
from database import init_db, engine
init_db()
from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
print('Tables:', tables)
assert 'room_types' in tables
assert 'competitors' in tables
assert 'competitor_prices' in tables
assert 'pricing_rules' in tables
assert 'price_suggestions' in tables
assert 'price_history' in tables
print('All tables created successfully')
"
```

Expected: `All tables created successfully`

- [ ] **Step 4: Commit**

```bash
git add ota-pricing-tool/backend/models.py ota-pricing-tool/backend/database.py
git commit -m "feat: add all SQLAlchemy ORM models"
```

---

### Task 3: Pydantic Schemas

**Files:**
- Create: `ota-pricing-tool/backend/schemas.py`

- [ ] **Step 1: Write schemas.py**

```python
"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── RoomType ──────────────────────────────────────────
class RoomTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    ota_name: str = ""
    beyondh_name: str = ""
    cost_price: float = Field(..., ge=0)
    total_rooms: int = Field(..., ge=0)
    current_price: float = Field(0.0, ge=0)
    available_rooms: int = Field(0, ge=0)
    is_active: int = Field(1, ge=0, le=1)


class RoomTypeUpdate(BaseModel):
    name: Optional[str] = None
    ota_name: Optional[str] = None
    beyondh_name: Optional[str] = None
    cost_price: Optional[float] = None
    total_rooms: Optional[int] = None
    current_price: Optional[float] = None
    available_rooms: Optional[int] = None
    is_active: Optional[int] = None


class RoomTypeResponse(BaseModel):
    id: int
    name: str
    ota_name: str
    beyondh_name: str
    cost_price: float
    total_rooms: int
    current_price: float
    available_rooms: int
    is_active: int

    model_config = {"from_attributes": True}


# ── Competitor ────────────────────────────────────────
class CompetitorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    ctrip_url: str = ""
    notes: str = ""


class CompetitorUpdate(BaseModel):
    name: Optional[str] = None
    ctrip_url: Optional[str] = None
    notes: Optional[str] = None


class CompetitorResponse(BaseModel):
    id: int
    name: str
    ctrip_url: str
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── CompetitorPrice ───────────────────────────────────
class CompetitorPriceCreate(BaseModel):
    competitor_id: int = Field(..., gt=0)
    room_type: str = Field(..., min_length=1, max_length=100)
    price: float = Field(..., ge=0)
    date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))


class CompetitorPriceResponse(BaseModel):
    id: int
    competitor_id: int
    room_type: str
    price: float
    date: str
    source: str
    scraped_at: datetime

    model_config = {"from_attributes": True}


# ── PricingRule ───────────────────────────────────────
class PricingRuleUpdate(BaseModel):
    inventory_high_threshold: Optional[float] = Field(None, ge=0, le=1)
    inventory_low_threshold: Optional[float] = Field(None, ge=0, le=1)
    aggressive_discount: Optional[float] = Field(None, ge=0)
    balance_margin: Optional[float] = Field(None, ge=0)
    price_increase_pct: Optional[float] = Field(None, ge=0, le=1)
    daily_update_time: Optional[str] = None
    mode: Optional[str] = None
    profit_margin: Optional[float] = Field(None, ge=0, le=1)


class PricingRuleResponse(BaseModel):
    id: int
    inventory_high_threshold: float
    inventory_low_threshold: float
    aggressive_discount: float
    balance_margin: float
    price_increase_pct: float
    daily_update_time: str
    mode: str
    profit_margin: float

    model_config = {"from_attributes": True}


# ── PriceSuggestion ───────────────────────────────────
class PriceSuggestionResponse(BaseModel):
    id: int
    room_type_id: int
    current_price: float
    suggested_price: float
    reason: str
    mode: str
    is_executed: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── PriceHistory ──────────────────────────────────────
class PriceHistoryCreate(BaseModel):
    room_type_id: int = Field(..., gt=0)
    old_price: float = Field(..., ge=0)
    new_price: float = Field(..., ge=0)
    operator: str = "系统"


class PriceHistoryResponse(BaseModel):
    id: int
    room_type_id: int
    old_price: float
    new_price: float
    operator: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Calculate Request / Response ──────────────────────
class CalculateRequest(BaseModel):
    """Trigger pricing calculation. Uses current DB state."""
    pass


class SuggestionItem(BaseModel):
    room_type_id: int
    room_name: str
    current_price: float
    suggested_price: float
    change_amount: float
    reason: str
    cost_price: float
    profit_per_room: float
    available_rooms: int
    total_rooms: int
    competitor_min_price: float
    competitor_avg_price: float


class CalculateResponse(BaseModel):
    mode: str
    suggestions: list[SuggestionItem]
    generated_at: datetime
```

- [ ] **Step 2: Verify schemas import correctly**

```bash
cd /d/project/ota-pricing-tool/backend && python -c "from schemas import RoomTypeCreate, CalculateResponse; print('Schemas OK:', RoomTypeCreate, CalculateResponse)"
```

Expected: `Schemas OK: <class ...RoomTypeCreate> <class ...CalculateResponse>`

- [ ] **Step 3: Commit**

```bash
git add ota-pricing-tool/backend/schemas.py
git commit -m "feat: add all Pydantic request/response schemas"
```

---

### Task 4: Seed Default Data

**Files:**
- Create: `ota-pricing-tool/backend/seed.py`

- [ ] **Step 1: Write seed.py**

```python
"""Seed default pricing rules row if none exists."""
from database import SessionLocal
from models import PricingRule


def seed_defaults():
    db = SessionLocal()
    try:
        existing = db.query(PricingRule).first()
        if existing is None:
            default = PricingRule()
            db.add(default)
            db.commit()
            print("[seed] Created default pricing_rules row.")
    finally:
        db.close()
```

- [ ] **Step 2: Verify seed runs on startup**

```bash
cd /d/project/ota-pricing-tool/backend && rm -f ota_pricing.db && python -c "
from database import init_db, SessionLocal
from models import PricingRule
from seed import seed_defaults
init_db()
seed_defaults()
db = SessionLocal()
rules = db.query(PricingRule).first()
print('Rules row exists:', rules is not None)
print('Mode:', rules.mode, 'High threshold:', rules.inventory_high_threshold)
db.close()
"
```

Expected: `Rules row exists: True` with default values

- [ ] **Step 3: Commit**

```bash
git add ota-pricing-tool/backend/seed.py
git commit -m "feat: add seed script for default pricing rules"
```

---

### Task 5: Room Types API

**Files:**
- Create: `ota-pricing-tool/backend/api/rooms.py`

- [ ] **Step 1: Write rooms API**

```python
"""Room types CRUD API."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import RoomType
from schemas import RoomTypeCreate, RoomTypeUpdate, RoomTypeResponse

router = APIRouter()


@router.get("/rooms", response_model=list[RoomTypeResponse])
def list_rooms(db: Session = Depends(get_db)):
    return db.query(RoomType).order_by(RoomType.id).all()


@router.post("/rooms", response_model=RoomTypeResponse, status_code=201)
def create_room(data: RoomTypeCreate, db: Session = Depends(get_db)):
    room = RoomType(**data.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.put("/rooms/{room_id}", response_model=RoomTypeResponse)
def update_room(room_id: int, data: RoomTypeUpdate, db: Session = Depends(get_db)):
    room = db.query(RoomType).filter(RoomType.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="房型不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(RoomType).filter(RoomType.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="房型不存在")
    db.delete(room)
    db.commit()
```

- [ ] **Step 2: Test API with curl**

```bash
# Start backend in background first
cd /d/project/ota-pricing-tool/backend && python -m uvicorn main:app --host 127.0.0.1 --port 8888 &
sleep 2

# Create a room type
curl -s -X POST http://127.0.0.1:8888/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"标准大床房","ota_name":"舒适大床房","cost_price":180,"total_rooms":30,"current_price":328,"available_rooms":18}' | python -m json.tool

# List room types
curl -s http://127.0.0.1:8888/api/rooms | python -m json.tool

# Update a room type
curl -s -X PUT http://127.0.0.1:8888/api/rooms/1 \
  -H "Content-Type: application/json" \
  -d '{"current_price":298}' | python -m json.tool

# Delete a room type
curl -s -X DELETE http://127.0.0.1:8888/api/rooms/1 -w "%{http_code}"
```

Expected: Create returns 201 with the room JSON. List returns array. Update returns modified. Delete returns 204.

- [ ] **Step 4: Commit**

```bash
git add ota-pricing-tool/backend/api/rooms.py ota-pricing-tool/backend/api/__init__.py
git commit -m "feat: add room types CRUD API"
```

---

### Task 6: Competitors API

**Files:**
- Create: `ota-pricing-tool/backend/api/competitors.py`

- [ ] **Step 1: Write competitors API**

```python
"""Competitor hotels CRUD API."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Competitor
from schemas import CompetitorCreate, CompetitorUpdate, CompetitorResponse

router = APIRouter()


@router.get("/competitors", response_model=list[CompetitorResponse])
def list_competitors(db: Session = Depends(get_db)):
    return db.query(Competitor).order_by(Competitor.id).all()


@router.post("/competitors", response_model=CompetitorResponse, status_code=201)
def create_competitor(data: CompetitorCreate, db: Session = Depends(get_db)):
    comp = Competitor(**data.model_dump())
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.put("/competitors/{competitor_id}", response_model=CompetitorResponse)
def update_competitor(competitor_id: int, data: CompetitorUpdate, db: Session = Depends(get_db)):
    comp = db.query(Competitor).filter(Competitor.id == competitor_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="竞对不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(comp, key, value)
    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/competitors/{competitor_id}", status_code=204)
def delete_competitor(competitor_id: int, db: Session = Depends(get_db)):
    comp = db.query(Competitor).filter(Competitor.id == competitor_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="竞对不存在")
    db.delete(comp)
    db.commit()
```

- [ ] **Step 2: Test with curl**

```bash
# Create competitor
curl -s -X POST http://127.0.0.1:8888/api/competitors \
  -H "Content-Type: application/json" \
  -d '{"name":"半山酒店","ctrip_url":"https://hotels.ctrip.com/hotel/123","notes":"同区域主要竞对"}' | python -m json.tool

# List
curl -s http://127.0.0.1:8888/api/competitors | python -m json.tool
```

- [ ] **Step 3: Commit**

```bash
git add ota-pricing-tool/backend/api/competitors.py
git commit -m "feat: add competitor CRUD API"
```

---

### Task 7: Competitor Prices API (Manual Entry)

**Files:**
- Create: `ota-pricing-tool/backend/api/competitor_prices.py`

- [ ] **Step 1: Write competitor prices API**

```python
"""Competitor price entries API (manual entry)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
from database import get_db
from models import CompetitorPrice, Competitor
from schemas import CompetitorPriceCreate, CompetitorPriceResponse

router = APIRouter()


@router.get("/competitor-prices", response_model=list[CompetitorPriceResponse])
def list_prices(
    date_filter: str = Query(default="", alias="date"),
    competitor_id: int = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(CompetitorPrice)
    if date_filter:
        q = q.filter(CompetitorPrice.date == date_filter)
    if competitor_id is not None:
        q = q.filter(CompetitorPrice.competitor_id == competitor_id)
    return q.order_by(CompetitorPrice.scraped_at.desc()).all()


@router.post("/competitor-prices", response_model=CompetitorPriceResponse, status_code=201)
def add_price(data: CompetitorPriceCreate, db: Session = Depends(get_db)):
    # Verify competitor exists
    comp = db.query(Competitor).filter(Competitor.id == data.competitor_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="竞对不存在")

    if not data.date:
        data.date = str(date.today())

    entry = CompetitorPrice(**data.model_dump(), source="manual")
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/competitor-prices/{price_id}", status_code=204)
def delete_price(price_id: int, db: Session = Depends(get_db)):
    entry = db.query(CompetitorPrice).filter(CompetitorPrice.id == price_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="价格记录不存在")
    db.delete(entry)
    db.commit()
```

- [ ] **Step 2: Test with curl**

```bash
# Add manual competitor price
curl -s -X POST http://127.0.0.1:8888/api/competitor-prices \
  -H "Content-Type: application/json" \
  -d '{"competitor_id":1,"room_type":"标准大床房","price":288,"date":"2026-06-09"}' | python -m json.tool

# List today's prices
curl -s "http://127.0.0.1:8888/api/competitor-prices?date=2026-06-09" | python -m json.tool
```

- [ ] **Step 3: Commit**

```bash
git add ota-pricing-tool/backend/api/competitor_prices.py
git commit -m "feat: add competitor prices API with manual entry"
```

---

### Task 8: Pricing Rules API

**Files:**
- Create: `ota-pricing-tool/backend/api/pricing_rules.py`

- [ ] **Step 1: Write pricing rules API**

```python
"""Pricing rules configuration API — single-row config."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import PricingRule
from schemas import PricingRuleUpdate, PricingRuleResponse

router = APIRouter()


@router.get("/pricing-rules", response_model=PricingRuleResponse)
def get_rules(db: Session = Depends(get_db)):
    rules = db.query(PricingRule).first()
    if not rules:
        raise HTTPException(status_code=500, detail="定价规则未初始化，请重启服务")
    return rules


@router.put("/pricing-rules", response_model=PricingRuleResponse)
def update_rules(data: PricingRuleUpdate, db: Session = Depends(get_db)):
    rules = db.query(PricingRule).first()
    if not rules:
        raise HTTPException(status_code=500, detail="定价规则未初始化")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rules, key, value)
    db.commit()
    db.refresh(rules)
    return rules
```

- [ ] **Step 2: Test with curl**

```bash
# Get rules
curl -s http://127.0.0.1:8888/api/pricing-rules | python -m json.tool

# Update rules
curl -s -X PUT http://127.0.0.1:8888/api/pricing-rules \
  -H "Content-Type: application/json" \
  -d '{"inventory_high_threshold":0.35,"mode":"off_season"}' | python -m json.tool
```

- [ ] **Step 3: Commit**

```bash
git add ota-pricing-tool/backend/api/pricing_rules.py
git commit -m "feat: add pricing rules GET/PUT API"
```

---

### Task 9: Pricing Engine

**Files:**
- Create: `ota-pricing-tool/backend/engine/pricing.py`

- [ ] **Step 1: Write pricing engine**

```python
"""Off-season pricing algorithm — smart following."""
from dataclasses import dataclass
from models import PricingRule


@dataclass
class PricingResult:
    suggested_price: float
    reason: str
    competitor_min: float
    competitor_avg: float


def calculate_off_season(
    cost_price: float,
    competitor_prices: list[float],
    available_rooms: int,
    total_rooms: int,
    rules: PricingRule,
) -> PricingResult:
    """Calculate suggested price for off-season mode.

    Algorithm:
      - occupancy > high_threshold → aggressive undercut
      - low_threshold <= occupancy <= high_threshold → balanced follow
      - occupancy < low_threshold → raise price for profit
    Always ensures price >= cost_price + safety margin.
    """
    if total_rooms <= 0:
        total_rooms = 1  # safety

    occupancy = available_rooms / total_rooms

    if not competitor_prices:
        suggested = max(cost_price + rules.balance_margin, cost_price * 1.15)
        return PricingResult(
            suggested_price=round(suggested, 0),
            reason=f"无竞对数据，按成本+最低利润定价",
            competitor_min=0,
            competitor_avg=0,
        )

    p_min = min(competitor_prices)
    p_avg = sum(competitor_prices) / len(competitor_prices)

    if occupancy > rules.inventory_high_threshold:
        # Aggressive: price just below the cheapest competitor
        suggested = max(p_min - rules.aggressive_discount, cost_price + 10)
        reason = (
            f"库存充足({available_rooms}/{total_rooms}间，"
            f"入住率{int((1-occupancy)*100)}%)，"
            f"激进降价抢客，比竞对最低价低{rules.aggressive_discount}元"
        )
    elif occupancy >= rules.inventory_low_threshold:
        # Balanced: between min and average competitor price
        suggested = max((p_min + p_avg) / 2, cost_price + rules.balance_margin)
        reason = (
            f"库存适中({available_rooms}/{total_rooms}间，"
            f"入住率{int((1-occupancy)*100)}%)，"
            f"平衡跟随竞对均价"
        )
    else:
        # Price up: above average competitor price
        suggested = max(p_avg * (1 + rules.price_increase_pct), cost_price + 50)
        reason = (
            f"库存紧张({available_rooms}/{total_rooms}间，"
            f"入住率{int((1-occupancy)*100)}%)，"
            f"涨价{int(rules.price_increase_pct*100)}%保利润"
        )

    return PricingResult(
        suggested_price=round(suggested, 0),
        reason=reason,
        competitor_min=p_min,
        competitor_avg=round(p_avg, 0),
    )
```

- [ ] **Step 2: Run unit test**

```bash
cd /d/project/ota-pricing-tool/backend && python -c "
from engine.pricing import calculate_off_season
from models import PricingRule

rules = PricingRule()
rules.inventory_high_threshold = 0.40
rules.inventory_low_threshold = 0.20
rules.aggressive_discount = 5.0
rules.balance_margin = 30.0
rules.price_increase_pct = 0.10

# Test 1: High inventory — should undercut competitor
result = calculate_off_season(180, [288, 318, 348], 30, 50, rules)
print('High inventory:', result)
assert result.suggested_price < 288, f'Expected < 288, got {result.suggested_price}'

# Test 2: Medium inventory — balanced
result = calculate_off_season(180, [288, 318, 348], 15, 50, rules)
print('Mid inventory:', result)
assert result.suggested_price >= 288, f'Expected >= 288, got {result.suggested_price}'

# Test 3: Low inventory — price up
result = calculate_off_season(180, [288, 318, 348], 5, 50, rules)
print('Low inventory:', result)
assert result.suggested_price > 318, f'Expected > 318 (avg), got {result.suggested_price}'

# Test 4: No competitor data — use cost + margin
result = calculate_off_season(180, [], 30, 50, rules)
print('No competitors:', result)
assert result.suggested_price >= 180 + 30

# Test 5: Never below cost + 10
result = calculate_off_season(500, [100, 120], 40, 50, rules)
print('High cost:', result)
assert result.suggested_price >= 510

print('All pricing engine tests passed!')
"
```

Expected: `All pricing engine tests passed!`

- [ ] **Step 3: Commit**

```bash
git add ota-pricing-tool/backend/engine/pricing.py ota-pricing-tool/backend/engine/__init__.py
git commit -m "feat: add off-season pricing algorithm engine"
```

---

### Task 10: Pricing Calculate & Suggestions API

**Files:**
- Create: `ota-pricing-tool/backend/api/pricing.py`

- [ ] **Step 1: Write pricing API**

```python
"""Pricing calculation and suggestions API."""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import RoomType, CompetitorPrice, PricingRule, PriceSuggestion
from schemas import CalculateResponse, SuggestionItem, PriceSuggestionResponse
from engine.pricing import calculate_off_season

router = APIRouter()


@router.post("/pricing/calculate", response_model=CalculateResponse)
def run_calculation(db: Session = Depends(get_db)):
    """Run pricing engine and generate suggestions for all active room types."""
    rules = db.query(PricingRule).first()
    if not rules:
        from models import PricingRule as PR
        rules = PR()
        db.add(rules)
        db.commit()
        db.refresh(rules)

    room_types = db.query(RoomType).filter(RoomType.is_active == 1).all()
    today = datetime.now().strftime("%Y-%m-%d")
    suggestions: list[SuggestionItem] = []

    for room in room_types:
        # Gather competitor prices for this room type
        prices = (
            db.query(CompetitorPrice.price)
            .filter(
                CompetitorPrice.room_type == room.ota_name,
                CompetitorPrice.date == today,
            )
            .all()
        )
        competitor_prices = [p[0] for p in prices]

        # Also try matching by room name if ota_name is empty
        if not competitor_prices and room.name:
            prices = (
                db.query(CompetitorPrice.price)
                .filter(
                    CompetitorPrice.room_type == room.name,
                    CompetitorPrice.date == today,
                )
                .all()
            )
            competitor_prices = [p[0] for p in prices]

        result = calculate_off_season(
            cost_price=room.cost_price,
            competitor_prices=competitor_prices,
            available_rooms=room.available_rooms,
            total_rooms=room.total_rooms,
            rules=rules,
        )

        change = result.suggested_price - room.current_price

        suggestions.append(SuggestionItem(
            room_type_id=room.id,
            room_name=room.name,
            current_price=room.current_price,
            suggested_price=result.suggested_price,
            change_amount=round(change, 0),
            reason=result.reason,
            cost_price=room.cost_price,
            profit_per_room=round(result.suggested_price - room.cost_price, 0),
            available_rooms=room.available_rooms,
            total_rooms=room.total_rooms,
            competitor_min_price=result.competitor_min,
            competitor_avg_price=result.competitor_avg,
        ))

        # Save suggestion to DB
        sug = PriceSuggestion(
            room_type_id=room.id,
            current_price=room.current_price,
            suggested_price=result.suggested_price,
            reason=result.reason,
            mode=rules.mode,
        )
        db.add(sug)

    db.commit()

    return CalculateResponse(
        mode="off_season",
        suggestions=suggestions,
        generated_at=datetime.now(),
    )


@router.get("/suggestions", response_model=list[PriceSuggestionResponse])
def get_suggestions(limit: int = 50, db: Session = Depends(get_db)):
    """Get latest pricing suggestions."""
    return (
        db.query(PriceSuggestion)
        .order_by(PriceSuggestion.created_at.desc())
        .limit(limit)
        .all()
    )
```

- [ ] **Step 2: Test with curl**

```bash
# First ensure we have a room type with data
curl -s -X POST http://127.0.0.1:8888/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"标准大床房","ota_name":"标准大床房","cost_price":180,"total_rooms":30,"current_price":328,"available_rooms":18}'

# Add competitor price for same room type
curl -s -X POST http://127.0.0.1:8888/api/competitor-prices \
  -H "Content-Type: application/json" \
  -d '{"competitor_id":1,"room_type":"标准大床房","price":288,"date":"2026-06-09"}'

# Run calculation
curl -s -X POST http://127.0.0.1:8888/api/pricing/calculate | python -m json.tool

# Get suggestions
curl -s http://127.0.0.1:8888/api/suggestions | python -m json.tool
```

Expected: Calculate returns JSON with `mode: "off_season"` and array of `suggestions` with `suggested_price` and `reason`.

- [ ] **Step 3: Commit**

```bash
git add ota-pricing-tool/backend/api/pricing.py
git commit -m "feat: add pricing calculate and suggestions API"
```

---

### Task 11: Price History API

**Files:**
- Create: `ota-pricing-tool/backend/api/price_history.py`

- [ ] **Step 1: Write price history API**

```python
"""Price history API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import PriceHistory, RoomType
from schemas import PriceHistoryCreate, PriceHistoryResponse

router = APIRouter()


@router.get("/price-history", response_model=list[PriceHistoryResponse])
def list_history(
    room_type_id: int = Query(default=None),
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(PriceHistory)
    if room_type_id is not None:
        q = q.filter(PriceHistory.room_type_id == room_type_id)
    return q.order_by(PriceHistory.created_at.desc()).limit(limit).all()


@router.post("/price-history", response_model=PriceHistoryResponse, status_code=201)
def record_price_change(data: PriceHistoryCreate, db: Session = Depends(get_db)):
    room = db.query(RoomType).filter(RoomType.id == data.room_type_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="房型不存在")

    record = PriceHistory(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
```

- [ ] **Step 2: Test with curl**

```bash
curl -s -X POST http://127.0.0.1:8888/api/price-history \
  -H "Content-Type: application/json" \
  -d '{"room_type_id":1,"old_price":328,"new_price":288,"operator":"管理员"}' | python -m json.tool

curl -s http://127.0.0.1:8888/api/price-history | python -m json.tool
```

- [ ] **Step 3: Commit**

```bash
git add ota-pricing-tool/backend/api/price_history.py
git commit -m "feat: add price history API"
```

---

### Task 12: Project Scaffolding — Frontend

**Files:**
- Create: `ota-pricing-tool/frontend/package.json`
- Create: `ota-pricing-tool/frontend/vite.config.js`
- Create: `ota-pricing-tool/frontend/index.html`
- Create: `ota-pricing-tool/frontend/src/main.js`
- Create: `ota-pricing-tool/frontend/src/App.vue`
- Create: `ota-pricing-tool/frontend/src/style.css`
- Create: `ota-pricing-tool/frontend/src/router/index.js`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "ota-pricing-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "vue-router": "^4.4.0",
    "element-plus": "^2.8.0",
    "@element-plus/icons-vue": "^2.3.1",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Write vite.config.js**

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Write index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OTA智能调价助手</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write src/main.js**

```javascript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(ElementPlus, { locale: { el: { } } })
app.use(router)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.mount('#app')
```

- [ ] **Step 5: Write src/App.vue**

```vue
<template>
  <router-view />
</template>

<script setup>
</script>
```

- [ ] **Step 6: Write src/style.css**

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  background: #f5f7fa;
}

#app {
  min-height: 100vh;
}
```

- [ ] **Step 7: Write src/router/index.js**

```javascript
import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'

const routes = [
  {
    path: '/',
    component: AppLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '调价仪表盘' },
      },
      {
        path: 'competitors',
        name: 'Competitors',
        component: () => import('../views/Competitors.vue'),
        meta: { title: '竞争圈管理' },
      },
      {
        path: 'room-types',
        name: 'RoomTypes',
        component: () => import('../views/RoomTypes.vue'),
        meta: { title: '房型与成本' },
      },
      {
        path: 'pricing-rules',
        name: 'PricingRules',
        component: () => import('../views/PricingRules.vue'),
        meta: { title: '调价规则' },
      },
      {
        path: 'price-history',
        name: 'PriceHistory',
        component: () => import('../views/PriceHistory.vue'),
        meta: { title: '调价记录' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
```

- [ ] **Step 8: Install and verify**

```bash
cd /d/project/ota-pricing-tool/frontend && npm install
```

- [ ] **Step 9: Commit**

```bash
git add ota-pricing-tool/frontend/
git commit -m "feat: scaffold Vue 3 + Element Plus frontend with Vite"
```

---

### Task 13: Frontend API Layer + AppLayout

**Files:**
- Create: `ota-pricing-tool/frontend/src/api/index.js`
- Create: `ota-pricing-tool/frontend/src/components/AppLayout.vue`

- [ ] **Step 1: Write src/api/index.js**

```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

// ── Rooms ──
export const getRooms = () => api.get('/rooms')
export const createRoom = (data) => api.post('/rooms', data)
export const updateRoom = (id, data) => api.put(`/rooms/${id}`, data)
export const deleteRoom = (id) => api.delete(`/rooms/${id}`)

// ── Competitors ──
export const getCompetitors = () => api.get('/competitors')
export const createCompetitor = (data) => api.post('/competitors', data)
export const updateCompetitor = (id, data) => api.put(`/competitors/${id}`, data)
export const deleteCompetitor = (id) => api.delete(`/competitors/${id}`)

// ── Competitor Prices ──
export const getCompetitorPrices = (params) => api.get('/competitor-prices', { params })
export const addCompetitorPrice = (data) => api.post('/competitor-prices', data)
export const deleteCompetitorPrice = (id) => api.delete(`/competitor-prices/${id}`)

// ── Pricing Rules ──
export const getPricingRules = () => api.get('/pricing-rules')
export const updatePricingRules = (data) => api.put('/pricing-rules', data)

// ── Pricing ──
export const runCalculation = () => api.post('/pricing/calculate')
export const getSuggestions = (limit = 50) => api.get('/suggestions', { params: { limit } })

// ── Price History ──
export const getPriceHistory = (params) => api.get('/price-history', { params })
export const recordPriceChange = (data) => api.post('/price-history', data)

// ── Health ──
export const healthCheck = () => api.get('/health')

export default api
```

- [ ] **Step 2: Write AppLayout.vue**

```vue
<template>
  <el-container style="min-height: 100vh;">
    <el-aside width="200px" style="background: #1e293b;">
      <div style="padding: 16px; color: #fff; font-weight: 700; font-size: 15px; border-bottom: 1px solid #334155;">
        🏨 OTA调价助手
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#1e293b"
        text-color="#94a3b8"
        active-text-color="#fff"
        style="border-right: none;"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>调价仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/competitors">
          <el-icon><Connection /></el-icon>
          <span>竞争圈管理</span>
        </el-menu-item>
        <el-menu-item index="/room-types">
          <el-icon><OfficeBuilding /></el-icon>
          <span>房型与成本</span>
        </el-menu-item>
        <el-menu-item index="/pricing-rules">
          <el-icon><Setting /></el-icon>
          <span>调价规则</span>
        </el-menu-item>
        <el-menu-item index="/price-history">
          <el-icon><Clock /></el-icon>
          <span>调价记录</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main style="padding: 20px; background: #f5f7fa;">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd /d/project/ota-pricing-tool/frontend && npx vite build --logLevel error 2>&1 | tail -5
```

Expected: Build completes without errors (may have CSS warnings, that's fine).

- [ ] **Step 4: Commit**

```bash
git add ota-pricing-tool/frontend/src/api/index.js ota-pricing-tool/frontend/src/components/AppLayout.vue
git commit -m "feat: add API layer and AppLayout with sidebar navigation"
```

---

### Task 14: RoomTypes Page

**Files:**
- Create: `ota-pricing-tool/frontend/src/views/RoomTypes.vue`

- [ ] **Step 1: Write RoomTypes.vue**

```vue
<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0;">🛏 房型与成本管理</h2>
      <el-button type="primary" @click="openDialog(null)">+ 添加房型</el-button>
    </div>

    <el-table :data="rooms" border stripe v-loading="loading">
      <el-table-column prop="name" label="房型名称" width="140" />
      <el-table-column prop="ota_name" label="携程房型名" width="140" />
      <el-table-column prop="beyondh_name" label="别样红房型名" width="140" />
      <el-table-column prop="cost_price" label="成本价(元)" width="100" />
      <el-table-column prop="total_rooms" label="总间数" width="80" />
      <el-table-column prop="available_rooms" label="今日剩余" width="80" />
      <el-table-column prop="current_price" label="当前售价(元)" width="110" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
            {{ row.is_active ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="140">
        <template #default="{ row }">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑房型' : '添加房型'"
      width="500px"
      @close="resetForm"
    >
      <el-form :model="form" label-width="110px" ref="formRef">
        <el-form-item label="房型名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="携程房型名">
          <el-input v-model="form.ota_name" placeholder="携程上展示的房型名" />
        </el-form-item>
        <el-form-item label="别样红房型名">
          <el-input v-model="form.beyondh_name" placeholder="PMS中的房型名" />
        </el-form-item>
        <el-form-item label="成本底价(元)" required>
          <el-input-number v-model="form.cost_price" :min="0" :precision="0" />
        </el-form-item>
        <el-form-item label="总间数" required>
          <el-input-number v-model="form.total_rooms" :min="0" />
        </el-form-item>
        <el-form-item label="当前售价(元)">
          <el-input-number v-model="form.current_price" :min="0" :precision="0" />
        </el-form-item>
        <el-form-item label="今日剩余">
          <el-input-number v-model="form.available_rooms" :min="0" :max="form.total_rooms" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.is_active" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRooms, createRoom, updateRoom, deleteRoom } from '../api'

const rooms = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const defaultForm = {
  name: '', ota_name: '', beyondh_name: '',
  cost_price: 0, total_rooms: 0, current_price: 0,
  available_rooms: 0, is_active: 1,
}
const form = reactive({ ...defaultForm })

function resetForm() {
  Object.assign(form, defaultForm)
  editingId.value = null
}

function openDialog(row) {
  if (row) {
    editingId.value = row.id
    Object.assign(form, {
      name: row.name, ota_name: row.ota_name, beyondh_name: row.beyondh_name,
      cost_price: row.cost_price, total_rooms: row.total_rooms,
      current_price: row.current_price, available_rooms: row.available_rooms,
      is_active: row.is_active,
    })
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

async function fetchRooms() {
  loading.value = true
  try {
    const { data } = await getRooms()
    rooms.value = data
  } catch (e) {
    ElMessage.error('加载房型失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    if (editingId.value) {
      await updateRoom(editingId.value, form)
      ElMessage.success('房型已更新')
    } else {
      await createRoom(form)
      ElMessage.success('房型已添加')
    }
    dialogVisible.value = false
    await fetchRooms()
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除房型"${row.name}"？`, '确认删除', {
      type: 'warning',
    })
    await deleteRoom(row.id)
    ElMessage.success('已删除')
    await fetchRooms()
  } catch { /* cancelled */ }
}

onMounted(fetchRooms)
</script>
```

- [ ] **Step 2: Start backend and verify page loads**

```bash
# Start backend if not running
cd /d/project/ota-pricing-tool/backend && python -m uvicorn main:app --host 127.0.0.1 --port 8888 &
# Start frontend dev server
cd /d/project/ota-pricing-tool/frontend && npx vite --host 2>&1 &
echo "Open http://localhost:5173/room-types"
```

- [ ] **Step 3: Commit**

```bash
git add ota-pricing-tool/frontend/src/views/RoomTypes.vue
git commit -m "feat: add room types management page"
```

---

### Task 15: Competitors Page (with Manual Price Entry)

**Files:**
- Create: `ota-pricing-tool/frontend/src/views/Competitors.vue`

- [ ] **Step 1: Write Competitors.vue**

```vue
<template>
  <div>
    <h2>🏨 竞争圈管理</h2>

    <!-- Competitor List -->
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>竞对酒店列表</span>
          <el-button type="primary" size="small" @click="openCompDialog(null)">+ 添加竞对</el-button>
        </div>
      </template>
      <el-table :data="competitors" border stripe v-loading="compLoading">
        <el-table-column prop="name" label="酒店名称" width="180" />
        <el-table-column prop="ctrip_url" label="携程链接" min-width="200" show-overflow-tooltip />
        <el-table-column prop="notes" label="备注" width="150" />
        <el-table-column prop="created_at" label="加入时间" width="160">
          <template #default="{ row }">
            {{ new Date(row.created_at).toLocaleDateString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" @click="openCompDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteComp(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Manual Price Entry -->
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>📝 手动录入竞对价格（今日）</span>
          <el-button type="success" size="small" @click="openPriceDialog()">+ 录入价格</el-button>
        </div>
      </template>
      <el-table :data="prices" border stripe v-loading="priceLoading" empty-text="暂无今日价格数据">
        <el-table-column label="酒店" width="180">
          <template #default="{ row }">
            {{ competitorMap[row.competitor_id] || '未知' }}
          </template>
        </el-table-column>
        <el-table-column prop="room_type" label="房型" width="150" />
        <el-table-column prop="price" label="价格(元)" width="120">
          <template #default="{ row }">
            <span style="font-weight: 700; color: #e74c3c;">¥{{ row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="danger" @click="deletePrice(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Competitor Dialog -->
    <el-dialog v-model="compDialogVisible" :title="editingComp ? '编辑竞对' : '添加竞对'" width="450px">
      <el-form :model="compForm" label-width="100px">
        <el-form-item label="酒店名称" required>
          <el-input v-model="compForm.name" />
        </el-form-item>
        <el-form-item label="携程链接">
          <el-input v-model="compForm.ctrip_url" placeholder="携程酒店详情页URL" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="compForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="compDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveComp" :loading="compSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- Price Entry Dialog -->
    <el-dialog v-model="priceDialogVisible" title="录入竞对价格" width="400px">
      <el-form :model="priceForm" label-width="100px">
        <el-form-item label="竞对酒店" required>
          <el-select v-model="priceForm.competitor_id" placeholder="选择竞对" style="width: 100%;">
            <el-option v-for="c in competitors" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="房型名称" required>
          <el-input v-model="priceForm.room_type" placeholder="如：标准大床房" />
        </el-form-item>
        <el-form-item label="价格(元)" required>
          <el-input-number v-model="priceForm.price" :min="0" :precision="0" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="priceForm.date" type="date" value-format="YYYY-MM-DD"
            placeholder="选择日期" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="priceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePrice" :loading="priceSaving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getCompetitors, createCompetitor, updateCompetitor, deleteCompetitor,
  getCompetitorPrices, addCompetitorPrice, deleteCompetitorPrice,
} from '../api'

const competitors = ref([])
const prices = ref([])
const compLoading = ref(false)
const priceLoading = ref(false)
const compSaving = ref(false)
const priceSaving = ref(false)
const compDialogVisible = ref(false)
const priceDialogVisible = ref(false)
const editingComp = ref(null)

const compForm = reactive({ name: '', ctrip_url: '', notes: '' })

const today = new Date().toISOString().slice(0, 10)

const priceForm = reactive({
  competitor_id: null,
  room_type: '',
  price: 0,
  date: today,
})

const competitorMap = computed(() => {
  const m = {}
  competitors.value.forEach((c) => { m[c.id] = c.name })
  return m
})

async function fetchCompetitors() {
  compLoading.value = true
  try {
    const { data } = await getCompetitors()
    competitors.value = data
  } catch (e) {
    ElMessage.error('加载竞对失败: ' + e.message)
  } finally {
    compLoading.value = false
  }
}

async function fetchPrices() {
  priceLoading.value = true
  try {
    const { data } = await getCompetitorPrices({ date: today })
    prices.value = data
  } catch (e) {
    ElMessage.error('加载价格失败: ' + e.message)
  } finally {
    priceLoading.value = false
  }
}

function openCompDialog(row) {
  editingComp.value = row
  if (row) {
    Object.assign(compForm, { name: row.name, ctrip_url: row.ctrip_url, notes: row.notes })
  } else {
    Object.assign(compForm, { name: '', ctrip_url: '', notes: '' })
  }
  compDialogVisible.value = true
}

async function saveComp() {
  compSaving.value = true
  try {
    if (editingComp.value) {
      await updateCompetitor(editingComp.value.id, compForm)
      ElMessage.success('已更新')
    } else {
      await createCompetitor(compForm)
      ElMessage.success('已添加')
    }
    compDialogVisible.value = false
    await fetchCompetitors()
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  } finally {
    compSaving.value = false
  }
}

async function deleteComp(row) {
  try {
    await ElMessageBox.confirm(`确定删除"${row.name}"及其价格数据？`, '确认', { type: 'warning' })
    await deleteCompetitor(row.id)
    ElMessage.success('已删除')
    await fetchCompetitors()
    await fetchPrices()
  } catch { /* cancelled */ }
}

function openPriceDialog() {
  priceForm.competitor_id = competitors.value[0]?.id || null
  priceForm.room_type = ''
  priceForm.price = 0
  priceForm.date = today
  priceDialogVisible.value = true
}

async function savePrice() {
  if (!priceForm.competitor_id) {
    ElMessage.warning('请选择竞对酒店')
    return
  }
  priceSaving.value = true
  try {
    await addCompetitorPrice(priceForm)
    ElMessage.success('价格已录入')
    priceDialogVisible.value = false
    await fetchPrices()
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  } finally {
    priceSaving.value = false
  }
}

async function deletePrice(row) {
  try {
    await deleteCompetitorPrice(row.id)
    ElMessage.success('已删除')
    await fetchPrices()
  } catch (e) {
    ElMessage.error('删除失败: ' + e.message)
  }
}

onMounted(() => {
  fetchCompetitors()
  fetchPrices()
})
</script>
```

- [ ] **Step 2: Commit**

```bash
git add ota-pricing-tool/frontend/src/views/Competitors.vue
git commit -m "feat: add competitor management page with manual price entry"
```

---

### Task 16: PricingRules Page

**Files:**
- Create: `ota-pricing-tool/frontend/src/views/PricingRules.vue`

- [ ] **Step 1: Write PricingRules.vue**

```vue
<template>
  <div>
    <h2>⚙ 调价规则设置</h2>
    <el-card v-loading="loading">
      <el-form :model="form" label-width="200px" style="max-width: 600px;">
        <el-divider content-position="left">库存阈值</el-divider>
        <el-form-item label="库存高阈值（激进降价）">
          <el-slider v-model="form.inventory_high_threshold" :min="0" :max="1" :step="0.05"
            :format-tooltip="(v) => Math.round(v * 100) + '%'" show-input />
          <span style="margin-left: 12px; color: #909399;">剩余高于此值 → 激进降价抢客</span>
        </el-form-item>
        <el-form-item label="库存低阈值（涨价保利）">
          <el-slider v-model="form.inventory_low_threshold" :min="0" :max="1" :step="0.05"
            :format-tooltip="(v) => Math.round(v * 100) + '%'" show-input />
          <span style="margin-left: 12px; color: #909399;">剩余低于此值 → 涨价保利润</span>
        </el-form-item>

        <el-divider content-position="left">调价幅度</el-divider>
        <el-form-item label="激进降价幅度(元)">
          <el-input-number v-model="form.aggressive_discount" :min="0" :precision="0" />
          <span style="margin-left: 12px; color: #909399;">抢客时比竞对最低价低多少</span>
        </el-form-item>
        <el-form-item label="平衡模式最低利润(元)">
          <el-input-number v-model="form.balance_margin" :min="0" :precision="0" />
          <span style="margin-left: 12px; color: #909399;">库存适中时每间房最少赚多少</span>
        </el-form-item>
        <el-form-item label="涨价幅度(%)">
          <el-input-number v-model="form.price_increase_pct" :min="0" :max="1" :step="0.05" :precision="2" />
          <span style="margin-left: 12px; color: #909399;">库存紧张时高于竞对均价的百分比</span>
        </el-form-item>

        <el-divider content-position="left">模式设置</el-divider>
        <el-form-item label="当前模式">
          <el-radio-group v-model="form.mode">
            <el-radio value="off_season">淡季模式</el-radio>
            <el-radio value="peak_season">旺季模式</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="旺季目标利润率">
          <el-input-number v-model="form.profit_margin" :min="0" :max="1" :step="0.05" :precision="2" />
          <span style="margin-left: 12px; color: #909399;">仅旺季模式生效</span>
        </el-form-item>
        <el-form-item label="每日调价时间">
          <el-time-picker v-model="form.daily_update_time" format="HH:mm" value-format="HH:mm"
            placeholder="选择时间" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSave" :loading="saving">保存设置</el-button>
          <el-button @click="fetchRules">恢复</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getPricingRules, updatePricingRules } from '../api'

const loading = ref(false)
const saving = ref(false)
const form = reactive({
  inventory_high_threshold: 0.40,
  inventory_low_threshold: 0.20,
  aggressive_discount: 5,
  balance_margin: 30,
  price_increase_pct: 0.10,
  daily_update_time: '09:00',
  mode: 'off_season',
  profit_margin: 0.30,
})

async function fetchRules() {
  loading.value = true
  try {
    const { data } = await getPricingRules()
    Object.assign(form, {
      inventory_high_threshold: data.inventory_high_threshold,
      inventory_low_threshold: data.inventory_low_threshold,
      aggressive_discount: data.aggressive_discount,
      balance_margin: data.balance_margin,
      price_increase_pct: data.price_increase_pct,
      daily_update_time: data.daily_update_time,
      mode: data.mode,
      profit_margin: data.profit_margin,
    })
  } catch (e) {
    ElMessage.error('加载规则失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await updatePricingRules(form)
    ElMessage.success('规则已保存')
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(fetchRules)
</script>
```

- [ ] **Step 2: Commit**

```bash
git add ota-pricing-tool/frontend/src/views/PricingRules.vue
git commit -m "feat: add pricing rules configuration page"
```

---

### Task 17: Dashboard Page

**Files:**
- Create: `ota-pricing-tool/frontend/src/views/Dashboard.vue`

- [ ] **Step 1: Write Dashboard.vue**

```vue
<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0;">📊 调价仪表盘</h2>
      <el-button type="primary" @click="handleRefresh" :loading="calculating">
        <el-icon style="margin-right: 4px;"><Refresh /></el-icon>刷新数据 & 计算调价
      </el-button>
    </div>

    <!-- Stats Cards -->
    <el-row :gutter="16" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="font-size: 12px; color: #909399;">今日剩余房间</div>
          <div style="font-size: 28px; font-weight: 700; color: #e74c3c;">
            {{ totalAvailable }}<span style="font-size: 14px; font-weight: 400;"> / {{ totalRooms }}</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="font-size: 12px; color: #909399;">当前均价</div>
          <div style="font-size: 28px; font-weight: 700; color: #2ecc71;">
            ¥{{ avgPrice }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="font-size: 12px; color: #909399;">竞对最低价</div>
          <div style="font-size: 28px; font-weight: 700; color: #f39c12;">
            ¥{{ competitorMinPrice }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="font-size: 12px; color: #909399;">入住率</div>
          <div style="font-size: 28px; font-weight: 700; color: #3498db;">
            {{ occupancyRate }}%
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Suggestions Table -->
    <el-card style="margin-bottom: 20px;" v-if="suggestions.length > 0">
      <template #header>
        <span>💡 今日调价建议</span>
        <el-tag style="margin-left: 8px;" :type="currentMode === 'off_season' ? 'info' : 'warning'" size="small">
          {{ currentMode === 'off_season' ? '淡季模式' : '旺季模式' }}
        </el-tag>
      </template>
      <el-table :data="suggestions" border stripe>
        <el-table-column prop="room_name" label="房型" width="140" />
        <el-table-column label="当前价" width="100">
          <template #default="{ row }">
            ¥{{ row.current_price }}
          </template>
        </el-table-column>
        <el-table-column label="建议价" width="120">
          <template #default="{ row }">
            <span :style="{ color: row.change_amount < 0 ? '#e74c3c' : '#2ecc71', fontWeight: 700, fontSize: '16px' }">
              ¥{{ row.suggested_price }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="变动" width="100">
          <template #default="{ row }">
            <el-tag :type="row.change_amount < 0 ? 'danger' : 'success'" size="small">
              {{ row.change_amount >= 0 ? '+' : '' }}{{ row.change_amount }}元
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="调价理由" min-width="280" show-overflow-tooltip />
        <el-table-column label="利润/间" width="90">
          <template #default="{ row }">¥{{ row.profit_per_room }}</template>
        </el-table-column>
        <el-table-column label="剩余" width="90">
          <template #default="{ row }">{{ row.available_rooms }}/{{ row.total_rooms }}</template>
        </el-table-column>
        <el-table-column label="竞对最低/均价" width="130">
          <template #default="{ row }">
            ¥{{ row.competitor_min_price }} / ¥{{ row.competitor_avg_price }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Empty State -->
    <el-empty v-if="!calculating && suggestions.length === 0" description="点击"刷新数据 & 计算调价"生成调价建议" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getRooms, getPricingRules, runCalculation } from '../api'

const rooms = ref([])
const suggestions = ref([])
const calculating = ref(false)
const currentMode = ref('off_season')

const totalAvailable = computed(() => rooms.value.reduce((s, r) => s + r.available_rooms, 0))
const totalRooms = computed(() => rooms.value.reduce((s, r) => s + r.total_rooms, 0))
const avgPrice = computed(() => {
  const active = rooms.value.filter((r) => r.is_active && r.current_price > 0)
  if (!active.length) return 0
  return Math.round(active.reduce((s, r) => s + r.current_price, 0) / active.length)
})
const competitorMinPrice = ref(0)
const occupancyRate = computed(() => {
  if (!totalRooms.value) return 0
  return Math.round(((totalRooms.value - totalAvailable.value) / totalRooms.value) * 100)
})

async function loadData() {
  try {
    const [roomsRes, rulesRes] = await Promise.all([
      getRooms(),
      getPricingRules(),
    ])
    rooms.value = roomsRes.data
    currentMode.value = rulesRes.data.mode
  } catch (e) {
    ElMessage.error('加载数据失败: ' + e.message)
  }
}

async function handleRefresh() {
  calculating.value = true
  try {
    const { data } = await runCalculation()
    suggestions.value = data.suggestions
    currentMode.value = data.mode

    // Update competitor min price stat
    let minAll = 0
    data.suggestions.forEach((s) => {
      if (s.competitor_min_price > 0 && (minAll === 0 || s.competitor_min_price < minAll)) {
        minAll = s.competitor_min_price
      }
    })
    competitorMinPrice.value = minAll

    // Reload rooms to get updated current prices
    await loadData()

    ElMessage.success(`已生成 ${data.suggestions.length} 条调价建议`)
  } catch (e) {
    ElMessage.error('计算失败: ' + e.message)
  } finally {
    calculating.value = false
  }
}

onMounted(async () => {
  await loadData()
  // Auto-run calculation on first load if rooms exist
  if (rooms.value.length > 0) {
    await handleRefresh()
  }
})
</script>
```

- [ ] **Step 2: Commit**

```bash
git add ota-pricing-tool/frontend/src/views/Dashboard.vue
git commit -m "feat: add pricing dashboard with stats cards and suggestions table"
```

---

### Task 18: PriceHistory Page

**Files:**
- Create: `ota-pricing-tool/frontend/src/views/PriceHistory.vue`

- [ ] **Step 1: Write PriceHistory.vue**

```vue
<template>
  <div>
    <h2>📜 调价记录</h2>
    <el-card>
      <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center;">
        <el-select v-model="filterRoomId" placeholder="按房型筛选" clearable style="width: 200px;" @change="fetchHistory">
          <el-option v-for="r in rooms" :key="r.id" :label="r.name" :value="r.id" />
        </el-select>
        <span style="color: #909399; font-size: 13px;">共 {{ history.length }} 条记录</span>
      </div>

      <el-table :data="history" border stripe v-loading="loading">
        <el-table-column label="房型" width="150">
          <template #default="{ row }">
            {{ roomMap[row.room_type_id] || '未知' }}
          </template>
        </el-table-column>
        <el-table-column label="原价" width="100">
          <template #default="{ row }">¥{{ row.old_price }}</template>
        </el-table-column>
        <el-table-column label="新价" width="100">
          <template #default="{ row }">
            <span :style="{ fontWeight: 700, color: row.new_price > row.old_price ? '#2ecc71' : '#e74c3c' }">
              ¥{{ row.new_price }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="变动" width="80">
          <template #default="{ row }">
            <el-tag :type="row.new_price > row.old_price ? 'success' : 'danger'" size="small">
              {{ row.new_price > row.old_price ? '+' : '' }}{{ row.new_price - row.old_price }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">
            {{ new Date(row.created_at).toLocaleString('zh-CN') }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getPriceHistory, getRooms } from '../api'

const history = ref([])
const rooms = ref([])
const loading = ref(false)
const filterRoomId = ref(null)

const roomMap = computed(() => {
  const m = {}
  rooms.value.forEach((r) => { m[r.id] = r.name })
  return m
})

async function fetchHistory() {
  loading.value = true
  try {
    const params = {}
    if (filterRoomId.value) params.room_type_id = filterRoomId.value
    const { data } = await getPriceHistory(params)
    history.value = data
  } catch (e) {
    // Just show empty
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const { data } = await getRooms()
    rooms.value = data
  } catch { /* ok */ }
  fetchHistory()
})
</script>
```

- [ ] **Step 2: Commit**

```bash
git add ota-pricing-tool/frontend/src/views/PriceHistory.vue
git commit -m "feat: add price history page with filtering"
```

---

### Task 19: Windows Startup Script & Integration Test

**Files:**
- Create: `ota-pricing-tool/start.bat`
- Create: `ota-pricing-tool/start.sh`

- [ ] **Step 1: Write start.bat (Windows)**

```bat
@echo off
echo ========================================
echo   OTA智能调价助手 - 启动中...
echo ========================================
echo.
echo [!] 请确保已安装 Python 和 Node.js
echo.

echo [1/2] 启动后端服务 (端口 8888)...
start "OTA-Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 0.0.0.0 --port 8888"

timeout /t 3 /nobreak > nul

echo [2/2] 启动前端服务 (端口 5173)...
start "OTA-Frontend" cmd /k "cd /d %~dp0frontend && npx vite --host"

echo.
echo ========================================
echo   启动完成！
echo   浏览器打开: http://localhost:5173
echo   局域网访问: http://YOUR_IP:5173
echo ========================================
pause
```

- [ ] **Step 2: Write start.sh (Linux/Mac, for future)**

```bash
#!/bin/bash
echo "=== OTA智能调价助手 ==="
cd "$(dirname "$0")"
cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8888 &
sleep 2
cd ../frontend && npx vite --host &
echo "打开 http://localhost:5173"
wait
```

- [ ] **Step 3: Full integration test**

```bash
# Kill any existing processes on ports 8888 and 5173
# (skip on first run)

# Start backend
cd /d/project/ota-pricing-tool/backend && \
  rm -f ota_pricing.db && \
  python -m uvicorn main:app --host 127.0.0.1 --port 8888 &
sleep 3

# Test health
curl -s http://127.0.0.1:8888/api/health

# Seed test data
curl -s -X POST http://127.0.0.1:8888/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"标准大床房","ota_name":"舒适大床房","cost_price":180,"total_rooms":30,"current_price":328,"available_rooms":18}'

curl -s -X POST http://127.0.0.1:8888/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"豪华大床房","ota_name":"豪华大床房","cost_price":280,"total_rooms":20,"current_price":458,"available_rooms":3}'

curl -s -X POST http://127.0.0.1:8888/api/competitors \
  -H "Content-Type: application/json" \
  -d '{"name":"半山酒店","ctrip_url":"https://hotels.ctrip.com/hotel/111","notes":"同区域竞对"}'

curl -s -X POST http://127.0.0.1:8888/api/competitors \
  -H "Content-Type: application/json" \
  -d '{"name":"石头酒店","ctrip_url":"https://hotels.ctrip.com/hotel/222","notes":""}'

curl -s -X POST http://127.0.0.1:8888/api/competitor-prices \
  -H "Content-Type: application/json" \
  -d '{"competitor_id":1,"room_type":"舒适大床房","price":288,"date":"2026-06-09"}'

curl -s -X POST http://127.0.0.1:8888/api/competitor-prices \
  -H "Content-Type: application/json" \
  -d '{"competitor_id":1,"room_type":"豪华大床房","price":428,"date":"2026-06-09"}'

curl -s -X POST http://127.0.0.1:8888/api/competitor-prices \
  -H "Content-Type: application/json" \
  -d '{"competitor_id":2,"room_type":"舒适大床房","price":348,"date":"2026-06-09"}'

curl -s -X POST http://127.0.0.1:8888/api/competitor-prices \
  -H "Content-Type: application/json" \
  -d '{"competitor_id":2,"room_type":"豪华大床房","price":498,"date":"2026-06-09"}'

# Trigger calculation
curl -s -X POST http://127.0.0.1:8888/api/pricing/calculate | python -m json.tool

echo "=== Integration test passed ==="
```

Expected: Calculate returns 2 suggestions — standard room (降价) and luxury room (涨价).

- [ ] **Step 4: Commit**

```bash
git add ota-pricing-tool/start.bat ota-pricing-tool/start.sh
git commit -m "feat: add startup scripts and integration test data"
```

---

### Task 20: Final Verification (Optional)

- [ ] **Step 1: Start both services**

```bash
# Terminal 1: Backend
cd /d/project/ota-pricing-tool/backend && python -m uvicorn main:app --host 127.0.0.1 --port 8888

# Terminal 2: Frontend
cd /d/project/ota-pricing-tool/frontend && npx vite
```

- [ ] **Step 2: Manual browser verification**

Open `http://localhost:5173` and verify:
1. Dashboard loads with stats cards → click "刷新数据 & 计算调价" → suggestions appear
2. Navigate to "竞争圈管理" → add/edit/delete competitors and prices works
3. Navigate to "房型与成本" → add/edit/delete room types works
4. Navigate to "调价规则" → sliders and save work
5. Navigate to "调价记录" → records display (after recording a price change)

- [ ] **Step 3: Record test evidence**

After verifying, note any issues for follow-up.

---

## Completion Checklist

- [ ] Backend starts on port 8888 without errors
- [ ] Frontend starts on port 5173 without errors
- [ ] Room types CRUD works end-to-end
- [ ] Competitor CRUD works end-to-end
- [ ] Manual competitor price entry works
- [ ] Pricing rules save/load works
- [ ] "刷新数据 & 计算调价" generates correct suggestions
- [ ] Dashboard shows stats, suggestions, competitor comparison
- [ ] Price history records display correctly
- [ ] All pages navigate via sidebar
