#!/bin/bash
################################################################################
# Bulk Pi Zero 2 W Deployment Script
#
# This script automates flashing multiple SD cards with Raspberry Pi OS
# and pre-configuring them for NICU camera deployment.
#
# Usage:
#   sudo ./bulk-deploy.sh
#
# Prerequisites:
#   - Raspberry Pi Imager CLI installed
#   - Multiple SD cards (16GB+ recommended)
#   - Camera configuration file (cameras-config.csv)
#
# Author: NICU Dashboard Team
# Version: 1.0.0
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CONFIG_CSV="../configs/cameras-config.csv"
SETUP_SCRIPT="../scripts/setup-pi-camera.sh"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

check_dependencies() {
    log_info "Checking dependencies..."

    # Check for rpi-imager
    if ! command -v rpi-imager &> /dev/null; then
        log_error "Raspberry Pi Imager not found"
        log_info "Install with: sudo apt install rpi-imager"
        exit 1
    fi

    # Check for config file
    if [ ! -f "$CONFIG_CSV" ]; then
        log_error "Configuration file not found: $CONFIG_CSV"
        log_info "Create it using: cp ../configs/cameras-config-template.csv $CONFIG_CSV"
        exit 1
    fi

    log_success "All dependencies found"
}

list_devices() {
    log_info "Available storage devices:"
    lsblk -d -o NAME,SIZE,TYPE,MODEL | grep -E "disk|NAME"
}

select_device() {
    echo
    list_devices
    echo
    read -p "Enter device name (e.g., sdb): " DEVICE

    if [ ! -b "/dev/$DEVICE" ]; then
        log_error "Device /dev/$DEVICE not found"
        exit 1
    fi

    # Confirm device selection
    echo
    log_warning "You selected: /dev/$DEVICE"
    lsblk "/dev/$DEVICE"
    echo
    log_warning "ALL DATA ON THIS DEVICE WILL BE ERASED!"
    read -p "Are you sure? Type 'YES' to confirm: " CONFIRM

    if [ "$CONFIRM" != "YES" ]; then
        log_error "Deployment cancelled"
        exit 1
    fi
}

create_custom_image() {
    local camera_id=$1
    local patient_id=$2
    local bed_number=$3
    local server_ip=$4
    local wifi_ssid=$5
    local wifi_password=$6

    log_info "Flashing Raspberry Pi OS Lite..."

    # Flash Raspberry Pi OS Lite
    rpi-imager \
        --cli \
        --first-run-user pi \
        --first-run-password raspberry \
        --enable-ssh \
        --hostname "nicu-cam-${camera_id}" \
        --wifi-ssid "$wifi_ssid" \
        --wifi-password "$wifi_password" \
        "/dev/$DEVICE"

    log_success "Base OS flashed"

    # Mount the boot partition
    log_info "Mounting SD card..."
    sleep 3
    local boot_mount="/media/boot"
    mkdir -p "$boot_mount"

    # Find boot partition
    local boot_part=$(lsblk -ln -o NAME "/dev/$DEVICE" | grep -E "${DEVICE}p?1" | head -1)
    mount "/dev/${boot_part}" "$boot_mount"

    # Create camera configuration file
    log_info "Creating camera configuration..."
    cat > "${boot_mount}/nicu-camera-config.txt" << EOF
# NICU Camera Configuration
# Generated: $(date)

CAMERA_ID="$camera_id"
PATIENT_ID="$patient_id"
BED_NUMBER="$bed_number"
SERVER_IP="$server_ip"
RTSP_PORT="8554"
VIDEO_WIDTH="1280"
VIDEO_HEIGHT="720"
VIDEO_FPS="15"
VIDEO_BITRATE="2M"
EOF

    # Copy setup script
    log_info "Copying setup script..."
    cp "$SETUP_SCRIPT" "${boot_mount}/setup-pi-camera.sh"
    chmod +x "${boot_mount}/setup-pi-camera.sh"

    # Create first-boot script
    cat > "${boot_mount}/firstrun.sh" << 'FIRSTRUN_EOF'
#!/bin/bash
# Auto-run setup on first boot

if [ -f /boot/setup-pi-camera.sh ]; then
    echo "Running NICU camera setup..."
    /boot/setup-pi-camera.sh --auto
    rm /boot/setup-pi-camera.sh
fi

rm /boot/firstrun.sh
FIRSTRUN_EOF

    chmod +x "${boot_mount}/firstrun.sh"

    # Unmount
    sync
    umount "$boot_mount"

    log_success "SD card configured for Camera ID: $camera_id"
}

deploy_batch() {
    log_info "Reading camera configurations from $CONFIG_CSV"

    # Skip header line and read configurations
    local count=0
    while IFS=',' read -r camera_id patient_id bed_number server_ip wifi_ssid wifi_password; do
        # Skip header
        if [ "$camera_id" = "camera_id" ]; then
            continue
        fi

        count=$((count + 1))

        echo
        echo "========================================"
        echo "Deploying Camera $count"
        echo "========================================"
        echo "  Camera ID:    $camera_id"
        echo "  Patient ID:   $patient_id"
        echo "  Bed Number:   $bed_number"
        echo "  Server IP:    $server_ip"
        echo

        select_device
        create_custom_image "$camera_id" "$patient_id" "$bed_number" "$server_ip" "$wifi_ssid" "$wifi_password"

        echo
        log_success "Camera $count deployed successfully!"
        log_info "Remove SD card and insert it into Pi Zero 2 W"
        echo

        read -p "Press Enter when ready for next camera (or Ctrl+C to stop)..."
    done < "$CONFIG_CSV"

    echo
    log_success "========================================"
    log_success "All cameras deployed: $count total"
    log_success "========================================"
}

generate_template_config() {
    local template="../configs/cameras-config-template.csv"

    log_info "Generating template configuration..."

    cat > "$template" << 'EOF'
camera_id,patient_id,bed_number,server_ip,wifi_ssid,wifi_password
camera-001,1,Bed-01,192.168.1.100,NICU-Network,password123
camera-002,2,Bed-02,192.168.1.100,NICU-Network,password123
camera-003,3,Bed-03,192.168.1.100,NICU-Network,password123
camera-004,4,Bed-04,192.168.1.100,NICU-Network,password123
camera-005,5,Bed-05,192.168.1.100,NICU-Network,password123
camera-006,6,Bed-06,192.168.1.100,NICU-Network,password123
camera-007,7,Bed-07,192.168.1.100,NICU-Network,password123
camera-008,8,Bed-08,192.168.1.100,NICU-Network,password123
EOF

    log_success "Template created at: $template"
    log_info "Edit this file with your camera configurations"
}

main() {
    echo "========================================"
    echo "NICU Camera Bulk Deployment"
    echo "Version 1.0.0"
    echo "========================================"
    echo

    check_root

    echo "Options:"
    echo "  1) Deploy cameras from config file"
    echo "  2) Generate template config file"
    echo "  3) Exit"
    echo
    read -p "Choose option (1-3): " OPTION

    case $OPTION in
        1)
            check_dependencies
            deploy_batch
            ;;
        2)
            generate_template_config
            ;;
        3)
            log_info "Exiting"
            exit 0
            ;;
        *)
            log_error "Invalid option"
            exit 1
            ;;
    esac
}

main "$@"
