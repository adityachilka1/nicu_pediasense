#!/bin/bash
################################################################################
# Automated Pi Zero 2 W Camera Setup Script
#
# This script configures a Raspberry Pi Zero 2 W as a dedicated camera
# streaming device for NICU monitor OCR system.
#
# Usage:
#   sudo ./setup-pi-camera.sh
#
# What it does:
#   1. Updates system packages
#   2. Installs required software (ffmpeg, v4l-utils, etc.)
#   3. Enables camera interface
#   4. Configures network settings
#   5. Sets up video streaming service
#   6. Configures auto-start on boot
#   7. Sets up health monitoring
#   8. Optimizes performance
#
# Author: NICU Dashboard Team
# Version: 1.0.0
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (will be loaded from config file)
CONFIG_FILE="/boot/nicu-camera-config.txt"

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_pi_model() {
    local model=$(cat /proc/device-tree/model 2>/dev/null || echo "Unknown")
    log_info "Detected device: $model"

    if [[ ! "$model" =~ "Raspberry Pi Zero 2" ]]; then
        log_warning "This script is optimized for Pi Zero 2 W"
        log_warning "Detected: $model"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

prompt_config() {
    log_info "=== Camera Configuration ==="
    echo

    read -p "Camera ID (e.g., camera-001): " CAMERA_ID
    read -p "Patient ID (e.g., 1): " PATIENT_ID
    read -p "Bed Number (e.g., Bed-01): " BED_NUMBER
    read -p "Central Server IP (e.g., 192.168.1.100): " SERVER_IP
    read -p "RTSP Port (default: 8554): " RTSP_PORT
    RTSP_PORT=${RTSP_PORT:-8554}

    echo
    log_info "Resolution settings:"
    echo "  1) 1280x720 @ 15fps (Recommended for Pi Zero 2 W)"
    echo "  2) 1920x1080 @ 10fps (Higher quality, lower framerate)"
    echo "  3) 640x480 @ 30fps (Lower quality, testing only)"
    read -p "Choose resolution (1-3): " RES_CHOICE

    case $RES_CHOICE in
        1)
            VIDEO_WIDTH=1280
            VIDEO_HEIGHT=720
            VIDEO_FPS=15
            VIDEO_BITRATE="2M"
            ;;
        2)
            VIDEO_WIDTH=1920
            VIDEO_HEIGHT=1080
            VIDEO_FPS=10
            VIDEO_BITRATE="3M"
            ;;
        3)
            VIDEO_WIDTH=640
            VIDEO_HEIGHT=480
            VIDEO_FPS=30
            VIDEO_BITRATE="1M"
            ;;
        *)
            log_error "Invalid choice, using default (720p@15fps)"
            VIDEO_WIDTH=1280
            VIDEO_HEIGHT=720
            VIDEO_FPS=15
            VIDEO_BITRATE="2M"
            ;;
    esac

    echo
    log_info "Configuration summary:"
    echo "  Camera ID:    $CAMERA_ID"
    echo "  Patient ID:   $PATIENT_ID"
    echo "  Bed Number:   $BED_NUMBER"
    echo "  Server IP:    $SERVER_IP"
    echo "  Resolution:   ${VIDEO_WIDTH}x${VIDEO_HEIGHT} @ ${VIDEO_FPS}fps"
    echo
    read -p "Is this correct? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Setup cancelled"
        exit 1
    fi

    # Save configuration
    save_config
}

save_config() {
    log_info "Saving configuration to $CONFIG_FILE"

    cat > "$CONFIG_FILE" << EOF
# NICU Camera Configuration
# Generated: $(date)

CAMERA_ID="$CAMERA_ID"
PATIENT_ID="$PATIENT_ID"
BED_NUMBER="$BED_NUMBER"
SERVER_IP="$SERVER_IP"
RTSP_PORT="$RTSP_PORT"
VIDEO_WIDTH="$VIDEO_WIDTH"
VIDEO_HEIGHT="$VIDEO_HEIGHT"
VIDEO_FPS="$VIDEO_FPS"
VIDEO_BITRATE="$VIDEO_BITRATE"
EOF

    log_success "Configuration saved"
}

load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        log_info "Loading existing configuration"
        source "$CONFIG_FILE"
        return 0
    fi
    return 1
}

################################################################################
# System Setup Functions
################################################################################

update_system() {
    log_info "Updating system packages (this may take a few minutes)..."

    apt-get update -qq
    apt-get upgrade -y -qq

    log_success "System updated"
}

install_packages() {
    log_info "Installing required packages..."

    local packages=(
        "ffmpeg"
        "v4l-utils"
        "libraspberrypi-bin"
        "python3-pip"
        "git"
        "curl"
        "htop"
        "nano"
        "raspi-config"
    )

    apt-get install -y -qq "${packages[@]}"

    log_success "Packages installed"
}

enable_camera() {
    log_info "Enabling camera interface..."

    # Enable camera using raspi-config
    raspi-config nonint do_camera 0

    # Enable legacy camera support (required for some Pi models)
    if ! grep -q "start_x=1" /boot/config.txt; then
        echo "start_x=1" >> /boot/config.txt
    fi

    if ! grep -q "gpu_mem=128" /boot/config.txt; then
        echo "gpu_mem=128" >> /boot/config.txt
    fi

    log_success "Camera interface enabled"
}

configure_network() {
    log_info "Configuring network settings..."

    # Set hostname
    local hostname="nicu-cam-${CAMERA_ID}"
    hostnamectl set-hostname "$hostname"

    # Update /etc/hosts
    sed -i "s/raspberrypi/$hostname/g" /etc/hosts

    # Disable WiFi power management (prevent disconnections)
    if ! grep -q "wireless-power off" /etc/network/interfaces; then
        cat >> /etc/network/interfaces << EOF

# Disable WiFi power management
wireless-power off
EOF
    fi

    # Create script to disable WiFi power save on boot
    cat > /etc/systemd/system/disable-wifi-powersave.service << 'EOF'
[Unit]
Description=Disable WiFi Power Save
After=network.target

[Service]
Type=oneshot
ExecStart=/sbin/iw dev wlan0 set power_save off

[Install]
WantedBy=multi-user.target
EOF

    systemctl enable disable-wifi-powersave.service

    log_success "Network configured (hostname: $hostname)"
}

setup_streaming_service() {
    log_info "Creating video streaming service..."

    # Create streaming script
    cat > /usr/local/bin/nicu-camera-stream.sh << 'SCRIPT_EOF'
#!/bin/bash
# NICU Camera Streaming Script

# Load configuration
CONFIG_FILE="/boot/nicu-camera-config.txt"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

source "$CONFIG_FILE"

# Build RTSP URL
RTSP_URL="rtsp://${SERVER_IP}:${RTSP_PORT}/${CAMERA_ID}"

# Log start
echo "$(date): Starting camera stream"
echo "  Camera ID: $CAMERA_ID"
echo "  Patient ID: $PATIENT_ID"
echo "  Resolution: ${VIDEO_WIDTH}x${VIDEO_HEIGHT} @ ${VIDEO_FPS}fps"
echo "  RTSP URL: $RTSP_URL"

# Start streaming with libcamera-vid and ffmpeg
libcamera-vid \
    --width "$VIDEO_WIDTH" \
    --height "$VIDEO_HEIGHT" \
    --framerate "$VIDEO_FPS" \
    --inline \
    --timeout 0 \
    --nopreview \
    --codec yuv420 \
    --output - | \
ffmpeg \
    -f rawvideo \
    -pix_fmt yuv420p \
    -s "${VIDEO_WIDTH}x${VIDEO_HEIGHT}" \
    -r "$VIDEO_FPS" \
    -i - \
    -c:v libx264 \
    -preset ultrafast \
    -tune zerolatency \
    -b:v "$VIDEO_BITRATE" \
    -maxrate "$VIDEO_BITRATE" \
    -bufsize "${VIDEO_BITRATE}" \
    -g $((VIDEO_FPS * 2)) \
    -f rtsp \
    "$RTSP_URL"
SCRIPT_EOF

    chmod +x /usr/local/bin/nicu-camera-stream.sh

    # Create systemd service
    cat > /etc/systemd/system/nicu-camera.service << 'SERVICE_EOF'
[Unit]
Description=NICU Camera Streaming Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/nicu-camera-stream.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE_EOF

    systemctl daemon-reload
    systemctl enable nicu-camera.service

    log_success "Streaming service created"
}

setup_health_monitoring() {
    log_info "Setting up health monitoring..."

    # Create health check script
    cat > /usr/local/bin/nicu-camera-health.sh << 'HEALTH_EOF'
#!/bin/bash
# NICU Camera Health Check Script

CONFIG_FILE="/boot/nicu-camera-config.txt"
source "$CONFIG_FILE"

LOG_FILE="/var/log/nicu-camera-health.log"
MAX_LOG_SIZE=10485760  # 10MB

# Rotate log if too large
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE") -gt $MAX_LOG_SIZE ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
fi

log_health() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Check if streaming service is running
if ! systemctl is-active --quiet nicu-camera.service; then
    log_health "ERROR: Streaming service is not running"
    systemctl restart nicu-camera.service
    log_health "INFO: Attempted to restart streaming service"
fi

# Check network connectivity
if ! ping -c 1 -W 2 "$SERVER_IP" > /dev/null 2>&1; then
    log_health "WARNING: Cannot reach server at $SERVER_IP"
else
    log_health "OK: Network connectivity to server"
fi

# Check CPU temperature
TEMP=$(vcgencmd measure_temp | grep -o '[0-9]*\.[0-9]*')
if (( $(echo "$TEMP > 70.0" | bc -l) )); then
    log_health "WARNING: High CPU temperature: ${TEMP}°C"
fi

# Check available disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    log_health "WARNING: Low disk space: ${DISK_USAGE}% used"
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$MEM_USAGE" -gt 90 ]; then
    log_health "WARNING: High memory usage: ${MEM_USAGE}%"
fi

log_health "OK: Health check completed"
HEALTH_EOF

    chmod +x /usr/local/bin/nicu-camera-health.sh

    # Create cron job for health checks (every 5 minutes)
    cat > /etc/cron.d/nicu-camera-health << 'CRON_EOF'
# NICU Camera Health Check
*/5 * * * * root /usr/local/bin/nicu-camera-health.sh
CRON_EOF

    log_success "Health monitoring configured"
}

optimize_performance() {
    log_info "Optimizing system performance..."

    # Disable unnecessary services
    local services=(
        "bluetooth"
        "triggerhappy"
        "avahi-daemon"
    )

    for service in "${services[@]}"; do
        if systemctl list-unit-files | grep -q "^${service}.service"; then
            systemctl disable "$service" 2>/dev/null || true
            systemctl stop "$service" 2>/dev/null || true
        fi
    done

    # Optimize boot config
    cat >> /boot/config.txt << EOF

# NICU Camera Optimizations
# Disable Bluetooth
dtoverlay=disable-bt

# Disable audio (not needed)
dtparam=audio=off

# GPU memory for camera
gpu_mem=128

# Overclock slightly (safe for Pi Zero 2 W)
arm_freq=1200
EOF

    # Reduce swap usage
    if ! grep -q "vm.swappiness=10" /etc/sysctl.conf; then
        echo "vm.swappiness=10" >> /etc/sysctl.conf
    fi

    log_success "Performance optimizations applied"
}

create_status_display() {
    log_info "Creating status display script..."

    cat > /usr/local/bin/nicu-camera-status.sh << 'STATUS_EOF'
#!/bin/bash
# NICU Camera Status Display

CONFIG_FILE="/boot/nicu-camera-config.txt"
source "$CONFIG_FILE"

echo "========================================"
echo "NICU Camera Status"
echo "========================================"
echo
echo "Configuration:"
echo "  Camera ID:     $CAMERA_ID"
echo "  Patient ID:    $PATIENT_ID"
echo "  Bed Number:    $BED_NUMBER"
echo "  Server IP:     $SERVER_IP"
echo "  Resolution:    ${VIDEO_WIDTH}x${VIDEO_HEIGHT} @ ${VIDEO_FPS}fps"
echo
echo "System Status:"
echo "  Hostname:      $(hostname)"
echo "  IP Address:    $(hostname -I | awk '{print $1}')"
echo "  Uptime:        $(uptime -p)"
echo "  Temperature:   $(vcgencmd measure_temp | grep -o '[0-9]*\.[0-9]*')°C"
echo
echo "Service Status:"
if systemctl is-active --quiet nicu-camera.service; then
    echo "  Stream:        ✓ Running"
else
    echo "  Stream:        ✗ Stopped"
fi
echo
echo "Network:"
if ping -c 1 -W 2 "$SERVER_IP" > /dev/null 2>&1; then
    echo "  Server:        ✓ Reachable"
else
    echo "  Server:        ✗ Unreachable"
fi
echo
echo "Disk Usage:"
df -h / | tail -1 | awk '{print "  Used:          " $3 " / " $2 " (" $5 ")"}'
echo
echo "Memory Usage:"
free -h | grep Mem | awk '{print "  Used:          " $3 " / " $2}'
echo
echo "Recent Log Entries:"
journalctl -u nicu-camera.service -n 5 --no-pager | tail -5
echo
echo "========================================"
STATUS_EOF

    chmod +x /usr/local/bin/nicu-camera-status.sh

    log_success "Status display created (run: nicu-camera-status.sh)"
}

################################################################################
# Main Installation Flow
################################################################################

main() {
    echo "========================================"
    echo "NICU Camera Setup Script"
    echo "Version 1.0.0"
    echo "========================================"
    echo

    check_root
    check_pi_model

    # Load existing config or prompt for new one
    if ! load_config; then
        prompt_config
    else
        log_info "Using existing configuration"
        read -p "Reconfigure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            prompt_config
        fi
    fi

    echo
    log_info "Starting installation..."
    echo

    update_system
    install_packages
    enable_camera
    configure_network
    setup_streaming_service
    setup_health_monitoring
    optimize_performance
    create_status_display

    echo
    log_success "========================================"
    log_success "Installation completed successfully!"
    log_success "========================================"
    echo
    log_info "Next steps:"
    echo "  1. Reboot the Pi: sudo reboot"
    echo "  2. After reboot, check status: nicu-camera-status.sh"
    echo "  3. View logs: journalctl -u nicu-camera.service -f"
    echo "  4. View health log: tail -f /var/log/nicu-camera-health.log"
    echo
    log_warning "A reboot is required for all changes to take effect"
    read -p "Reboot now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Rebooting in 5 seconds..."
        sleep 5
        reboot
    fi
}

# Run main function
main "$@"
