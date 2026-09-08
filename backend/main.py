"""
OCEANLENS - FastAPI Ocean Data Backend
Smart India Hackathon (SIH) 2026
Serves real Copernicus physical oceanography for the Arabian Sea
"""

from fastapi import FastAPI, Query, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import os
import shutil

from copernicus_loader import copernicus_loader, DATA_DIR

app = FastAPI(
    title="OCEANLENS Copernicus Data API",
    description="Backend API serving Copernicus 3D oceanographic datasets for the Arabian Sea",
    version="1.0.0",
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "OCEANLENS API",
        "active_dataset": copernicus_loader.active_file or "Copernicus Arabian Sea Physical Model",
    }

@app.get("/metadata")
def get_metadata():
    """
    Returns ocean metadata: variables, depths, times, and geographic bounding box
    """
    return copernicus_loader.get_metadata()

@app.get("/slice")
def get_slice(
    variable: str = Query(..., description="Ocean variable: thetao, so, uo, vo"),
    depth: float = Query(..., description="Depth in meters (e.g. 0.5, 50, 100)"),
    time_index: int = Query(0, description="Time step index (0 to 6)"),
):
    """
    Returns 2D grid slice of ocean data at specified depth and time step
    """
    valid_vars = ["thetao", "so", "uo", "vo"]
    if variable not in valid_vars:
        raise HTTPException(
            status_code=400,
            detail=f"Variable '{variable}' not supported. Choose from {valid_vars}",
        )

    try:
        slice_data = copernicus_loader.get_slice(variable, depth, time_index)
        return slice_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate slice: {str(e)}")

@app.post("/upload-netcdf")
async def upload_netcdf(file: UploadFile = File(...)):
    """
    Upload a real Copernicus NetCDF (.nc) file to replace/update the active dataset
    """
    if not file.filename.endswith(".nc"):
        raise HTTPException(status_code=400, detail="Only .nc (NetCDF) files are accepted.")

    os.makedirs(DATA_DIR, exist_ok=True)
    dest_path = os.path.join(DATA_DIR, file.filename)
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Reload dataset
    copernicus_loader._load_local_nc_files()

    return {
        "status": "success",
        "message": f"Successfully loaded NetCDF file: {file.filename}",
        "metadata": copernicus_loader.get_metadata(),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
