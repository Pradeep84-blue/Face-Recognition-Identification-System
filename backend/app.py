import os
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from src.config import MIN_FACE_SIZE, MODEL_NAME, THRESHOLD
from src.core import create_face_analyzer, find_best_match, load_embeddings

raw_origins = os.getenv("FRONTEND_ORIGINS", "*")
if raw_origins == "*":
    FRONTEND_ORIGINS = ["*"]
else:
    FRONTEND_ORIGINS = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

# FastAPI app for web interface
app = FastAPI(title="Face Recognition API")

# Allow frontend React app to call this API (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True if "*" not in FRONTEND_ORIGINS else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load face detection and embedding model once at startup
face_analyzer = create_face_analyzer()


def decode_image(image_bytes):
    # Convert raw image bytes received from frontend to OpenCV image
    frame = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image data received.")
    return frame


@app.get("/")
def health_check():
    # Simple status endpoint
    return {
        "status": "online",
        "model": MODEL_NAME,
        "threshold": THRESHOLD,
        "registered_people": len(load_embeddings()),
    }


@app.post("/recognize")
async def recognize(request: Request):
    image_bytes = await request.body()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="No image provided.")

    frame = decode_image(image_bytes)
    height, width = frame.shape[:2]
    known_faces = load_embeddings()
    results = []

    # Detect faces in frame and match against database
    for face in face_analyzer.get(frame):
        x1, y1, x2, y2 = map(int, face.bbox)
        x1, x2 = max(0, x1), min(width, x2)
        y1, y2 = max(0, y1), min(height, y2)

        # Ignore tiny faces
        if x2 - x1 < MIN_FACE_SIZE or y2 - y1 < MIN_FACE_SIZE:
            continue

        name, score = find_best_match(face.embedding, known_faces)
        results.append(
            {
                "name": name,
                "score": round(score, 3),
                "recognized": name != "Unknown",
                "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            }
        )

    return {
        "success": True,
        "faces": results,
        "frame": {"width": width, "height": height},
        "threshold": THRESHOLD,
    }


@app.get("/people")
def get_people():
    # Returns list of all registered names
    known_faces = load_embeddings()
    return {
        "success": True,
        "people": list(known_faces.keys()),
        "count": len(known_faces),
    }


@app.post("/register")
async def register_person(request: Request):
    # Enrolls a new person using face photos captured from web camera
    data = await request.json()
    name = str(data.get("name", "")).strip()
    images = data.get("images", [])

    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Please provide a valid name (at least 2 letters).")

    if not images or not isinstance(images, list):
        raise HTTPException(status_code=400, detail="Please provide at least one face image sample.")

    import base64
    from src.config import EMBEDDING_DIR
    from src.core import normalize_embedding

    EMBEDDING_DIR.mkdir(parents=True, exist_ok=True)
    embeddings = []

    for img_data in images:
        try:
            if "," in img_data:
                img_data = img_data.split(",", 1)[1]
            img_bytes = base64.b64decode(img_data)
            frame = decode_image(img_bytes)
            faces = face_analyzer.get(frame)

            if len(faces) == 1:
                embeddings.append(normalize_embedding(faces[0].embedding))
        except Exception:
            continue

    if not embeddings:
        raise HTTPException(
            status_code=400,
            detail="No clear single face was detected in the captured photos. Please try again.",
        )

    # Save face embeddings to data/embeddings/<name>.npy
    output_path = EMBEDDING_DIR / f"{name}.npy"
    np.save(output_path, np.asarray(embeddings, dtype=np.float32))

    return {
        "success": True,
        "name": name,
        "samples_saved": len(embeddings),
        "message": f"Successfully registered {name} with {len(embeddings)} face samples.",
    }


@app.delete("/people/{name}")
def delete_person(name: str):
    # Deletes an enrolled identity
    from src.config import EMBEDDING_DIR
    file_path = EMBEDDING_DIR / f"{name}.npy"
    if file_path.exists():
        file_path.unlink()
        return {"success": True, "message": f"Deleted {name}."}
    raise HTTPException(status_code=404, detail="Person not found.")



if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=False)

