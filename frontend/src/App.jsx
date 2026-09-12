import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const DEFAULT_FRAME = { width: 640, height: 480 };
const RECOGNITION_INTERVAL_MS = 1000; // Check camera frame every 1 second

const POSE_INSTRUCTIONS = [
  { step: 1, title: "Look Straight", desc: "Look directly into the camera with a neutral expression", icon: "👤" },
  { step: 2, title: "Smile Naturally", desc: "Look straight and smile naturally", icon: "😊" },
  { step: 3, title: "Turn Head Left", desc: "Turn your head slightly to your LEFT (approx. 15°)", icon: "👈" },
  { step: 4, title: "Turn Head Right", desc: "Turn your head slightly to your RIGHT (approx. 15°)", icon: "👉" },
  { step: 5, title: "Tilt Upwards", desc: "Tilt your chin slightly UPWARDS", icon: "👆" },
  { step: 6, title: "Tilt Downwards", desc: "Tilt your chin slightly DOWNWARDS", icon: "👇" },
  { step: 7, title: "Tilt Left Shoulder", desc: "Tilt your head slightly towards your LEFT shoulder", icon: "↖️" },
  { step: 8, title: "Tilt Right Shoulder", desc: "Tilt your head slightly towards your RIGHT shoulder", icon: "↗️" },
  { step: 9, title: "Slightly Closer", desc: "Move slightly closer to the camera", icon: "🔍" },
  { step: 10, title: "Final Confirmation", desc: "Look straight forward to complete your biometric profile", icon: "✨" },
];


function App() {
  const videoRef = useRef(null);
  const modalVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionInProgress = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [faces, setFaces] = useState([]);
  const [frame, setFrame] = useState(DEFAULT_FRAME);
  const [status, setStatus] = useState("Offline");
  const [error, setError] = useState("");

  // Manual guided registration wizard state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerStep, setRegisterStep] = useState(0); // 0 = name & instructions, 1..10 = capturing, 11 = ready to save
  const [registerName, setRegisterName] = useState("");
  const [capturedSamples, setCapturedSamples] = useState([]);
  const [registerStatus, setRegisterStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [enrolledPeople, setEnrolledPeople] = useState([]);

  // Fetch list of registered people
  const fetchEnrolledPeople = async () => {
    try {
      const res = await fetch(`${API_URL}/people`);
      const data = await res.json();
      if (data.success) {
        setEnrolledPeople(data.people ?? []);
      }
    } catch {
      // Backend offline or unreachable
    }
  };

  useEffect(() => {
    fetchEnrolledPeople();
  }, []);

  // Start webcam stream in browser
  const startCamera = async () => {
    try {
      setError("");
      if (streamRef.current && streamRef.current.active) {
        if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
        if (modalVideoRef.current && modalVideoRef.current.srcObject !== streamRef.current) {
          modalVideoRef.current.srcObject = streamRef.current;
        }
        setCameraActive(true);
        setStatus("Recognizing");
        return streamRef.current;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (modalVideoRef.current) {
        modalVideoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setStatus("Recognizing");
      return stream;
    } catch {
      setError("Unable to access camera. Please allow camera permissions.");
      setStatus("Error");
      return null;
    }
  };

  // Stop webcam stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (modalVideoRef.current) {
      modalVideoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setFaces([]);
    setStatus("Offline");
  };

  // Capture current video frame to JPEG base64 string
  const captureFrameBase64 = useCallback(() => {
    // Pick the actively rendering video element
    const video =
      modalVideoRef.current && modalVideoRef.current.videoWidth > 0
        ? modalVideoRef.current
        : videoRef.current && videoRef.current.videoWidth > 0
        ? videoRef.current
        : null;

    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return null;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  // Capture current video frame to JPEG blob
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return Promise.resolve(null);
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.8);
    });
  }, []);

  // Open Registration Wizard
  const openRegisterWizard = async () => {
    setRegisterName("");
    setRegisterStep(0);
    setCapturedSamples([]);
    setRegisterStatus("");
    setShowRegisterModal(true);
    await startCamera();
  };

  // Close Registration Wizard
  const closeRegisterWizard = () => {
    if (isSaving) return;
    setShowRegisterModal(false);
    setRegisterStep(0);
    setCapturedSamples([]);
    setRegisterStatus("");
  };

  // Start guided pose capture
  const handleStartCaptureSession = async (e) => {
    e.preventDefault();
    if (!registerName.trim()) {
      setRegisterStatus("Please enter your name first.");
      return;
    }
    const stream = await startCamera();
    if (!stream) {
      setRegisterStatus("Webcam permission is required to capture photos.");
      return;
    }
    setRegisterStatus("");
    setCapturedSamples([]);
    setRegisterStep(1); // Move to pose 1
  };

  // Manually capture current pose photo
  const handleManualCapturePhoto = () => {
    const frameBase64 = captureFrameBase64();
    if (!frameBase64) {
      setRegisterStatus("Camera frame not available. Ensure camera is active.");
      return;
    }

    const updatedSamples = [...capturedSamples, frameBase64];
    setCapturedSamples(updatedSamples);
    setRegisterStatus(`Captured photo ${registerStep} of 10!`);

    if (registerStep < 10) {
      setRegisterStep(registerStep + 1);
    } else {
      // Finished all 10 poses
      setRegisterStep(11); // Ready to save
    }
  };

  // Retake previous sample
  const handleRetakeLast = () => {
    if (capturedSamples.length === 0) return;
    const updated = [...capturedSamples];
    updated.pop();
    setCapturedSamples(updated);
    setRegisterStep(Math.max(1, registerStep - 1));
    setRegisterStatus("");
  };

  // Submit all 10 captured samples to backend
  const handleSaveEnrolledFace = async () => {
    if (capturedSamples.length !== 10) {
      setRegisterStatus("All 10 photo samples are required.");
      return;
    }

    setIsSaving(true);
    setRegisterStatus("Extracting 512-D face embeddings from 10 photos...");

    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerName.trim(),
          images: capturedSamples,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.detail || "Registration failed.");
      }

      setRegisterStatus(`🎉 Successfully enrolled ${registerName} with all 10 face samples!`);
      fetchEnrolledPeople();
      setTimeout(() => {
        closeRegisterWizard();
      }, 2000);
    } catch (err) {
      setRegisterStatus(`❌ ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete an enrolled user
  const handleDeletePerson = async (name) => {
    if (!window.confirm(`Delete ${name} from database?`)) return;
    try {
      await fetch(`${API_URL}/people/${name}`, { method: "DELETE" });
      fetchEnrolledPeople();
    } catch {
      alert("Failed to delete person.");
    }
  };

  useEffect(() => {
    if (!cameraActive || showRegisterModal) {
      return undefined;
    }

    let isCurrent = true;
    const recognizeFrame = async () => {
      if (recognitionInProgress.current) {
        return;
      }

      recognitionInProgress.current = true;
      try {
        const image = await captureFrame();
        if (!image) {
          return;
        }

        const response = await fetch(`${API_URL}/recognize`, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: image,
        });
        if (!response.ok) {
          throw new Error("Recognition request failed.");
        }

        const result = await response.json();
        if (!isCurrent || !result.success) {
          return;
        }

        setFaces(result.faces);
        setFrame(result.frame ?? DEFAULT_FRAME);
        setError("");
        if (result.faces.length === 0) {
          setStatus("Recognizing");
        } else if (result.faces.some((face) => face.recognized)) {
          const match = result.faces.find((face) => face.recognized);
          setStatus(`Recognized: ${match.name}`);
        } else {
          setStatus("Unknown Face");
        }
      } catch {
        if (isCurrent) {
          setError("Recognition API is unavailable. Start the backend and try again.");
          setStatus("Error");
        }
      } finally {
        recognitionInProgress.current = false;
      }
    };

    recognizeFrame();
    const intervalId = window.setInterval(recognizeFrame, RECOGNITION_INTERVAL_MS);
    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, [cameraActive, captureFrame]);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      const stream = video?.srcObject;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const bestScore = faces.length ? Math.max(...faces.map((face) => face.score)) : null;

  return (
    <div className="app">
      <nav className="navbar">
        <a href="#dashboard" className="logo">
          <span className="logo-mark">◉</span>
          FaceVision
        </a>

        <div className="nav-links">
          <a href="#dashboard">Dashboard</a>
          <a href="#enrolled">Enrolled Users ({enrolledPeople.length})</a>
          <a href="#system">Model Config</a>
          <a href="#about">About</a>
        </div>

        <div className="nav-right">
          <button
            className="register-nav-btn"
            onClick={openRegisterWizard}
          >
            ➕ Enroll Face
          </button>
          {cameraActive && (
            <div className="nav-status online">
              <span />
              System online
            </div>
          )}
        </div>
      </nav>

      <main>
        <section className="hero" id="dashboard">
          <div className="hero-content">
            <div className="status">
              <span className="status-dot" />
              REAL-TIME RECOGNITION
            </div>

            <h1>
              <span>Face Recognition</span>
            </h1>

            <p>
              A real-time computer-vision system that detects faces, generates
              embeddings, and identifies enrolled people through similarity matching.
            </p>

            <div className="hero-actions">
              <button
                className={`primary-button ${cameraActive ? "stop-button" : ""}`}
                onClick={cameraActive ? stopCamera : startCamera}
              >
                {cameraActive ? "Stop recognition" : "Start recognition"}
              </button>
              <button
                className="secondary-button"
                onClick={openRegisterWizard}
              >
                ➕ Register New Face
              </button>
            </div>

            {error && <p className="error-message">{error}</p>}
          </div>

          <div className="hero-visual">
            <div className="scan-card">
              <div className="scan-header">
                <span>LIVE CAMERA</span>
                <span className={cameraActive ? "live" : "offline"}>
                  ● {cameraActive ? "LIVE" : "OFFLINE"}
                </span>
              </div>

              <div className="camera-placeholder">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`camera-video ${cameraActive ? "visible" : ""}`}
                />

                {!cameraActive && (
                  <div className="camera-overlay">
                    <div className="face-frame">
                      <div className="corner top-left" />
                      <div className="corner top-right" />
                      <div className="corner bottom-left" />
                      <div className="corner bottom-right" />
                      <div className="face-icon">◯</div>
                    </div>
                    <div className="camera-text">CAMERA READY</div>
                  </div>
                )}

                {cameraActive &&
                  faces.map((face) => (
                    <div
                      className={`face-box ${face.recognized ? "" : "unknown"}`}
                      key={`${face.name}-${face.box.x1}-${face.box.y1}`}
                      style={{
                        left: `${(face.box.x1 / frame.width) * 100}%`,
                        top: `${(face.box.y1 / frame.height) * 100}%`,
                        width: `${((face.box.x2 - face.box.x1) / frame.width) * 100}%`,
                        height: `${((face.box.y2 - face.box.y1) / frame.height) * 100}%`,
                      }}
                    >
                      <span>{face.name}</span>
                    </div>
                  ))}
              </div>

              <div className="recognition-result">
                <div>
                  <span>STATUS</span>
                  <strong>{status}</strong>
                </div>
                <div className="score">
                  <span>BEST MATCH</span>
                  <strong>{bestScore !== null ? bestScore.toFixed(2) : "--"}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ENROLLED USERS SECTION */}
        <section className="enrolled-section" id="enrolled">
          <div className="enrolled-header">
            <div>
              <span className="section-tag">DATABASE</span>
              <h2>Enrolled People ({enrolledPeople.length})</h2>
            </div>
            <button
              className="primary-button"
              onClick={openRegisterWizard}
            >
              ➕ Enroll New Face
            </button>
          </div>

          <div className="people-grid">
            {enrolledPeople.length === 0 ? (
              <p className="empty-state">No faces enrolled yet. Click 'Enroll New Face' to register!</p>
            ) : (
              enrolledPeople.map((person) => (
                <div key={person} className="person-card">
                  <div className="person-avatar">👤</div>
                  <div className="person-info">
                    <h4>{person}</h4>
                    <span>Enrolled in Database</span>
                  </div>
                  <button
                    className="delete-btn"
                    title="Remove person"
                    onClick={() => handleDeletePerson(person)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* MODEL CONFIGURATION SECTION */}
        <section className="model-config-section" id="system">
          <div className="section-heading">
            <span>PARAMETERS & SPECS</span>
            <h2>Model Configuration</h2>
          </div>
          <div className="stats">
            <div className="stat"><span>MODEL</span><strong>Buffalo_L (ArcFace)</strong></div>
            <div className="stat"><span>EMBEDDING SIZE</span><strong>512-D Vector</strong></div>
            <div className="stat"><span>DISTANCE METRIC</span><strong>Cosine Similarity</strong></div>
            <div className="stat"><span>UNKNOWN THRESHOLD</span><strong>0.45</strong></div>
          </div>
        </section>

        <section className="features" id="about">
          <div className="section-heading">
            <span>THE PIPELINE</span>
            <h2>How the system works</h2>
          </div>

          <div className="feature-grid">
            <FeatureCard number="01" title="Face Detection">
              Detect faces from live camera frames with InsightFace.
            </FeatureCard>
            <FeatureCard number="02" title="Face Embeddings">
              Convert each detected face into a 512-dimensional representation.
            </FeatureCard>
            <FeatureCard number="03" title="Similarity Matching">
              Compare live embeddings to enrolled references using cosine similarity.
            </FeatureCard>
            <FeatureCard number="04" title="Unknown Rejection">
              Reject faces below the configured threshold instead of forcing a match.
            </FeatureCard>
          </div>
        </section>
      </main>

      {/* MANUAL GUIDED REGISTRATION MODAL */}
      {showRegisterModal && (
        <div className="modal-backdrop" onClick={() => !isSaving && closeRegisterWizard()}>
          <div className="modal-box modal-box-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3>Face Registration Wizard</h3>
                <span className="step-tag">
                  {registerStep === 0
                    ? "Step 1: Setup"
                    : registerStep <= 10
                    ? `Step ${registerStep}/10: Angle Capture`
                    : "Final Step: Review & Save"}
                </span>
              </div>
              <button
                className="close-modal"
                disabled={isSaving}
                onClick={closeRegisterWizard}
              >
                ✕
              </button>
            </div>

            {/* STAGE 0: NAME & INSTRUCTIONS */}
            {registerStep === 0 && (
              <form onSubmit={handleStartCaptureSession} className="modal-body">
                <div className="instruction-card">
                  <div className="instruction-icon">📋</div>
                  <div>
                    <h4>10-Angle Manual Capture Required</h4>
                    <p>
                      For robust biometric recognition across different lighting and poses, you will manually capture <strong>10 photos at different angles</strong> (straight, smile, left, right, up, down, etc.).
                    </p>
                  </div>
                </div>

                <div className="input-group">
                  <label>Person's Name</label>
                  <input
                    type="text"
                    placeholder="Enter full name (e.g. Rahul, John_Doe)"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    autoFocus
                  />
                </div>

                {registerStatus && (
                  <div className="register-status-box err">{registerStatus}</div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeRegisterWizard}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!registerName.trim()}
                  >
                    Start Guided Capture →
                  </button>
                </div>
              </form>
            )}

            {/* STAGE 1..10: MANUAL ANGLE CAPTURE */}
            {registerStep >= 1 && registerStep <= 10 && (
              <div className="modal-body">
                {/* Pose Guidance Banner */}
                {(() => {
                  const currentPose = POSE_INSTRUCTIONS[registerStep - 1];
                  return (
                    <div className="current-pose-card">
                      <div className="pose-icon">{currentPose.icon}</div>
                      <div className="pose-details">
                        <span className="pose-counter">Angle {registerStep} of 10</span>
                        <h4>{currentPose.title}</h4>
                        <p>{currentPose.desc}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Progress Bar & Dots */}
                <div className="capture-progress-container">
                  <div className="capture-progress-label">
                    <span>Enrolling: <strong>{registerName}</strong></span>
                    <strong>{capturedSamples.length} / 10 Captured</strong>
                  </div>
                  <div className="capture-progress-bar-bg">
                    <div
                      className="capture-progress-bar-fill"
                      style={{ width: `${(capturedSamples.length / 10) * 100}%` }}
                    />
                  </div>
                  <div className="capture-dots">
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <span
                        key={idx}
                        className={`dot ${idx < capturedSamples.length ? "filled" : ""}`}
                        title={`Angle ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Live Camera Feed inside Modal */}
                <div className="modal-camera-preview">
                  <video
                    ref={(el) => {
                      modalVideoRef.current = el;
                      if (el && streamRef.current && el.srcObject !== streamRef.current) {
                        el.srcObject = streamRef.current;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="camera-video visible"
                  />
                  <div className="modal-camera-overlay">
                    <div className="face-guide-oval" />
                    <span className="live-pill">● LIVE</span>
                  </div>
                </div>

                {registerStatus && (
                  <div className="register-status-box info">{registerStatus}</div>
                )}

                {/* Actions */}
                <div className="modal-actions-spaced">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleRetakeLast}
                    disabled={capturedSamples.length === 0}
                  >
                    ↺ Retake Last
                  </button>

                  <button
                    type="button"
                    className="primary-button capture-btn-large"
                    onClick={handleManualCapturePhoto}
                  >
                    📸 Take Photo {registerStep}/10
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 11: REVIEW & SAVE */}
            {registerStep === 11 && (
              <div className="modal-body">
                <div className="review-header">
                  <div className="review-icon">✅</div>
                  <div>
                    <h4>All 10 Angles Captured for {registerName}!</h4>
                    <p>Review your captured face samples below before saving into the database.</p>
                  </div>
                </div>

                {/* 10 Thumbnails Grid */}
                <div className="thumbnails-grid">
                  {capturedSamples.map((imgSrc, idx) => (
                    <div key={idx} className="thumb-card">
                      <img src={imgSrc} alt={`Sample ${idx + 1}`} />
                      <span>{POSE_INSTRUCTIONS[idx]?.title ?? `Sample ${idx + 1}`}</span>
                    </div>
                  ))}
                </div>

                {registerStatus && (
                  <div className={`register-status-box ${registerStatus.includes('❌') ? 'err' : registerStatus.includes('🎉') ? 'ok' : 'info'}`}>
                    {registerStatus}
                  </div>
                )}

                <div className="modal-actions-spaced">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isSaving}
                    onClick={() => {
                      setRegisterStep(1);
                      setCapturedSamples([]);
                      setRegisterStatus("");
                    }}
                  >
                    ↺ Restart
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={isSaving}
                    onClick={handleSaveEnrolledFace}
                  >
                    {isSaving ? "Saving 512-D Vectors..." : "💾 Save & Complete Enrollment"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer>
        <div>FaceVision</div>
        <div>Computer Vision Project</div>
      </footer>

      <canvas ref={canvasRef} hidden />
    </div>
  );
}

function FeatureCard({ children, number, title }) {
  return (
    <div className="feature-card">
      <div className="feature-number">{number}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export default App;
