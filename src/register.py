import re
import cv2
import numpy as np

try:
    from .config import EMBEDDING_DIR, REGISTRATION_SAMPLES
    from .core import create_face_analyzer, normalize_embedding
except ImportError:
    from config import EMBEDDING_DIR, REGISTRATION_SAMPLES
    from core import create_face_analyzer, normalize_embedding

VALID_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$")


def get_name():
    name = input("Enter person name: ").strip()
    if not VALID_NAME.fullmatch(name):
        raise ValueError("Name can only contain letters, numbers, spaces, or hyphens.")
    return name


def main():
    try:
        name = get_name()
    except ValueError as error:
        print(f"Error: {error}")
        return

    EMBEDDING_DIR.mkdir(parents=True, exist_ok=True)
    analyzer = create_face_analyzer()
    camera = cv2.VideoCapture(0)
    embeddings = []

    if not camera.isOpened():
        print("Error: Could not open webcam.")
        return

    print("\nRegistration started.")
    print("-> Press SPACEBAR to capture sample.")
    print("-> Press 'q' to cancel/quit.\n")

    try:
        while len(embeddings) < REGISTRATION_SAMPLES:
            success, frame = camera.read()
            if not success:
                print("Could not read frame from camera.")
                break

            # Find faces in current frame
            faces = analyzer.get(frame)
            for face in faces:
                x1, y1, x2, y2 = map(int, face.bbox)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # Show progress on screen
            cv2.putText(
                frame,
                f"Captured: {len(embeddings)}/{REGISTRATION_SAMPLES}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2,
            )
            cv2.imshow("Register Face", frame)
            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                break
            if key != ord(" "):
                continue

            # Ensure only 1 face is in front of camera
            if len(faces) != 1:
                print("Make sure exactly one face is visible.")
                continue

            # Save normalized 512-D face embedding
            embeddings.append(normalize_embedding(faces[0].embedding))
            print(f"Sample {len(embeddings)}/{REGISTRATION_SAMPLES} captured.")
    finally:
        camera.release()
        cv2.destroyAllWindows()

    if not embeddings:
        print("No samples captured.")
        return

    # Save to data/embeddings/<name>.npy
    output_path = EMBEDDING_DIR / f"{name}.npy"
    np.save(output_path, np.asarray(embeddings, dtype=np.float32))
    print(f"\nSuccessfully registered {name}! Saved embeddings to {output_path.name}")


if __name__ == "__main__":
    main()
