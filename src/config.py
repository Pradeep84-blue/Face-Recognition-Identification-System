import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
EMBEDDING_DIR = BASE_DIR / "data" / "embeddings"
TEST_DATA_DIR = BASE_DIR / "data" / "test"

# Project Configurations (Optimized for low RAM & fast CPU inference)
MODEL_NAME = os.getenv("MODEL_NAME", "buffalo_sc")
DETECTION_SIZE = (320, 320)
THRESHOLD = 0.45            # Similarity score required to recognize a person
REGISTRATION_SAMPLES = 10   # Number of pictures captured for each person during registration
MIN_FACE_SIZE = 60          # Ignores tiny faces in background


    