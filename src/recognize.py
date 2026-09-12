import cv2

try:
    from .config import MIN_FACE_SIZE
    from .core import create_face_analyzer, find_best_match, load_embeddings
except ImportError:
    from config import MIN_FACE_SIZE
    from core import create_face_analyzer, find_best_match, load_embeddings


def main():
    # Load registered faces
    known_faces = load_embeddings()
    if not known_faces:
        print("No enrolled faces found. Run `python src/register.py` first.")
        return

    # Start face detector and webcam
    analyzer = create_face_analyzer()
    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        print("Error: Webcam not found.")
        return

    print("Recognition started. Press Q to quit.")
    try:
        while True:
            success, frame = camera.read()
            if not success:
                break

            # Detect all faces in current frame
            for face in analyzer.get(frame):
                x1, y1, x2, y2 = map(int, face.bbox)
                
                # Skip tiny faces
                if x2 - x1 < MIN_FACE_SIZE or y2 - y1 < MIN_FACE_SIZE:
                    continue

                # Match face with stored database
                name, score = find_best_match(face.embedding, known_faces)
                is_known = name != "Unknown"
                color = (0, 255, 0) if is_known else (0, 80, 255)
                label = f"{name} ({score:.2f})"

                # Draw bounding box and label
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    frame,
                    label,
                    (x1, max(y1 - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    color,
                    2,
                )

            cv2.imshow("Face Recognition", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        camera.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
