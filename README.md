# EchoSensei — AI Healthcare Engine

 

EchoSensei is a powerful, cinematic clinical intelligence platform designed to assist healthcare professionals with multilingual voice processing, automated documentation, and grounded clinical reasoning.

 

![EchoSensei Banner](ui_design.jpg)

 

## 🚀 Key Features

 

- **Multilingual ASR (Speech-to-Text)**: High-accuracy transcription support for English, Hindi, Kannada, and Tamil. Leverages Groq-accelerated Whisper-V3 or local fallback models (IndicConformer/Whisper).

- **Clinical Intelligence (LLM)**: Automated extraction of symptoms, history, and medical context. Provides differential diagnoses and follow-up suggestions using Llama-3.1-8B.

- **RAG (Retrieval-Augmented Generation)**: Grounded AI responses powered by a local semantic search engine, ensuring answers are backed by relevant clinical data.

- **DocuFlow**: A specialized pipeline for automated clinical documentation. Transcribes full doctor-patient consultations, classifies speakers, and generates structured medical reports.

- **Session History & Analytics**: Full management of patient encounters with search, filtering, and longitudinal tracking.

- **Cinematic UI**: A premium, responsive web interface featuring EKG-style animations, dark mode aesthetics, and real-time reasoning timelines.

 

## 🛠️ Technology Stack

 

- **Backend**: Python 3.9+ (Flask, Flask-CORS)

- **AI/ML**:

  - **Transcription**: Groq Cloud (Whisper-large-v3-turbo), AI4Bharat IndicConformer, OpenAI Whisper (local).

  - **Reasoning**: Groq Cloud (Llama-3.1-8B-Instant).

  - **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (for RAG).

- **Frontend**: Vanilla HTML5/CSS3/JavaScript (No heavy frameworks, maximum performance).

- **Media**: Integrated `ffmpeg` for high-performance audio processing.

 

## 📦 Installation & Setup

 

### Prerequisites

- **Python 3.9 or higher**

- A **Groq API Key** (for high-speed AI processing).

 

### Configuration

Set your Groq API key in your environment or directly in the launcher:

```powershell

$env:GROQ_API_KEY="your_groq_api_key_here"

```

 

### Quick Start

Simply run the included batch file to verify dependencies and start the engine:

```bash

./run.bat

```

Alternatively, start the server manually:

```bash

pip install -r requirements.txt

python server.py

```

The application will be available at [http://localhost:5000](http://localhost:5000).

 

## 📂 Project Structure

 

- `server.py`: Main Flask backend handling API routing and orchestration.

- `app.js`: Core frontend logic for audio recording, UI state, and API communication.

- `index.html`: The cinematic main interface.

- `models/`: AI model wrappers for ASR, LLM, and Report Generation.

- `core/`: Core business logic including RAG engine, memory management, and data persistence.

- `data/`: Local storage for sessions (JSON) and generated reports.

- `ffmpeg.exe`: Bundled binary for audio format conversion.

 

## 🛡️ License

Proprietary / Internal Use Only.

Developed by EchoSensei Clinical AI Team