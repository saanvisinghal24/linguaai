# LinguaAI 🌍
### AI-Powered Multilingual Language Learning Platform

[![Status](https://img.shields.io/badge/Status-In%20Development-yellow)](https://github.com/saanvisinghal24/linguaai)
[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-MIT-purple)](LICENSE)

> An intelligent language learning platform that prepares learners for international certification exams using AI-driven speaking, writing, and grammar practice.

---

## 📌 Table of Contents
- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Supported Certifications](#supported-certifications)
- [Status](#status)
- [Author](#author)

---

## 🧠 About

LinguaAI is a full-stack AI-powered language learning platform built as a Pre-Final Year B.Tech (CSE) project. It combines modern NLP tools — including Anthropic Claude, OpenAI Whisper, and ElevenLabs — to simulate real exam environments for learners targeting international certifications like Goethe-Zertifikat, DELF, JLPT, and HSK.

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| 🎙️ **AI Speaking Partner** | Real-time conversation practice using Whisper (STT) + Claude (AI) + ElevenLabs (TTS) |
| ✍️ **Writing Evaluator** | Instant feedback using official exam rubrics (grammar, coherence, vocabulary) |
| 📝 **Grammar Checker** | Contextual grammar correction with rule-based explanations |
| 🧠 **Smart Flashcards** | Spaced repetition using the SM-2 algorithm for long-term retention |
| 📊 **Personalized Study Plans** | AI-generated learning paths based on user progress and exam target |
| 🌐 **Multi-language Support** | German, French, Japanese, Chinese, and more |

---

## 🛠️ Tech Stack

### Backend
- **Python** + **FastAPI** — REST API
- **PostgreSQL** — Database
- **Anthropic Claude** — AI responses and writing evaluation
- **OpenAI Whisper** — Speech-to-text
- **ElevenLabs** — Text-to-speech

### Frontend
- **React 18** — UI framework
- **Tailwind CSS** — Styling
- **Axios** — API communication

---

## 📁 Project Structure

```
linguaai/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── routers/             # API route handlers
│   ├── models/              # Database models
│   ├── services/            # AI service integrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page-level components
│   │   └── services/        # API calls
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL
- API keys: Anthropic, OpenAI, ElevenLabs

### Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Add your API keys to .env

# Run server
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

The app will be available at `http://localhost:3000`

---

## 🎓 Supported Certifications

| Language | Exam |
|----------|------|
| 🇩🇪 German | Goethe-Zertifikat (A1–C2) |
| 🇫🇷 French | DELF / DALF |
| 🇯🇵 Japanese | JLPT (N1–N5) |
| 🇨🇳 Chinese | HSK (1–6) |

---

## 📈 Status

🚧 **In active development** — Pre-Final Year B.Tech CSE Project  
📅 Expected completion: May 2027

### Roadmap
- [x] Project setup (FastAPI + React + PostgreSQL)
- [x] AI Speaking Partner integration
- [x] Writing Evaluator
- [ ] Flashcard system with SM-2
- [ ] User dashboard & analytics
- [ ] Mobile responsive UI
- [ ] Deployment

---

## 👩‍💻 Author

**Saanvi Singhal**  
Pre-Final Year B.Tech CSE — Atal Bihari Vajpayee Government Institute of Engineering and Technology, Kotkhai, HP  
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue)](https://linkedin.com/in/saanvisinghal24)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-black)](https://github.com/saanvisinghal24)

---

> ⭐ If you find this project interesting, consider starring the repo!

