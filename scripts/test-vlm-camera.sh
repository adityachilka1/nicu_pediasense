#!/bin/bash
# Quick VLM test script for NICU camera
# Usage: ./scripts/test-vlm-camera.sh

cd /Users/adityachilka/Downloads/nicu-dashboard

echo "========================================"
echo "NICU VLM Camera Test"
echo "========================================"
echo ""
echo "1. Make sure the Pi camera is pointing at a monitor display"
echo "2. Display /tmp/realistic_monitor.png on a screen for testing"
echo ""
echo "Press Enter to capture and analyze..."
read

echo "Capturing frame from Pi camera..."
source .venv/bin/activate

python << 'EOF'
import cv2
import ollama
import base64
import os
import time
from io import BytesIO
from PIL import Image

RTSP_URL = "rtsp://192.168.0.183:8554/camera"
os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp|fflags;nobuffer'

# Capture frame
cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    print("ERROR: Cannot connect to camera")
    exit(1)

for _ in range(5):
    cap.grab()
ret, frame = cap.read()
cap.release()

if not ret:
    print("ERROR: Failed to capture")
    exit(1)

cv2.imwrite('/tmp/vlm_test_frame.jpg', frame)
print(f"✓ Frame captured: {frame.shape[1]}x{frame.shape[0]}")

# Convert for VLM
rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
pil_img = Image.fromarray(rgb)
buffer = BytesIO()
pil_img.save(buffer, format='JPEG', quality=90)
img_b64 = base64.b64encode(buffer.getvalue()).decode()

# Query VLM
prompt = """This is a patient monitor. Read the vital signs.
Return JSON only: {"hr": <number>, "spo2": <number>, "rr": <number>, "temp": <number>}"""

print("✓ Sending to Moondream VLM...")
start = time.time()
response = ollama.chat(
    model='moondream',
    messages=[{'role': 'user', 'content': prompt, 'images': [img_b64]}]
)
elapsed = time.time() - start

print(f"\n{'='*50}")
print(f"Moondream Response ({elapsed:.1f}s):")
print(f"{'='*50}")
print(response['message']['content'])
print(f"{'='*50}")
print("\nCaptured frame saved to: /tmp/vlm_test_frame.jpg")
print("Open it with: open /tmp/vlm_test_frame.jpg")
EOF
