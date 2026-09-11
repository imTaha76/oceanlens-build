"""
OCEANLENS - Copernicus Marine Data Downloader
Downloads real NetCDF ocean physical reanalysis for the Arabian Sea
Requires free Copernicus Marine account (https://marine.copernicus.eu/)
"""

import os
import sys

def download_data():
    try:
        import copernicusmarine
    except ImportError:
        print("[ERROR] copernicusmarine library not installed.")
        print("Run: pip install copernicusmarine")
        sys.exit(1)

    output_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(output_dir, exist_ok=True)
    output_filename = "arabian_sea_copernicus.nc"

    print("=" * 60)
    print("OCEANLENS - Downloading Copernicus Marine Arabian Sea Data")
    print("Bounding Box: Lat 10.0°N to 15.0°N | Lon 65.0°E to 70.0°E")
    print("Variables: thetao (Temp), so (Salinity), uo/vo (Currents)")
    print("=" * 60)

    try:
        copernicusmarine.subset(
            dataset_id="cmems_mod_glo_phy_anfc_0.083deg_P1D-m",
            variables=["thetao", "so", "uo", "vo"],
            minimum_longitude=65.0,
            maximum_longitude=70.0,
            minimum_latitude=10.0,
            maximum_latitude=15.0,
            start_datetime="2026-03-01",
            end_datetime="2026-03-07",
            minimum_depth=0.5,
            maximum_depth=1000.0,
            output_directory=output_dir,
            output_filename=output_filename,
            force_download=True,
        )
        print(f"\n[SUCCESS] Downloaded dataset to: {os.path.join(output_dir, output_filename)}")
        print("Now restart or run your FastAPI backend: uvicorn main:app --reload --port 8000")
    except Exception as e:
        print(f"\n[ERROR] Download failed: {e}")
        print("Tip: Run 'copernicusmarine login' first with your free credentials.")

if __name__ == "__main__":
    download_data()
