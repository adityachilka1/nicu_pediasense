#!/bin/bash
################################################################################
# Camera Discovery Tool
#
# Scans local network for Pi Zero 2 W cameras and lists their status.
#
# Usage:
#   ./discover-cameras.sh [network_prefix]
#   ./discover-cameras.sh 192.168.1
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

# Get network prefix
if [ $# -eq 0 ]; then
    # Auto-detect network
    NETWORK_PREFIX=$(ip route | grep default | awk '{print $3}' | cut -d. -f1-3)
    log_info "Auto-detected network: ${NETWORK_PREFIX}.0/24"
else
    NETWORK_PREFIX=$1
fi

echo "========================================"
echo "Camera Discovery Tool"
echo "========================================"
echo
log_info "Scanning network: ${NETWORK_PREFIX}.0/24"
echo

# Check for required tools
if ! command -v nmap &> /dev/null; then
    log_warning "nmap not installed (faster scanning)"
    log_info "Install with: sudo apt install nmap"
    USE_NMAP=false
else
    USE_NMAP=true
fi

CAMERAS_FOUND=0
CAMERAS_ONLINE=0

echo "Camera Status Report:"
echo "===================="
printf "%-15s %-20s %-10s %-15s\n" "IP Address" "Hostname" "Status" "RTSP Stream"
echo "--------------------------------------------------------------------"

# Scan network
for i in {1..254}; do
    IP="${NETWORK_PREFIX}.${i}"

    # Skip common gateway IPs
    if [ "$i" -eq 1 ] || [ "$i" -eq 254 ]; then
        continue
    fi

    # Quick ping check
    if ping -c 1 -W 1 "$IP" > /dev/null 2>&1; then
        # Try to get hostname
        HOSTNAME=$(timeout 2 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=2 "pi@$IP" "hostname" 2>/dev/null || echo "Unknown")

        # Check if it's a NICU camera
        if [[ "$HOSTNAME" =~ nicu-cam ]]; then
            CAMERAS_FOUND=$((CAMERAS_FOUND + 1))

            # Check if streaming service is running
            SERVICE_STATUS=$(timeout 2 ssh -o StrictHostKeyChecking=no "pi@$IP" "systemctl is-active nicu-camera.service" 2>/dev/null)

            if [ "$SERVICE_STATUS" = "active" ]; then
                STATUS="${GREEN}✓ Online${NC}"
                CAMERAS_ONLINE=$((CAMERAS_ONLINE + 1))

                # Get camera ID from config
                CAMERA_ID=$(timeout 2 ssh -o StrictHostKeyChecking=no "pi@$IP" "grep CAMERA_ID /boot/nicu-camera-config.txt | cut -d'=' -f2 | tr -d '\"'" 2>/dev/null)

                # Build RTSP URL
                RTSP_URL="rtsp://${IP}:8554/${CAMERA_ID}"
                RTSP_STATUS="Available"
            else
                STATUS="${YELLOW}⚠ Stopped${NC}"
                RTSP_STATUS="N/A"
            fi

            printf "%-15s %-20s %-23s %-15s\n" "$IP" "$HOSTNAME" "$(echo -e $STATUS)" "$RTSP_STATUS"
        fi
    fi
done

echo

# Summary
echo "========================================"
echo "Discovery Summary"
echo "========================================"
echo "  Cameras Found:  $CAMERAS_FOUND"
echo "  Cameras Online: $CAMERAS_ONLINE"

if [ "$CAMERAS_FOUND" -eq 0 ]; then
    echo
    log_warning "No NICU cameras found on network"
    echo
    echo "Troubleshooting:"
    echo "  1. Verify cameras are powered on"
    echo "  2. Check cameras are on correct network"
    echo "  3. Verify network prefix is correct"
    echo "  4. Try manual SSH: ssh pi@<camera_ip>"
fi

if [ "$CAMERAS_ONLINE" -lt "$CAMERAS_FOUND" ]; then
    echo
    log_warning "$((CAMERAS_FOUND - CAMERAS_ONLINE)) camera(s) are offline"
    echo
    echo "To restart a camera service:"
    echo "  ssh pi@<camera_ip>"
    echo "  sudo systemctl restart nicu-camera.service"
fi

if [ "$CAMERAS_ONLINE" -gt 0 ]; then
    echo
    log_success "All cameras are operational!"
    echo
    echo "Next steps:"
    echo "  1. Test RTSP streams: ./test-rtsp-stream.sh <rtsp_url>"
    echo "  2. Update central-processor-config.yaml with camera URLs"
    echo "  3. Start central OCR processor"
fi

echo
