import numpy as np
from insightface.app import FaceAnalysis

try:
    from .config import DETECTION_SIZE, EMBEDDING_DIR, MODEL_NAME, THRESHOLD
except ImportError:
    from config import DETECTION_SIZE, EMBEDDING_DIR, MODEL_NAME, THRESHOLD


def create_face_analyzer():
    # Load insightface model on CPU
    analyzer = FaceAnalysis(name=MODEL_NAME, providers=["CPUExecutionProvider"])
    analyzer.prepare(ctx_id=-1, det_size=DETECTION_SIZE)
    return analyzer


def normalize_embedding(embedding):
    # Normalize vector to unit length for cosine similarity calculation
    vector = np.asarray(embedding, dtype=np.float32)
    norm = np.linalg.norm(vector, axis=-1, keepdims=True)
    if np.any(norm == 0):
        raise ValueError("Face embedding cannot be a zero vector.")
    return vector / norm


def load_embeddings(directory=EMBEDDING_DIR):
    # Load all stored .npy embeddings from data folder
    if not directory.exists():
        return {}

    known_faces = {}
    for file_path in sorted(directory.glob("*.npy")):
        embeddings = np.load(file_path)
        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)
        if embeddings.ndim != 2 or embeddings.shape[0] == 0:
            continue
        known_faces[file_path.stem] = normalize_embedding(embeddings)
    return known_faces


def find_best_match(embedding, known_faces, threshold=THRESHOLD):
    # Compare current face against all registered face embeddings
    query = normalize_embedding(embedding)
    best_name = "Unknown"
    best_score = -1.0

    for name, references in known_faces.items():
        # Dot product of normalized vectors gives cosine similarity
        score = float(np.max(references @ query))
        if score > best_score:
            best_name = name
            best_score = score

    # If score is lower than threshold, mark as Unknown
    if best_score < threshold:
        best_name = "Unknown"
    return best_name, best_score
