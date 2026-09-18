# Lumina Skincare Boutique - Backend API

This repository contains the Node.js Express REST API, Firebase Firestore database integration, and Gemini AI Chatbot backend services.

## API Endpoints

- `GET /api/health`: Health status
- `POST /api/chat`: Gemini AI 24/7 Beauty Concierge (body: `{ messages: [...] }`)
- `GET /api/services`: Live treatments and ritual services catalogue
- `GET /api/products`: Skincare and boutique products
- `GET /api/appointments`: List appointments
- `POST /api/appointments`: Book ritual appointment
- `PATCH /api/appointments/:id`: Update status (`pending`, `confirmed`, `cancelled`)
- `GET /api/inquiries`: Client contact messages
- `POST /api/inquiries`: Submit inquiry form
- `DELETE /api/inquiries/:id`: Remove inquiry

## Setup and Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```

3. Start development server:
```bash
npm run dev
```

4. Build and start production bundle:
```bash
npm run build
npm start
```
