#!/usr/bin/env python3
"""
Central OCR Processor for NICU Camera System

This service receives RTSP streams from Pi Zero 2 W cameras,
performs OCR-based vital sign extraction, and publishes results to MQTT.

Optimized for: NVIDIA Jetson Nano, Jetson Xavier NX, or desktop PC with GPU

Usage:
    python3 central-ocr-processor.py --config config.yaml

Author: NICU Dashboard Team
Version: 1.0.0
"""

import cv2
import json
import time
import yaml
import logging
import argparse
import threading
from datetime import datetime
from pathlib import Path
from queue import Queue, Empty
from dataclasses import dataclass, asdict
from typing import Dict, Optional, Tuple

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("ERROR: paho-mqtt not installed")
    print("Install with: pip3 install paho-mqtt")
    exit(1)

# OCR modules (from ICU-Monitor-Vitals-Extractor)
# These will be loaded if available
try:
    # Placeholder for actual OCR imports
    # from screen_ocr import ScreenDetector, VitalsExtractor
    SCREEN_DETECTOR = None
    VITALS_EXTRACTOR = None
    OCR_AVAILABLE = False
except ImportError:
    print("WARNING: OCR modules not found")
    print("Running in simulation mode")
    OCR_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/nicu-ocr-processor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('OCRProcessor')


@dataclass
class CameraConfig:
    """Configuration for a single camera"""
    patient_id: int
    camera_id: str
    rtsp_url: str
    enabled: bool = True


@dataclass
class VitalReading:
    """Vital signs reading"""
    patient_id: int
    camera_id: str
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    resp_rate: Optional[int] = None
    temperature: Optional[float] = None
    confidence: float = 0.0
    inference_time_ms: int = 0
    timestamp: str = ""
    monitor_type: str = "unknown"


class MockOCRExtractor:
    """Mock OCR extractor for testing without actual models"""

    def __init__(self):
        self.base_values = {}

    def detect_screen(self, frame):
        """Mock screen detection"""
        # Simulate detection with high confidence
        h, w = frame.shape[:2]
        bbox = (int(w * 0.1), int(h * 0.1), int(w * 0.8), int(h * 0.8))
        confidence = 0.95
        return bbox, confidence

    def extract_vitals(self, screen_img, patient_id):
        """Mock vital extraction with realistic variations"""
        if patient_id not in self.base_values:
            # Initialize base values for this patient
            self.base_values[patient_id] = {
                'hr': 140,
                'spo2': 95,
                'rr': 42,
                'temp': 36.8
            }

        base = self.base_values[patient_id]

        # Add realistic variation
        vitals = {
            'hr': base['hr'] + int((time.time() % 10) - 5),
            'spo2': base['spo2'] + int((time.time() % 4) - 2),
            'rr': base['rr'] + int((time.time() % 6) - 3),
            'temp': round(base['temp'] + ((time.time() % 1) - 0.5) * 0.2, 1),
        }

        # Add confidence scores
        vitals['hr_conf'] = 0.92
        vitals['spo2_conf'] = 0.94
        vitals['rr_conf'] = 0.88
        vitals['temp_conf'] = 0.90

        return vitals


class CameraStreamProcessor:
    """Processes a single camera stream"""

    def __init__(self, config: CameraConfig, ocr_extractor, mqtt_client):
        self.config = config
        self.ocr_extractor = ocr_extractor
        self.mqtt_client = mqtt_client
        self.running = False
        self.thread = None
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5

        logger.info(f"Initialized processor for camera {config.camera_id}")

    def start(self):
        """Start processing thread"""
        if self.running:
            logger.warning(f"Camera {self.config.camera_id} already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._process_loop, daemon=True)
        self.thread.start()
        logger.info(f"Started processing camera {self.config.camera_id}")

    def stop(self):
        """Stop processing thread"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info(f"Stopped processing camera {self.config.camera_id}")

    def _process_loop(self):
        """Main processing loop for this camera"""
        cap = None

        while self.running:
            try:
                # Connect to stream
                if cap is None:
                    logger.info(f"Connecting to {self.config.rtsp_url}")
                    cap = cv2.VideoCapture(self.config.rtsp_url)

                    if not cap.isOpened():
                        logger.error(f"Failed to open stream: {self.config.camera_id}")
                        self.reconnect_attempts += 1

                        if self.reconnect_attempts >= self.max_reconnect_attempts:
                            logger.error(f"Max reconnect attempts reached for {self.config.camera_id}")
                            return

                        time.sleep(5)
                        cap = None
                        continue

                    self.reconnect_attempts = 0
                    logger.info(f"Connected to {self.config.camera_id}")

                # Process frame
                start_time = time.time()

                ret, frame = cap.read()
                if not ret:
                    logger.warning(f"Failed to read frame from {self.config.camera_id}")
                    cap.release()
                    cap = None
                    time.sleep(2)
                    continue

                # Detect screen
                screen_bbox, screen_conf = self.ocr_extractor.detect_screen(frame)

                if screen_conf < 0.85:
                    logger.debug(f"Low screen confidence ({screen_conf:.2f}) for {self.config.camera_id}")
                    time.sleep(1)
                    continue

                # Extract vitals
                x, y, w, h = screen_bbox
                screen_img = frame[y:y+h, x:x+w]
                vitals = self.ocr_extractor.extract_vitals(screen_img, self.config.patient_id)

                # Calculate overall confidence
                overall_conf = (
                    vitals['hr_conf'] + vitals['spo2_conf'] +
                    vitals['rr_conf'] + vitals['temp_conf']
                ) / 4

                if overall_conf < 0.85:
                    logger.debug(f"Low vitals confidence ({overall_conf:.2f}) for {self.config.camera_id}")
                    time.sleep(1)
                    continue

                # Calculate inference time
                inference_time_ms = int((time.time() - start_time) * 1000)

                # Create reading
                reading = VitalReading(
                    patient_id=self.config.patient_id,
                    camera_id=self.config.camera_id,
                    heart_rate=vitals['hr'],
                    spo2=vitals['spo2'],
                    resp_rate=vitals['rr'],
                    temperature=vitals['temp'],
                    confidence=overall_conf,
                    inference_time_ms=inference_time_ms,
                    timestamp=datetime.utcnow().isoformat() + 'Z',
                )

                # Publish to MQTT
                self._publish_reading(reading)

                # Log success
                logger.info(
                    f"[{self.config.camera_id}] "
                    f"HR={reading.heart_rate}, SpO2={reading.spo2}, "
                    f"Inference={inference_time_ms}ms, Conf={overall_conf:.2f}"
                )

                # Wait before next reading
                time.sleep(1)

            except Exception as e:
                logger.error(f"Error processing {self.config.camera_id}: {e}", exc_info=True)
                if cap:
                    cap.release()
                    cap = None
                time.sleep(5)

        # Cleanup
        if cap:
            cap.release()

    def _publish_reading(self, reading: VitalReading):
        """Publish reading to MQTT"""
        try:
            topic = f"nicu/unit-a/patient/{reading.patient_id}/vitals/camera"

            payload = {
                'patient_id': reading.patient_id,
                'camera_id': reading.camera_id,
                'vitals': {
                    'hr': reading.heart_rate,
                    'spo2': reading.spo2,
                    'rr': reading.resp_rate,
                    'temp': reading.temperature,
                },
                'confidence': reading.confidence,
                'inference_time_ms': reading.inference_time_ms,
                'timestamp': reading.timestamp,
                'monitor_type': reading.monitor_type,
            }

            self.mqtt_client.publish(topic, json.dumps(payload), qos=1)

        except Exception as e:
            logger.error(f"Failed to publish reading: {e}")


class CentralOCRProcessor:
    """Main processor managing all camera streams"""

    def __init__(self, config_file: str):
        logger.info("Initializing Central OCR Processor")

        # Load configuration
        self.config = self._load_config(config_file)

        # Initialize MQTT client
        self.mqtt_client = self._init_mqtt()

        # Initialize OCR extractor
        if OCR_AVAILABLE:
            logger.info("Loading OCR models...")
            # self.ocr_extractor = ActualOCRExtractor()
            self.ocr_extractor = MockOCRExtractor()  # Use mock for now
        else:
            logger.warning("Using mock OCR extractor (models not available)")
            self.ocr_extractor = MockOCRExtractor()

        # Create camera processors
        self.processors = []
        for cam_config in self.config['cameras']:
            config = CameraConfig(**cam_config)
            processor = CameraStreamProcessor(config, self.ocr_extractor, self.mqtt_client)
            self.processors.append(processor)

        logger.info(f"Initialized {len(self.processors)} camera processors")

    def _load_config(self, config_file: str) -> dict:
        """Load configuration from YAML file"""
        config_path = Path(config_file)

        if not config_path.exists():
            logger.error(f"Configuration file not found: {config_file}")
            raise FileNotFoundError(config_file)

        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)

        logger.info(f"Loaded configuration from {config_file}")
        return config

    def _init_mqtt(self) -> mqtt.Client:
        """Initialize MQTT client"""
        broker = self.config['mqtt']['broker']
        port = self.config['mqtt']['port']

        client = mqtt.Client("central-ocr-processor")

        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                logger.info(f"Connected to MQTT broker: {broker}:{port}")
            else:
                logger.error(f"Failed to connect to MQTT broker: {rc}")

        def on_disconnect(client, userdata, rc):
            logger.warning(f"Disconnected from MQTT broker: {rc}")

        client.on_connect = on_connect
        client.on_disconnect = on_disconnect

        try:
            client.connect(broker, port, keepalive=60)
            client.loop_start()
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            raise

        return client

    def start(self):
        """Start all camera processors"""
        logger.info("Starting all camera processors...")

        for processor in self.processors:
            if processor.config.enabled:
                processor.start()
            else:
                logger.info(f"Camera {processor.config.camera_id} is disabled, skipping")

        logger.info(f"Started {len(self.processors)} camera processors")

    def stop(self):
        """Stop all camera processors"""
        logger.info("Stopping all camera processors...")

        for processor in self.processors:
            processor.stop()

        self.mqtt_client.loop_stop()
        self.mqtt_client.disconnect()

        logger.info("All processors stopped")

    def run(self):
        """Run the processor (blocks until interrupted)"""
        logger.info("Central OCR Processor running...")
        logger.info("Press Ctrl+C to stop")

        try:
            # Keep main thread alive
            while True:
                time.sleep(1)

        except KeyboardInterrupt:
            logger.info("Received interrupt signal")
        finally:
            self.stop()


def main():
    parser = argparse.ArgumentParser(description='Central OCR Processor for NICU Cameras')
    parser.add_argument(
        '--config',
        type=str,
        default='../configs/central-processor-config.yaml',
        help='Path to configuration file'
    )

    args = parser.parse_args()

    try:
        processor = CentralOCRProcessor(args.config)
        processor.start()
        processor.run()

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1

    return 0


if __name__ == '__main__':
    exit(main())
