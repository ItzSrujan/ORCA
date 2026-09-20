# ORCA Backend — Ocean Risk & Coordinated Advisory

AI-orchestrated marine decision-support system. Coordinates weather, ocean and advisory data to produce evidence-backed risk assessments and recommendations.

## Architecture

```
User Query
    ↓
FastAPI Endpoint (/api/query)
    ↓
LangGraph Orchestration Pipeline
    ├── Request Understanding (HF LLM + deterministic fallback)
    ├── Location Resolution (Nominatim geocoding)
    ├── Task Planning (dynamic agent selection)
    ├── Parallel Agent Execution
    │   ├── Weather Agent (Open-Meteo)
    │   ├── Marine Agent (Open-Meteo Marine)
    │   ├── Tide Agent (configurable provider)
    │   └── PFZ Agent (fallback data)
    ├── Data Validation
    ├── Risk Assessment (deterministic, rule-based)
    ├── Evidence Builder
    └── Response Synthesis (HF LLM + template fallback)
    ↓
Structured JSON Response
```

## Key Design Principles

- **LLM does NOT decide risk levels** — risk is computed by a deterministic, configurable rule engine
- **LLM does NOT invent data** — it only interprets queries and explains retrieved data
- **Every data point has provenance** — `source`, `is_live`, and `timestamp` on all data
- **Graceful degradation** — if LLM fails, fallback parsers and templates take over
- **One agent failure does not crash the pipeline** — partial results are still returned

## Installation

```bash
cd backend

# Create virtual environment (if not already done)
python -m venv venv

# Activate
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Configuration

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```ini
# Required for LLM features — get a free token at https://huggingface.co/settings/tokens
LLM_PROVIDER=huggingface
HF_MODEL=HuggingFaceH4/zephyr-7b-beta
HF_TOKEN=hf_your_token_here

# Risk thresholds (configurable)
RISK_WAVE_MODERATE_THRESHOLD=1.0
RISK_WAVE_HIGH_THRESHOLD=2.5
RISK_WIND_MODERATE_THRESHOLD=20.0
RISK_WIND_HIGH_THRESHOLD=40.0
```

### Hugging Face Model Options

| Use Case | Model | Notes |
|---|---|---|
| Development / CPU | `HuggingFaceH4/zephyr-7b-beta` | Good balance of quality and speed via Inference API |
| Lightweight | `microsoft/Phi-3-mini-4k-instruct` | Small, fast |
| Stronger | `meta-llama/Meta-Llama-3-8B-Instruct` | Requires HF token + model access |
| Local (no internet) | Set `LLM_PROVIDER=local` | Downloads model to disk, requires GPU/RAM |

**The system works even without an LLM** — deterministic fallback parsers and template responses handle all core functionality.

## Running the Server

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Open Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)

## API Endpoints

### `GET /health`

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "healthy",
  "service": "ORCA Backend"
}
```

### `POST /api/query`

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Is it safe to go fishing near Digha tomorrow morning?"}'
```

With explicit coordinates:

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Marine conditions", "latitude": 21.62, "longitude": 87.50}'
```

### Response Structure

```json
{
  "query": "Is it safe to go fishing near Digha tomorrow morning?",
  "intent": {
    "primary_intent": "fishing_safety",
    "location": "Digha",
    "latitude": 21.62,
    "longitude": 87.50,
    "time": "tomorrow_morning",
    "required_agents": ["weather", "marine", "tide", "pfz"]
  },
  "execution_trace": [
    {"step": "request_understanding", "status": "completed", "message": "..."},
    {"step": "location_resolution", "status": "completed", "message": "..."},
    {"step": "weather_agent", "status": "completed", "message": "..."},
    {"step": "marine_agent", "status": "completed", "message": "..."},
    {"step": "risk_assessment", "status": "completed", "message": "Risk level: MODERATE"}
  ],
  "data": {
    "weather": {"wind_speed_kmh": 18.0, "source": "Open-Meteo", "is_live": true, "...": "..."},
    "marine": {"wave_height_m": 1.2, "source": "Open-Meteo Marine", "is_live": true, "...": "..."},
    "tide": {"available": false, "reason": "No tide data provider configured"},
    "pfz": {"available": true, "source": "prototype_fallback", "is_live": false}
  },
  "risk_assessment": {
    "level": "MODERATE",
    "factors": ["Wave height (1.2 m) exceeds configured caution threshold (1.0 m)"],
    "uncertainties": ["Live tide data unavailable"]
  },
  "recommendation": "Available data indicates conditions requiring caution...",
  "evidence": [
    {"source": "Open-Meteo", "data_type": "weather", "is_live": true},
    {"source": "Open-Meteo Marine", "data_type": "marine_conditions", "is_live": true},
    {"source": "prototype_fallback", "data_type": "pfz_advisory", "is_live": false}
  ]
}
```

## Connecting the React Frontend

The backend runs on port 8000 with CORS enabled for `localhost:5173` (Vite dev server).

Update the frontend's mock API service to call:

```
POST http://localhost:8000/api/query
```

## Running Tests

```bash
cd backend
pytest tests/ -v
```

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app entry point
│   ├── api/routes.py           # API endpoints
│   ├── core/
│   │   ├── config.py           # Settings from .env
│   │   └── logging.py          # Structured logging
│   ├── schemas/
│   │   ├── query.py            # QueryRequest, ParsedIntent
│   │   ├── marine.py           # WeatherData, MarineConditions, etc.
│   │   └── response.py         # OrcaResponse, RiskAssessment
│   ├── llm/
│   │   ├── base.py             # Abstract LLMProvider + factory
│   │   ├── huggingface_provider.py
│   │   └── local_provider.py
│   ├── orchestration/
│   │   ├── state.py            # LangGraph state TypedDict
│   │   ├── planner.py          # All graph nodes
│   │   └── graph.py            # StateGraph builder
│   ├── agents/
│   │   ├── weather_agent.py
│   │   ├── marine_agent.py
│   │   ├── tide_agent.py
│   │   └── pfz_agent.py
│   ├── tools/
│   │   ├── geocoding_tool.py   # Nominatim geocoding
│   │   ├── weather_tool.py     # Open-Meteo Weather API
│   │   ├── marine_tool.py      # Open-Meteo Marine API
│   │   ├── tide_tool.py        # Tide provider abstraction
│   │   └── pfz_tool.py         # PFZ fallback data
│   ├── services/
│   │   ├── normalization.py    # Raw → Pydantic schema conversion
│   │   ├── risk_engine.py      # Rule-based risk assessment
│   │   └── evidence_service.py # Data provenance builder
│   └── data/
│       └── fallback_pfz.json   # Prototype PFZ zones
├── tests/
│   ├── test_health.py
│   ├── test_query_validation.py
│   ├── test_intent_fallback.py
│   ├── test_risk_engine.py
│   ├── test_normalization.py
│   ├── test_agent_failure.py
│   └── test_execution_trace.py
├── .env.example
├── requirements.txt
└── README.md
```

## Known Prototype Limitations

1. **Tide data**: No live provider integrated — returns "unavailable" status
2. **PFZ data**: Uses static fallback JSON — always labelled as `prototype_fallback`
3. **Geocoding**: Uses free Nominatim API — subject to rate limits
4. **LLM dependency**: System works without LLM via deterministic fallbacks, but natural language understanding is limited without it
5. **No authentication**: API is open — add auth before production deployment
6. **Risk thresholds**: Configured defaults are for development — do not treat as official marine safety standards
