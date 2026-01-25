#!/usr/bin/env python3
"""
NICU VLM-Based Vitals Extractor
Uses Moondream vision-language model to read vital signs from patient monitor images.

Architecture:
  Pi Zero 2W (RTSP) → Mac (Moondream VLM) → Dashboard API
"""

import cv2
import ollama
import requests
import time
import base64
import json
import re
import os
from datetime import datetime, timezone
from io import BytesIO
from PIL import Image

# ============================================================================
# CONFIGURATION
# ============================================================================

RTSP_URL = "rtsp://192.168.0.183:8554/camera"
API_URL = "http://localhost:3001/api/vitals/ingest"
CAMERA_ID = "camera-vlm-001"
PATIENT_ID = 1
SAMPLE_INTERVAL = 10  # Seconds between VLM queries (VLM is slower than traditional OCR)

# Moondream model
MODEL_NAME = "moondream"

# VLM Prompt for vital signs extraction
VLM_PROMPT = """Look at this image of a patient monitor display.
Extract any visible vital signs numbers you can see.

Return ONLY a JSON object with these fields (use null if not visible):
{
  "hr": <heart rate number>,
  "spo2": <oxygen saturation percentage>,
  "rr": <respiratory rate number>,
  "temp": <temperature number>,
  "bp_sys": <systolic blood pressure>,
  "bp_dia": <diastolic blood pressure>
}

Only return the JSON, no other text."""

# Neonatal vital ranges for validation
VALID_RANGES = {
    'hr': (60, 220),
    'spo2': (70, 100),
    'rr': (15, 100),
    'temp': (34.0, 40.0),
    'bp_sys': (40, 120),
    'bp_dia': (20, 80)
}

# ============================================================================
# VLM PROCESSING
# ============================================================================

def frame_to_base64(frame):
    """Convert OpenCV frame to base64 for Ollama."""
    # Convert BGR to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Convert to PIL Image
    pil_image = Image.fromarray(rgb_frame)

    # Save to bytes
    buffer = BytesIO()
    pil_image.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)

    # Encode to base64
    return base64.b64encode(buffer.read()).decode('utf-8')


def extract_vitals_vlm(frame):
    """Use Moondream VLM to extract vital signs from frame."""
    try:
        start_time = time.time()

        # Convert frame to base64
        img_base64 = frame_to_base64(frame)

        # Query Moondream
        response = ollama.chat(
            model=MODEL_NAME,
            messages=[{
                'role': 'user',
                'content': VLM_PROMPT,
                'images': [img_base64]
            }]
        )

        inference_time = (time.time() - start_time) * 1000

        # Extract response text
        response_text = response['message']['content']

        # Parse JSON from response
        vitals = parse_vitals_response(response_text)

        # Calculate confidence based on how many vitals were extracted
        valid_count = sum(1 for v in vitals.values() if v is not None)
        confidence = min(0.95, 0.5 + (valid_count * 0.1))

        return vitals, confidence, inference_time, response_text

    except Exception as e:
        return {}, 0.0, 0, f"VLM Error: {str(e)}"


def parse_vitals_response(response_text):
    """Parse VLM response to extract vital values."""
    vitals = {
        'hr': None,
        'spo2': None,
        'rr': None,
        'temp': None,
        'bp_sys': None,
        'bp_dia': None
    }

    try:
        # Try to find JSON in response
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())

            for key in vitals.keys():
                if key in data and data[key] is not None:
                    try:
                        value = float(data[key])
                        # Validate range
                        if key in VALID_RANGES:
                            min_val, max_val = VALID_RANGES[key]
                            if min_val <= value <= max_val:
                                vitals[key] = value
                    except (ValueError, TypeError):
                        pass
    except json.JSONDecodeError:
        # Try regex extraction as fallback
        patterns = {
            'hr': r'(?:hr|heart\s*rate)[:\s]*(\d{2,3})',
            'spo2': r'(?:spo2|oxygen|sat)[:\s]*(\d{2,3})',
            'rr': r'(?:rr|resp)[:\s]*(\d{1,3})',
            'temp': r'(?:temp)[:\s]*(\d{2}\.?\d?)',
        }

        for key, pattern in patterns.items():
            match = re.search(pattern, response_text, re.IGNORECASE)
            if match:
                try:
                    value = float(match.group(1))
                    min_val, max_val = VALID_RANGES[key]
                    if min_val <= value <= max_val:
                        vitals[key] = value
                except ValueError:
                    pass

    return vitals


# ============================================================================
# API CLIENT
# ============================================================================

def send_vitals(vitals, confidence, inference_time, vlm_response=""):
    """Send vitals to NICU Dashboard API."""
    payload = {
        "patientId": PATIENT_ID,
        "cameraId": CAMERA_ID,
        "vitals": {
            "hr": int(vitals['hr']) if vitals.get('hr') else None,
            "spo2": int(vitals['spo2']) if vitals.get('spo2') else None,
            "rr": int(vitals['rr']) if vitals.get('rr') else None,
            "temp": round(vitals['temp'], 1) if vitals.get('temp') else None
        },
        "confidence": confidence,
        "inferenceTimeMs": int(inference_time),
        "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "metadata": {
            "source": "moondream-vlm",
            "vlm_response": vlm_response[:500] if vlm_response else "",
            "bp_sys": vitals.get('bp_sys'),
            "bp_dia": vitals.get('bp_dia')
        }
    }

    # Remove None values from vitals
    payload["vitals"] = {k: v for k, v in payload["vitals"].items() if v is not None}

    # Don't send if no vitals extracted
    if not payload["vitals"]:
        return {"error": "No vitals extracted"}

    try:
        response = requests.post(API_URL, json=payload, timeout=10)
        return response.json()
    except Exception as e:
        return {"error": str(e)}


# ============================================================================
# STREAM CAPTURE
# ============================================================================

class StreamCapture:
    """Capture frames from RTSP stream."""

    def __init__(self, url):
        self.url = url
        self.cap = None

        # Set FFmpeg options for low latency
        os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = (
            'rtsp_transport;tcp|fflags;nobuffer|flags;low_delay'
        )

    def connect(self):
        """Connect to RTSP stream."""
        self.cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return self.cap.isOpened()

    def get_frame(self):
        """Get latest frame."""
        if not self.cap or not self.cap.isOpened():
            return None

        # Flush buffer
        for _ in range(3):
            self.cap.grab()

        ret, frame = self.cap.read()
        return frame if ret else None

    def release(self):
        """Release stream."""
        if self.cap:
            self.cap.release()


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("NICU VLM-Based Vitals Extractor")
    print("=" * 70)
    print(f"Model:     {MODEL_NAME} (Moondream)")
    print(f"Stream:    {RTSP_URL}")
    print(f"API:       {API_URL}")
    print(f"Interval:  {SAMPLE_INTERVAL}s")
    print("=" * 70)

    # Test VLM connection
    print("\nTesting Moondream connection...")
    try:
        test_response = ollama.chat(
            model=MODEL_NAME,
            messages=[{'role': 'user', 'content': 'Say "ready" if you can see images.'}]
        )
        print(f"VLM Ready: {test_response['message']['content'][:50]}...")
    except Exception as e:
        print(f"ERROR: Cannot connect to Moondream: {e}")
        print("Make sure Ollama is running: brew services start ollama")
        return

    # Connect to stream
    print("\nConnecting to camera stream...")
    stream = StreamCapture(RTSP_URL)

    if not stream.connect():
        print("WARNING: Cannot connect to RTSP stream")
        print("Running in test mode with sample images...")
        stream_connected = False
    else:
        print("Connected to camera stream!")
        stream_connected = True

    print("\n" + "-" * 70)
    print(f"{'Time':<10} {'HR':<6} {'SpO2':<6} {'RR':<5} {'Temp':<7} {'Conf':<6} {'Infer':<8} {'Result'}")
    print("-" * 70)

    total_queries = 0
    successful_extractions = 0

    try:
        while True:
            frame = None

            if stream_connected:
                frame = stream.get_frame()

            if frame is not None:
                # Extract vitals using VLM
                vitals, confidence, inference_time, vlm_response = extract_vitals_vlm(frame)
                total_queries += 1

                # Send to API if we got vitals
                if any(v is not None for v in vitals.values()):
                    successful_extractions += 1
                    result = send_vitals(vitals, confidence, inference_time, vlm_response)
                else:
                    result = {"error": "No vitals detected in image"}

                # Display results
                ts = datetime.now().strftime("%H:%M:%S")
                hr = str(int(vitals['hr'])) if vitals.get('hr') else '-'
                spo2 = str(int(vitals['spo2'])) if vitals.get('spo2') else '-'
                rr = str(int(vitals['rr'])) if vitals.get('rr') else '-'
                temp = f"{vitals['temp']:.1f}" if vitals.get('temp') else '-'
                infer = f"{inference_time:.0f}ms"

                if result.get("success"):
                    res = f"✓ #{result.get('vitalId')}"
                elif result.get("error"):
                    res = f"✗ {str(result.get('error'))[:20]}"
                else:
                    res = "✗ Unknown"

                print(f"{ts:<10} {hr:<6} {spo2:<6} {rr:<5} {temp:<7} {confidence:.2f}  {infer:<8} {res}")

                # Show VLM response snippet
                if vlm_response and not vlm_response.startswith("VLM Error"):
                    print(f"           VLM: {vlm_response[:60]}...")

            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] No frame available")

            # Stats every 10 queries
            if total_queries > 0 and total_queries % 10 == 0:
                success_rate = successful_extractions / total_queries * 100
                print(f"--- Stats: {total_queries} queries, {success_rate:.0f}% extraction rate ---")

            time.sleep(SAMPLE_INTERVAL)

    except KeyboardInterrupt:
        print("\n" + "-" * 70)
        print(f"Stopped. {total_queries} VLM queries, {successful_extractions} successful extractions")
        if total_queries > 0:
            print(f"Success rate: {successful_extractions/total_queries*100:.1f}%")

    finally:
        stream.release()


if __name__ == "__main__":
    main()
