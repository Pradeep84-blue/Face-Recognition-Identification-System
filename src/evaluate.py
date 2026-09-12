import cv2

try:
    from .config import TEST_DATA_DIR
    from .core import create_face_analyzer, find_best_match, load_embeddings
except ImportError:
    from config import TEST_DATA_DIR
    from core import create_face_analyzer, find_best_match, load_embeddings

IMAGE_EXTENSIONS = {".bmp", ".jpeg", ".jpg", ".png", ".webp"}


def image_files(directory):
    if not directory.exists():
        return []
    return sorted(
        path for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def evaluate_images(images, expected_name, analyzer, known_faces):
    # Test images against model predictions
    total = correct = skipped = 0
    for path in images:
        image = cv2.imread(str(path))
        faces = analyzer.get(image) if image is not None else []
        if len(faces) != 1:
            skipped += 1
            print(f"Skipped {path.name}: needs exactly 1 visible face.")
            continue

        predicted_name, score = find_best_match(faces[0].embedding, known_faces)
        total += 1
        correct += predicted_name == expected_name
        print(
            f"{path.name:<25} Expected: {expected_name:<10} "
            f"Predicted: {predicted_name:<10} Score: {score:.2f}"
        )
    return total, correct, skipped


def known_test_sets(known_root, enrolled_names):
    if known_root.exists():
        identity_folders = [path for path in known_root.iterdir() if path.is_dir()]
    else:
        identity_folders = []
    if identity_folders:
        for folder in sorted(identity_folders):
            if folder.name not in enrolled_names:
                print(f"Skipping {folder.name}: not in database.")
                continue
            yield folder.name, image_files(folder)
        return

    flat_images = image_files(known_root)
    if flat_images and len(enrolled_names) == 1:
        yield next(iter(enrolled_names)), flat_images


def percentage(correct, total):
    return f"{(correct / total * 100):.1f}%" if total else "N/A"


def main():
    known_faces = load_embeddings()
    if not known_faces:
        print("No registered faces found. Run register.py first.")
        return

    analyzer = create_face_analyzer()
    known_total = known_correct = known_skipped = 0
    unknown_total = unknown_correct = unknown_skipped = 0

    print("\n--- Testing Known Faces ---")
    for expected_name, images in known_test_sets(
        TEST_DATA_DIR / "known", set(known_faces)
    ):
        total, correct, skipped = evaluate_images(
            images, expected_name, analyzer, known_faces
        )
        known_total += total
        known_correct += correct
        known_skipped += skipped

    print("\n--- Testing Unknown Faces ---")
    unknown_total, unknown_correct, unknown_skipped = evaluate_images(
        image_files(TEST_DATA_DIR / "unknown"),
        "Unknown",
        analyzer,
        known_faces,
    )

    print("\n================== ACCURACY REPORT ==================")
    print(f"Known faces tested   : {known_total} (Correct: {known_correct}, Accuracy: {percentage(known_correct, known_total)})")
    print(f"Unknown faces tested : {unknown_total} (Rejected: {unknown_correct}, Accuracy: {percentage(unknown_correct, unknown_total)})")
    print("=====================================================")


if __name__ == "__main__":
    main()
