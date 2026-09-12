# Real-Time Face Recognition System

A real-time facial recognition system built using **Python, InsightFace (ArcFace/RetinaFace), OpenCV, FastAPI, and React**.

The system enrolls face embeddings via webcam, stores 512-dimensional facial feature vectors per identity, and identifies faces in real-time using **Cosine Similarity** with an **Unknown rejection threshold**.

---

## 📌 Features
- **Face Detection & Embeddings:** Uses pretrained InsightFace (`buffalo_l`) running locally on CPU.
- **Webcam Enrollment:** Registers new users by capturing 10 face sample embeddings (`.npy` files).
- **Cosine Similarity Matching:** Fast vector dot-product matching against saved identities.
- **Unknown Face Rejection:** Rejects unauthorized/unknown individuals if similarity score is below `0.45`.
- **Dual Interface:**
  - Standalone Desktop UI (OpenCV window).
  - Modern Web Dashboard (React + FastAPI).

---

## 🛠️ Tech Stack
- **Machine Learning / CV:** InsightFace, ONNX Runtime, OpenCV, NumPy
- **Backend API:** FastAPI, Uvicorn
- **Frontend:** React (Vite), HTML5 Canvas/Webcam API
- **Language:** Python 3.10+, JavaScript

---

## 📂 Project Structure
```text
facial-recognition/
├── backend/
│   └── app.py               # FastAPI backend API for web recognition
├── frontend/                # React web dashboard
│   ├── src/
│   │   ├── App.jsx          # Camera UI and real-time bounding boxes
│   │   └── App.css
│   └── package.json
├── src/
│   ├── config.py            # Thresholds and model configurations
│   ├── core.py              # Model loading, normalization, and similarity matching
│   ├── register.py          # Script to enroll new people using webcam
│   ├── recognize.py         # Standalone desktop OpenCV recognition
│   └── evaluate.py          # Benchmark test script
├── data/
│   └── embeddings/          # Stored .npy face embeddings
├── requirements.txt         # Python dependencies
└── README.md
```

---

## 🚀 How to Run

### 1. Setup Environment
Activate the virtual environment and install dependencies:
```powershell
# Activate Python environment
.\venv\Scripts\Activate.ps1

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..
```

---

### 2. Register a New Face

#### Method A: From Web Dashboard (Recommended)
1. Open the web dashboard at `http://localhost:5173`.
2. Click **"➕ Enroll Face"** or **"Register New Face"**.
3. Type the person's name and follow the **10-Angle Guided Capture** wizard (look straight, smile, turn left, turn right, tilt up/down, etc.).
4. Review the 10 captured photo thumbnails and click **"Save & Complete Enrollment"**.

#### Method B: From Terminal CLI
```powershell
python -m src.register
```
- Enter the person's name.
- Look at the webcam and press **SPACEBAR** to capture 10 photo samples with different angles.
- The 512-D face vectors are saved to `data/embeddings/<name>.npy`.

---

### 3. Run Recognition

#### Option A: Desktop OpenCV Window
```powershell
python -m src.recognize
```
*(Press **Q** to exit the camera window).*

#### Option B: Web Dashboard (FastAPI + React)
Open two terminals:

**Terminal 1 (Backend):**
```powershell
uvicorn backend.app:app --reload
```

**Terminal 2 (Frontend):**
```powershell
cd frontend
npm run dev
```
Open **http://localhost:5173** in your browser and click **Start recognition**.

---

## 🧠 How It Works (For Viva & Presentation)

1. **Face Detection (RetinaFace):**
   Locates face bounding boxes \((x_1, y_1, x_2, y_2)\) from each webcam frame.

2. **Embedding Generation (ArcFace):**
   Converts the cropped face image into a **512-dimensional vector** that captures unique facial geometry (eye spacing, jawline, nose bridge).

3. **L2 Normalization:**
   Converts the 512-D vector to unit length ($\|v\| = 1$).

4. **Cosine Similarity Matching:**
   Calculates the dot product between the live normalized vector and all enrolled reference vectors:
   $$\text{Similarity} = A \cdot B$$
   - Score ranges from **-1.0 to 1.0** (higher = closer match).

5. **Decision & Thresholding:**
   - If $\text{Max Score} \ge 0.45 \implies$ **Recognized Name**
   - If $\text{Max Score} < 0.45 \implies$ **Unknown**

---

## 🚢 Deployment Guide

### Option 1: Cloud Deployment (Vercel + Render)
1. **Frontend (Vercel / Netlify):**
   - Push repository to GitHub.
   - Deploy `frontend/` directory to Vercel.
   - Set environment variable: `VITE_API_URL=https://your-backend.onrender.com`
2. **Backend (Render / Railway):**
   - Create a new Web Service pointing to your repo.
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
   - Set environment variable: `FRONTEND_ORIGINS=*`

### Option 2: Docker Deployment
Build and run the containerized backend:
```bash
docker build -t face-recognition-api .
docker run -p 8000:8000 face-recognition-api
```
Or using Docker Compose:
```bash
docker compose up --build
```

---

## ❓ Frequently Asked Viva Questions

* **Q: Why use embeddings instead of pixel matching?**
  * *A:* Embeddings extract high-level facial representations that are invariant to lighting changes, minor expressions, and slight angles.
* **Q: What is Cosine Similarity?**
  * *A:* It measures the cosine of the angle between two vectors in 512-D space. If two face vectors point in almost the same direction, the cosine value is close to 1.0.
* **Q: Why is threshold set to 0.45?**
  * *A:* 0.45 balances false positives (falsely accepting strangers) and false negatives (failing to recognize registered users).
* **Q: Why are frontend and backend on different ports?**
  * *A:* Vite dev server runs Node.js on port `5173` to compile React UI, while FastAPI runs Python on port `8000` to execute the ML models. They communicate over HTTP REST API (`/recognize`).

