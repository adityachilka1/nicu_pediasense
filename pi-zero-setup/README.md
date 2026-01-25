# Pi Zero 2 W Camera Setup - Complete Automation Suite

**Automated deployment system for NICU monitor OCR using Raspberry Pi Zero 2 W cameras**

---

## 📁 Directory Structure

```
pi-zero-setup/
├── README.md                           # This file
├── scripts/                            # Automated setup scripts
│   ├── setup-pi-camera.sh             # Main Pi Zero 2 W setup script
│   ├── bulk-deploy.sh                 # Bulk SD card deployment
│   └── central-ocr-processor.py       # Central OCR processing service
├── configs/                            # Configuration files
│   ├── cameras-config-template.csv    # Camera deployment template
│   └── central-processor-config.yaml  # Central processor configuration
└── tools/                              # Testing & troubleshooting tools
    ├── test-rtsp-stream.sh            # RTSP stream testing
    └── discover-cameras.sh            # Network camera discovery
```

---

## 🚀 Quick Start (Single Camera POC)

### Step 1: Flash SD Card (10 minutes)

```bash
# 1. Download Raspberry Pi OS Lite (64-bit)
# https://www.raspberrypi.com/software/operating-systems/

# 2. Flash to SD card using Raspberry Pi Imager
# - Enable SSH
# - Set username: pi, password: raspberry
# - Configure WiFi

# 3. Insert SD card into Pi Zero 2 W and boot
# Wait 2-3 minutes for first boot
```

### Step 2: Find Pi on Network

```bash
# From your laptop/PC, find the Pi's IP address
nmap -sn 192.168.1.0/24 | grep -B 2 "Raspberry Pi"

# Or check your router's DHCP client list
```

### Step 3: Copy Setup Script and Run

```bash
# Copy setup script to Pi
scp scripts/setup-pi-camera.sh pi@<pi_ip>:~/

# SSH into Pi
ssh pi@<pi_ip>

# Run setup script
chmod +x setup-pi-camera.sh
sudo ./setup-pi-camera.sh

# Follow prompts:
#   Camera ID: camera-001
#   Patient ID: 1
#   Bed Number: Bed-01
#   Server IP: 192.168.1.100 (your laptop/Jetson IP)
#   Resolution: 1 (720p@15fps - recommended)

# Reboot when prompted
sudo reboot
```

### Step 4: Test Camera Stream

```bash
# After Pi reboots (wait 1 minute), test RTSP stream
# From your laptop/PC:
./tools/test-rtsp-stream.sh rtsp://<pi_ip>:8554/camera-001

# Or view in VLC Media Player:
# Media → Open Network Stream → rtsp://<pi_ip>:8554/camera-001
```

### Step 5: Start Central Processor

```bash
# Install dependencies
pip3 install opencv-python paho-mqtt pyyaml

# Edit config with your camera's RTSP URL
nano configs/central-processor-config.yaml

# Start processor
python3 scripts/central-ocr-processor.py --config configs/central-processor-config.yaml

# You should see:
# [INFO] Connected to MQTT broker
# [INFO] Started processing camera camera-001
# [camera-001] HR=142, SpO2=96, Inference=350ms, Conf=0.91
```

**✅ POC Complete!** You now have one camera streaming and processing vitals.

---

## 📦 Bulk Deployment (8 Cameras)

### Step 1: Prepare Configuration

```bash
# Copy template and edit
cp configs/cameras-config-template.csv configs/cameras-config.csv
nano configs/cameras-config.csv

# Fill in your camera details:
# camera_id,patient_id,bed_number,server_ip,wifi_ssid,wifi_password
# camera-001,1,Bed-01,192.168.1.100,NICU-Network,YourPassword
# camera-002,2,Bed-02,192.168.1.100,NICU-Network,YourPassword
# ... (8 total)
```

### Step 2: Run Bulk Deployment

```bash
# Run bulk deployment script
sudo ./scripts/bulk-deploy.sh

# Choose option 1: Deploy cameras from config file

# For each camera:
#   1. Insert blank SD card
#   2. Select device (e.g., /dev/sdb)
#   3. Confirm (type YES)
#   4. Wait 5-10 minutes for flashing
#   5. Remove SD card
#   6. Label SD card with camera ID
#   7. Press Enter for next camera

# Repeat for all 8 cameras
```

### Step 3: Install All Cameras

```bash
# 1. Insert each SD card into corresponding Pi Zero 2 W
# 2. Mount Pis near monitors (3-6 feet away)
# 3. Connect power
# 4. Wait 3-5 minutes for first boot and auto-configuration
```

### Step 4: Verify All Cameras Online

```bash
# Discover cameras on network
./tools/discover-cameras.sh 192.168.1

# Output shows all cameras:
# IP Address      Hostname             Status        RTSP Stream
# -------------------------------------------------------------
# 192.168.1.10    nicu-cam-camera-001  ✓ Online      Available
# 192.168.1.11    nicu-cam-camera-002  ✓ Online      Available
# ... (8 total)
```

### Step 5: Configure Central Processor

```bash
# Edit config with all camera URLs
nano configs/central-processor-config.yaml

# Verify all 8 cameras are listed:
cameras:
  - patient_id: 1
    camera_id: "camera-001"
    rtsp_url: "rtsp://192.168.1.10:8554/camera-001"
    enabled: true
  # ... (8 total)
```

### Step 6: Start Production System

```bash
# Start central processor
python3 scripts/central-ocr-processor.py --config configs/central-processor-config.yaml

# Monitor logs
tail -f /var/log/nicu-ocr-processor.log

# Check MQTT messages
mosquitto_sub -t "nicu/+/patient/+/vitals/camera" -v
```

**✅ Production Deployment Complete!** All 8 cameras processing vitals.

---

## 🛠️ Configuration Reference

### Pi Zero 2 W Camera Configuration

Located on each Pi at: `/boot/nicu-camera-config.txt`

```bash
CAMERA_ID="camera-001"          # Unique camera identifier
PATIENT_ID="1"                  # Patient database ID
BED_NUMBER="Bed-01"             # Human-readable bed identifier
SERVER_IP="192.168.1.100"       # Central processor IP
RTSP_PORT="8554"                # RTSP streaming port
VIDEO_WIDTH="1280"              # Video resolution width
VIDEO_HEIGHT="720"              # Video resolution height
VIDEO_FPS="15"                  # Frames per second
VIDEO_BITRATE="2M"              # Streaming bitrate
```

**To reconfigure a camera:**
```bash
ssh pi@<camera_ip>
sudo nano /boot/nicu-camera-config.txt
# Edit values
sudo reboot
```

### Central Processor Configuration

Located at: `configs/central-processor-config.yaml`

Key settings:
- **MQTT**: Broker address and credentials
- **Cameras**: List of all camera streams
- **OCR**: Model paths and confidence thresholds
- **Processing**: Frame intervals and reconnection settings
- **Health**: Monitoring and alerting thresholds

---

## 🔧 Troubleshooting

### Camera Not Streaming

```bash
# SSH into camera
ssh pi@<camera_ip>

# Check service status
sudo systemctl status nicu-camera.service

# View logs
sudo journalctl -u nicu-camera.service -n 50

# Restart service
sudo systemctl restart nicu-camera.service

# Check camera hardware
libcamera-hello --timeout 5000
```

### Cannot Reach Camera

```bash
# Ping camera
ping <camera_ip>

# If unreachable:
# 1. Check camera is powered on
# 2. Verify WiFi credentials in /boot/nicu-camera-config.txt
# 3. Check router DHCP leases
# 4. Connect monitor/keyboard to Pi for direct troubleshooting
```

### RTSP Stream Issues

```bash
# Test stream
./tools/test-rtsp-stream.sh rtsp://<camera_ip>:8554/<camera_id>

# If fails:
# 1. Check streaming service is running
# 2. Verify RTSP port is correct (8554)
# 3. Test with VLC: vlc rtsp://<camera_ip>:8554/<camera_id>
# 4. Check firewall isn't blocking port
```

### Low Frame Rate / Quality

```bash
# SSH into camera
ssh pi@<camera_ip>

# Edit configuration for lower resolution
sudo nano /boot/nicu-camera-config.txt

# Change to 640x480 @ 30fps:
VIDEO_WIDTH="640"
VIDEO_HEIGHT="480"
VIDEO_FPS="30"
VIDEO_BITRATE="1M"

# Reboot
sudo reboot
```

### Central Processor Not Receiving Streams

```bash
# Check MQTT broker is running
sudo systemctl status mosquitto

# Check network connectivity to cameras
for i in {10..17}; do ping -c 1 192.168.1.$i; done

# Test individual stream
python3 -c "import cv2; cap = cv2.VideoCapture('rtsp://192.168.1.10:8554/camera-001'); print('OK' if cap.isOpened() else 'FAIL')"

# Review processor logs
tail -f /var/log/nicu-ocr-processor.log
```

---

## 📊 Monitoring & Maintenance

### Camera Health Checks

Each camera runs automatic health checks every 5 minutes:

```bash
# View health log
ssh pi@<camera_ip>
tail -f /var/log/nicu-camera-health.log

# Manual health check
sudo /usr/local/bin/nicu-camera-health.sh
```

### Camera Status Dashboard

```bash
# On any camera, view detailed status
ssh pi@<camera_ip>
nicu-camera-status.sh

# Output:
# ========================================
# NICU Camera Status
# ========================================
# Configuration:
#   Camera ID:     camera-001
#   Patient ID:    1
#   ...
# System Status:
#   Temperature:   45.2°C
#   Uptime:        2 days, 4 hours
#   ...
```

### Network-Wide Camera Discovery

```bash
# Scan network for all cameras
./tools/discover-cameras.sh 192.168.1

# Shows:
# - All cameras on network
# - Online/offline status
# - RTSP availability
```

### Central Processor Monitoring

```bash
# Real-time logs
tail -f /var/log/nicu-ocr-processor.log

# Monitor MQTT traffic
mosquitto_sub -t "nicu/#" -v

# Check processor is running
ps aux | grep central-ocr-processor
```

---

## 🔄 Regular Maintenance Tasks

### Weekly

- [ ] Check camera health logs for errors
- [ ] Verify all cameras are online
- [ ] Clean camera lenses (dust, fingerprints)
- [ ] Check CPU temperatures (<70°C)
- [ ] Review OCR confidence scores (>85%)

### Monthly

- [ ] Update Raspberry Pi OS: `sudo apt update && sudo apt upgrade`
- [ ] Check SD card health: `sudo smartctl -a /dev/mmcblk0`
- [ ] Review network bandwidth usage
- [ ] Verify backup power (UPS) is functional
- [ ] Test camera failover/reconnection

### Quarterly

- [ ] Review camera positioning and image quality
- [ ] Update OCR models if new versions available
- [ ] Audit configuration files for accuracy
- [ ] Test disaster recovery procedures
- [ ] Replace any failing SD cards

---

## 📈 Performance Metrics

### Target Performance (Per Camera)

| Metric | Target | Acceptable | Action Required |
|--------|--------|------------|-----------------|
| **Uptime** | >99% | >95% | <95%: Investigate |
| **OCR Confidence** | >90% | >85% | <85%: Adjust camera |
| **Inference Time** | <500ms | <1000ms | >1000ms: Optimize |
| **Stream Latency** | <200ms | <500ms | >500ms: Check network |
| **CPU Temperature** | <60°C | <70°C | >70°: Add cooling |

### Monitoring Commands

```bash
# Check inference performance
grep "Inference=" /var/log/nicu-ocr-processor.log | tail -100 | awk '{print $X}' | sort -n | awk '{sum+=$1; n++} END {print "Avg: " sum/n "ms"}'

# Check confidence scores
grep "Conf=" /var/log/nicu-ocr-processor.log | tail -100 | awk '{print $X}' | sort -n | awk '{sum+=$1; n++} END {print "Avg: " sum/n}'

# Check camera temperatures
for i in {10..17}; do
    echo -n "Camera $i: "
    ssh pi@192.168.1.$i "vcgencmd measure_temp"
done
```

---

## 🆘 Common Issues & Solutions

### Issue: Camera boots but doesn't stream

**Solution:**
```bash
ssh pi@<camera_ip>
sudo journalctl -u nicu-camera.service -n 100
# Look for errors like "camera not detected" or "ffmpeg failed"

# Verify camera hardware
libcamera-hello --timeout 5000

# If camera not detected:
sudo raspi-config
# Interface Options → Camera → Enable
sudo reboot
```

### Issue: Stream connects but shows black screen

**Solution:**
```bash
# Check camera is facing monitor (not wall/ceiling)
# Verify monitor is powered on
# Adjust camera position/angle
# Check lighting conditions

# Test camera view
ssh pi@<camera_ip>
libcamera-jpeg -o test.jpg
# Copy test.jpg to laptop and verify image quality
```

### Issue: High latency (>1s)

**Solution:**
```bash
# Reduce resolution
# Edit /boot/nicu-camera-config.txt:
VIDEO_WIDTH="640"
VIDEO_HEIGHT="480"
VIDEO_BITRATE="1M"

# Use wired ethernet instead of WiFi
# Add USB ethernet adapter to Pi Zero 2 W

# Check network congestion
# Dedicate VLAN for camera traffic
```

### Issue: OCR confidence consistently low

**Solution:**
```bash
# Improve image quality:
# 1. Clean camera lens
# 2. Adjust camera angle (perpendicular to screen)
# 3. Improve lighting (avoid glare)
# 4. Move camera closer (3-4 feet optimal)
# 5. Increase resolution to 1080p

# Verify monitor display is clear
# Check monitor text size is readable
```

---

## 📚 Additional Resources

### Scripts Reference

- **setup-pi-camera.sh**: Automated Pi Zero 2 W configuration
- **bulk-deploy.sh**: Mass SD card deployment automation
- **central-ocr-processor.py**: Central OCR processing service
- **test-rtsp-stream.sh**: RTSP stream testing utility
- **discover-cameras.sh**: Network camera discovery tool

### Configuration Files

- **cameras-config.csv**: Bulk deployment camera list
- **central-processor-config.yaml**: Central processor settings
- **nicu-camera-config.txt**: Per-camera configuration (on Pi)

### Logs

- **/var/log/nicu-camera-health.log**: Camera health checks
- **/var/log/nicu-ocr-processor.log**: Central processor logs
- **journalctl -u nicu-camera.service**: Camera streaming logs

---

## 💡 Tips & Best Practices

1. **Label Everything**: Use labels on cameras, cables, and SD cards
2. **Static IPs**: Assign static IPs to cameras in router DHCP settings
3. **Backup Configs**: Keep backup copies of all configuration files
4. **Test Failover**: Regularly test what happens when cameras go offline
5. **Document Changes**: Keep notes on any configuration modifications
6. **Monitor Temperatures**: Cameras in hot environments need cooling
7. **Use Wired Network**: Ethernet more reliable than WiFi for critical systems
8. **Redundancy**: Consider 2 cameras per monitor for critical beds

---

## 🚀 Next Steps After Deployment

1. **Integrate with Cloud**: Connect to NICU Dashboard API
2. **Add Alerting**: Set up notifications for camera failures
3. **Implement Analytics**: Track OCR accuracy over time
4. **Build Dashboard**: Create monitoring dashboard for IT staff
5. **Document Workflows**: Create SOPs for clinical staff
6. **Plan Scaling**: Prepare for additional units/hospitals

---

## 📞 Support

For issues not covered in this guide:

1. Check logs first (see Logs section)
2. Review OCR_INTEGRATION_PLAN.md for architecture details
3. Test with debugging tools (test-rtsp-stream.sh, discover-cameras.sh)
4. Review GitHub issues for ICU-Monitor-Vitals-Extractor

---

**Version**: 1.0.0
**Last Updated**: 2026-01-08
**Maintainer**: NICU Dashboard Team
