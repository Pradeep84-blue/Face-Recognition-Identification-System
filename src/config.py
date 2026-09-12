from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
EMBEDDING_DIR = BASE_DIR / "data" / "embeddings"
TEST_DATA_DIR = BASE_DIR / "data" / "test"

# Project Configurations 
MODEL_NAME = "buffalo_l"
DETECTION_SIZE = (640, 640)
THRESHOLD = 0.45            # similarity score required to recognize a person
REGISTRATION_SAMPLES = 10   # Number of pictures captured for each person during registration
MIN_FACE_SIZE = 80          # Ignores tiny faces in background

    