#!/bin/bash
################################################################################
# RTSP Stream Testing Tool
#
# Tests RTSP streaming from Pi Zero 2 W cameras to verify connectivity
# and stream quality.
#
# Usage:
#   ./test-rtsp-stream.sh <rtsp_url>
#   ./test-rtsp-stream.sh rtsp://192.168.1.10:8554/camera-001
#
# Author: NICU Dashboard Team
################################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check arguments
if [ $# -eq 0 ]; then
    log_error "No RTSP URL provided"
    echo "Usage: $0 <rtsp_url>"
    echo "Example: $0 rtsp://192.168.1.10:8554/camera-001"
    exit 1
fi

RTSP_URL=$1

echo "========================================"
echo "RTSP Stream Testing Tool"
echo "========================================"
echo

log_info "Testing RTSP URL: $RTSP_URL"
echo

# Check if ffprobe is installed
if ! command -v ffprobe &> /dev/null; then
    log_error "ffprobe not found"
    log_info "Install with: sudo apt install ffmpeg"
    exit 1
fi

# Extract IP and port from URL
if [[ $RTSP_URL =~ rtsp://([^:]+):([0-9]+)/ ]]; then
    CAMERA_IP="${BASH_REMATCH[1]}"
    RTSP_PORT="${BASH_REMATCH[2]}"
else
    log_error "Invalid RTSP URL format"
    exit 1
fi

# Test 1: Network connectivity
log_info "Test 1: Network Connectivity"
if ping -c 2 -W 2 "$CAMERA_IP" > /dev/null 2>&1; then
    log_success "Camera is reachable at $CAMERA_IP"
else
    log_error "Cannot reach camera at $CAMERA_IP"
    echo
    log_info "Troubleshooting steps:"
    echo "  1. Check camera is powered on"
    echo "  2. Verify camera is on same network"
    echo "  3. Check WiFi connection on camera"
    echo "  4. Verify IP address is correct"
    exit 1
fi
echo

# Test 2: RTSP port connectivity
log_info "Test 2: RTSP Port Connectivity"
if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$CAMERA_IP/$RTSP_PORT" 2>/dev/null; then
    log_success "RTSP port $RTSP_PORT is open"
else
    log_error "Cannot connect to RTSP port $RTSP_PORT"
    echo
    log_info "Troubleshooting steps:"
    echo "  1. Check camera streaming service is running"
    echo "     SSH to camera and run: systemctl status nicu-camera.service"
    echo "  2. Verify RTSP port is not blocked by firewall"
    echo "  3. Check RTSP server is listening on correct port"
    exit 1
fi
echo

# Test 3: Stream information
log_info "Test 3: Stream Information"
log_info "Fetching stream metadata..."

STREAM_INFO=$(ffprobe -v quiet -print_format json -show_streams -show_format "$RTSP_URL" 2>&1)

if [ $? -eq 0 ]; then
    log_success "Stream is accessible"
    echo

    # Parse stream info
    CODEC=$(echo "$STREAM_INFO" | grep -oP '"codec_name": "\K[^"]+' | head -1)
    WIDTH=$(echo "$STREAM_INFO" | grep -oP '"width": \K[0-9]+' | head -1)
    HEIGHT=$(echo "$STREAM_INFO" | grep -oP '"height": \K[0-9]+' | head -1)
    FPS=$(echo "$STREAM_INFO" | grep -oP '"r_frame_rate": "\K[^/]+' | head -1)
    BITRATE=$(echo "$STREAM_INFO" | grep -oP '"bit_rate": "\K[^"]+' | head -1)

    echo "Stream Details:"
    echo "  Codec:       ${CODEC:-Unknown}"
    echo "  Resolution:  ${WIDTH}x${HEIGHT}"
    echo "  Frame Rate:  ${FPS} fps"
    echo "  Bitrate:     ${BITRATE} bps"
else
    log_error "Cannot access stream"
    echo
    log_info "Troubleshooting steps:"
    echo "  1. Verify camera is streaming (check camera logs)"
    echo "  2. Check RTSP URL path is correct"
    echo "  3. Try accessing stream with VLC: vlc $RTSP_URL"
    exit 1
fi
echo

# Test 4: Frame capture
log_info "Test 4: Frame Capture"
log_info "Capturing 10 frames..."

TEMP_DIR=$(mktemp -d)
ffmpeg -rtsp_transport tcp -i "$RTSP_URL" -frames:v 10 -q:v 2 "$TEMP_DIR/frame_%03d.jpg" -y > /dev/null 2>&1

if [ $? -eq 0 ]; then
    FRAME_COUNT=$(ls -1 "$TEMP_DIR"/*.jpg 2>/dev/null | wc -l)
    if [ "$FRAME_COUNT" -gt 0 ]; then
        log_success "Captured $FRAME_COUNT frames"

        # Calculate average file size
        AVG_SIZE=$(du -b "$TEMP_DIR"/*.jpg | awk '{sum+=$1} END {printf "%.0f", sum/NR}')
        log_info "Average frame size: $((AVG_SIZE / 1024)) KB"

        # Check if frames are too small (possible black frames)
        if [ "$AVG_SIZE" -lt 10000 ]; then
            log_warning "Frames are very small - camera may be showing black screen"
        fi
    else
        log_error "No frames captured"
    fi
else
    log_error "Frame capture failed"
fi

# Cleanup
rm -rf "$TEMP_DIR"
echo

# Test 5: Latency test
log_info "Test 5: Latency Test"
log_info "Measuring stream latency..."

START_TIME=$(date +%s%N)
ffmpeg -rtsp_transport tcp -i "$RTSP_URL" -frames:v 1 -f null - > /dev/null 2>&1
END_TIME=$(date +%s%N)

LATENCY_MS=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $? -eq 0 ]; then
    log_success "Stream latency: ${LATENCY_MS}ms"

    if [ "$LATENCY_MS" -lt 500 ]; then
        log_success "Latency is excellent (<500ms)"
    elif [ "$LATENCY_MS" -lt 1000 ]; then
        log_info "Latency is acceptable (<1s)"
    else
        log_warning "Latency is high (>1s) - may impact OCR performance"
    fi
else
    log_error "Latency test failed"
fi
echo

# Summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo
echo "Overall Status:"
if [ -n "$CODEC" ] && [ -n "$WIDTH" ] && [ "$FRAME_COUNT" -gt 0 ]; then
    log_success "Stream is working correctly!"
    echo
    echo "Next steps:"
    echo "  1. Add this camera to central-processor-config.yaml"
    echo "  2. Test OCR processing with this stream"
    echo "  3. Monitor performance and adjust settings if needed"
else
    log_error "Stream has issues that need to be resolved"
    echo
    echo "Review the errors above and follow troubleshooting steps"
fi
echo
