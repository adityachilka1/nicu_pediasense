#!/usr/bin/env python3
"""
NICU Camera to Dashboard Connector
Connects Pi Zero 2W RTSP stream to NICU Dashboard vitals ingestion API.

For demo purposes, uses mock OCR (generates realistic vitals).
Replace with real OCR when ML models are ready.
"""

import cv2
import requests
import time
import random
import json
from datetime import datetime

# Configuration
RTSP_URL = "rtsp://192.168.0.183:8554/camera"
API_URL = "http://localhost:3001/api/vitals/ingest"
CAMERA_ID = "camera-001"
PATIENT_ID = 1  # Assign to first patient
INTERVAL_SECONDS = 5  # Send vitals every 5 seconds

# Baseline vitals for simulation (neonatal ranges)
BASELINE = {
    "hr": 140,      # Heart rate: 120-160 bpm
    "spo2": 96,     # SpO2: 94-99%
    "rr": 45,       # Respiratory rate: 40-60
    "temp": 36.8    # Temperature: 36.5-37.5°C
}

def generate_mock_vitals():
    """Generate realistic mock vitals with small variations."""
    return {
        "hr": BASELINE["hr"] + random.randint(-10, 10),
        "spo2": min(100, max(88, BASELINE["spo2"] + random.randint(-3, 2))),
        "rr": BASELINE["rr"] + random.randint(-5, 5),
        "temp": round(BASELINE["temp"] + random.uniform(-0.3, 0.3), 1)
    }

def send_vitals(vitals, confidence=0.92):
    """Send vitals to NICU Dashboard API."""
    payload = {
        "patientId": PATIENT_ID,
        "cameraId": CAMERA_ID,
        "vitals": vitals,
        "confidence": confidence,
        "inferenceTimeMs": random.randint(100, 200),
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    try:
        response = requests.post(API_URL, json=payload, timeout=5)
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def main():
    print("=" * 60)
    print("NICU Camera to Dashboard Connector")
    print("=" * 60)
    print(f"RTSP Stream: {RTSP_URL}")
    print(f"Dashboard API: {API_URL}")
    print(f"Camera ID: {CAMERA_ID}")
    print(f"Patient ID: {PATIENT_ID}")
    print(f"Update Interval: {INTERVAL_SECONDS}s")
    print("=" * 60)
    print()

    # Try to connect to camera stream
    print("Connecting to camera stream...")
    cap = cv2.VideoCapture(RTSP_URL)

    if not cap.isOpened():
        print("WARNING: Could not connect to RTSP stream")
        print("Running in simulation mode (no video)")
        stream_connected = False
    else:
        print("Connected to camera stream!")
        stream_connected = True
        # Get stream info
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"Stream: {width}x{height} @ {fps:.1f}fps")

    print()
    print("Starting vitals transmission... (Ctrl+C to stop)")
    print("-" * 60)

    frame_count = 0
    vitals_sent = 0

    try:
        while True:
            # Read frame if stream connected
            if stream_connected:
                ret, frame = cap.read()
                if ret:
                    frame_count += 1
                    # Here you would run OCR on the frame
                    # For now, we use mock vitals

            # Generate mock vitals (replace with real OCR)
            vitals = generate_mock_vitals()
            confidence = 0.85 + random.uniform(0, 0.12)

            # Send to dashboard
            result = send_vitals(vitals, confidence)
            vitals_sent += 1

            # Display status
            timestamp = datetime.now().strftime("%H:%M:%S")
            if result.get("success"):
                print(f"[{timestamp}] Sent: HR={vitals['hr']} SpO2={vitals['spo2']}% "
                      f"RR={vitals['rr']} Temp={vitals['temp']}°C "
                      f"(conf={confidence:.2f}) -> vitalId={result.get('vitalId')}")
            else:
                print(f"[{timestamp}] Error: {result.get('error', 'Unknown error')}")

            # Wait for next interval
            time.sleep(INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print()
        print("-" * 60)
        print(f"Stopped. Sent {vitals_sent} vital readings.")
    finally:
        if stream_connected:
            cap.release()

if __name__ == "__main__":
    main()
