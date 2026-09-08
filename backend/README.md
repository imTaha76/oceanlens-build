# OCEANLENS - FastAPI Ocean Data Backend

This is the backend service for **OCEANLENS (SIH 2026)**. It serves Copernicus ocean model data slices (Potential Temperature, Salinity, and Currents) for the Arabian Sea ($10^\circ\text{–}15^\circ\text{N}, 65^\circ\text{–}70^\circ\text{E}$) across 26 depth levels.

---

## 🚀 Quick Start (Local Machine)

### 1. Set Up Python Environment
```bash
cd backend
python -m venv venv

# Linux/macOS
source venv/bin/activate

# Windows
.\venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### 2. Run the FastAPI Server
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend is now live at `http://127.0.0.1:8000`!
- API Docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`
- Ocean Metadata: `http://127.0.0.1:8000/metadata`
- Ocean Slice: `http://127.0.0.1:8000/slice?variable=thetao&depth=0.5&time_index=0`

---

## 🌊 Connecting Real Copernicus NetCDF Files (.nc)

You can connect real data in two easy ways:

### Option A: Place your NetCDF `.nc` file in `backend/data/`
Place any Copernicus `.nc` file (e.g., `arabian_sea.nc`) into the `backend/data/` folder. The loader will automatically read from it using `xarray`.

### Option B: Download via Copernicus Marine CLI
```bash
# Log in with your Copernicus Marine Service account (free from marine.copernicus.eu)
copernicusmarine login

# Run the automated download script
python download_copernicus.py
```

### Option C: Instant Physical Model (Default)
If no `.nc` file is provided, `copernicus_loader.py` immediately serves calibrated physical reanalysis profiles of the Arabian Sea (thermocline, high salinity water mass, mesoscale eddies) so you can test and visualize without waiting.
