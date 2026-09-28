# ORCA — Marine Decision Support & Coastal Safety Platform

ORCA is an intelligent coastal navigation and marine decision support system tailored for artisanal fishers, harbor masters, and maritime operators along the Indian coastline.

---

## 📁 Repository Structure

```
ORCA/
├── frontend/                # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/                 # Application source code
│   │   ├── components/      # UI components (SimpleMap, ConditionsGrid, AskOrca, etc.)
│   │   ├── data/            # INCOIS PFZ coastal datasets
│   │   ├── locales/         # Multi-language translations (EN, HI, MR)
│   │   ├── services/        # API service clients
│   │   └── types/           # TypeScript interfaces
│   ├── public/              # Static public assets
│   ├── package.json         # Frontend dependencies and scripts
│   └── vite.config.ts       # Vite bundler configuration
│
├── backend/                 # FastAPI + Python Multi-Agent Architecture
│   ├── app/
│   │   ├── agents/          # Specialized agents (Weather, Marine, Tide, PFZ)
│   │   ├── api/             # REST API routes
│   │   ├── data/            # Processed INCOIS PFZ coastal directories
│   │   ├── llm/             # Hugging Face serverless inference integration
│   │   ├── orchestration/   # Dynamic planner, state machine, and synthesizer
│   │   ├── schemas/         # Pydantic data schemas
│   │   ├── services/        # Risk assessment, translation & coastal pairing
│   │   └── tools/           # Live telemetry clients (IMD, Open-Meteo, MSL)
│   └── tests/               # Comprehensive pytest test suite (66 tests)
│
├── pfz_data/                # Raw INCOIS PFZ Excel forecast bulletins
└── package.json             # Root convenience scripts to run/build frontend
```

---

## 🚀 Quick Start

### 1. Frontend Setup
From root or `frontend/`:
```bash
# From workspace root:
npm run dev

# Or directly in frontend/:
cd frontend
npm install
npm run dev
```

To build for production:
```bash
npm run build
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

To run backend tests:
```bash
pytest
```
