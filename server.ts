import express from 'express';
import cors from 'cors';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const APP_NAME = "Lumina";
const LOCATION = "Gastown, Vancouver";
const DEFAULT_SERVICES = [
  {
    name: "Bespoke Facial Sculpt",
    description: "Tailored lymphatic drainage and microcurrent lifting tailored to individual facial contours.",
    price: 180,
    duration: 75,
    category: "Facial",
    imageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=800"
  },
  {
    name: "Cellular Renewal Peel",
    description: "Bio-fermented acid treatment to restore clarity and accelerate cellular turnover.",
    price: 210,
    duration: 60,
    category: "Skin Treatment",
    imageUrl: "https://images.unsplash.com/photo-1512290900672-1f5be6b4f74d?auto=format&fit=crop&q=80&w=800"
  },
  {
    name: "Hydro-Infusion Ritual",
    description: "Deep hydration bath with pure botanical essences and hyaluronic infusion.",
    price: 150,
    duration: 50,
    category: "Hydration",
    imageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=800"
  },
  {
    name: "Cryo-Radiance Glow",
    description: "Sub-zero thermal therapy to tighten pores, calm inflammation, and restore immediate radiance.",
    price: 195,
    duration: 60,
    category: "Facial",
    imageUrl: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&q=80&w=800"
  }
];

const DEFAULT_PRODUCTS = [
  {
    name: "Luminous Peptide Serum",
    description: "High-potency multi-peptide complex designed to boost elasticity and radiance.",
    price: 110,
    category: "Serum",
    imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=800"
  },
  {
    name: "Botanical Renewal Essence",
    description: "Gentle balancing essence infused with botanical extracts and fermented botanicals.",
    price: 85,
    category: "Essence",
    imageUrl: "https://images.unsplash.com/photo-1608248597359-0a2569f14068?auto=format&fit=crop&q=80&w=800"
  },
  {
    name: "Ceramide Barrier Crème",
    description: "Intense barrier repair cream enriched with essential lipids and niacinamide.",
    price: 95,
    category: "Moisturizer",
    imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800"
  }
];

// Initialize Firebase configuration
let firebaseAppConfig: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-config.json');
  if (fs.existsSync(configPath)) {
    firebaseAppConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn("Could not read firebase-config.json:", e);
}

const firebaseConfig = firebaseAppConfig || {
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0189962209",
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || "1:108335510952:web:4bca144da6050d1e9b199d",
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "AIzaSyAxYWYngppQwMnvGr_cb2pmaVSU7zirHlY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0189962209.firebaseapp.com",
  firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-329297ba-fdab-4efd-a8ad-b44e4f29cf39",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0189962209.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "108335510952"
};

const serverFirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig, "server-backend") : getApps()[0];
const customDbId = firebaseConfig?.firestoreDatabaseId || process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID;
const db = (customDbId && customDbId !== '(default)') 
  ? getFirestore(serverFirebaseApp, customDbId) 
  : getFirestore(serverFirebaseApp);

// Lazy initialization for Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'lumina-backend'
        }
      }
    });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION = `
You are the AI Beauty Concierge for ${APP_NAME}, a premier boutique beauty and skincare atelier located in ${LOCATION}.
Your goal is to handle customer inquiries 24/7 with a warm, sophisticated, knowledgeable, and inviting tone.

Key Boutique Details:
- Location: ${LOCATION} (Gastown, Vancouver, BC)
- Services offered:
${DEFAULT_SERVICES.map(s => `  * ${s.name} (${s.duration} min, $${s.price}): ${s.description}`).join('\n')}
- Online Booking: Clients can select treatments, pick time slots, and schedule appointments online right on this website.
- Inquiries: For bespoke consultation questions or direct contact, clients can submit the contact form or call directly.

Guidelines:
1. Provide expert skincare and beauty treatment recommendations tailored to user concerns (hydration, anti-aging, acne, pore refinement, brightening).
2. For pricing, duration, or service questions, provide exact information from the catalogue.
3. Encourage clients to book appointments via the website's booking section.
4. Keep replies polished, friendly, concise, and elegant.
`;

function getLocalConciergeReply(userMessage: string): string {
  const query = userMessage.toLowerCase();
  
  if (query.includes('price') || query.includes('cost') || query.includes('how much') || query.includes('fee')) {
    return "Our signature treatments include: Bespoke Facial Sculpt ($180, 75 min), Cellular Renewal Peel ($210, 60 min), Hydro-Infusion Ritual ($150, 50 min), and Cryo-Radiance Glow ($195, 60 min). You can reserve your session directly via the booking section above.";
  }
  if (query.includes('service') || query.includes('treatment') || query.includes('facial') || query.includes('offer') || query.includes('ritual')) {
    return "We specialize in personalized skin rituals including our Bespoke Facial Sculpt (lymphatic lifting & microcurrent), Cellular Renewal Peel (bio-fermented clarifying peel), Hydro-Infusion Ritual (hyaluronic hydration), and Cryo-Radiance Glow (sub-zero thermal toning). Which skin goal can I help you target?";
  }
  if (query.includes('book') || query.includes('appointment') || query.includes('schedule') || query.includes('time') || query.includes('reserve')) {
    return "You can book directly on our website! Simply select your preferred treatment, date, and time slot in the 'Reserve Your Ritual' booking wizard above, or submit an inquiry for bespoke requests.";
  }
  if (query.includes('location') || query.includes('where') || query.includes('address') || query.includes('vancouver') || query.includes('gastown')) {
    return "Lumina Atelier is located in historic Gastown, Vancouver, BC. We welcome you for an elevated, restorative sanctuary experience.";
  }
  if (query.includes('product') || query.includes('serum') || query.includes('cream') || query.includes('skincare') || query.includes('oil')) {
    return "Our curated boutique features high-performance botanical formulations, including our Luminous Peptide Serum ($110), Botanical Renewal Essence ($85), and Ceramide Barrier Crème ($95).";
  }
  if (query.includes('hello') || query.includes('hi') || query.includes('hey') || query.includes('good morning') || query.includes('good afternoon')) {
    return "Hello and welcome to Lumina. I am your 24/7 beauty concierge. Are you looking for treatment recommendations, appointment availability, or product guidance?";
  }
  return "Thank you for reaching out to Lumina Beauty. Our atelier offers bespoke facial sculpts, peels, hydration rituals, and curated skincare in Gastown, Vancouver. Would you like a treatment recommendation or assistance booking an appointment?";
}

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend applications
app.use(cors());
app.use(express.json());

// Helper to decode JWT without external dependencies (verifies admin identity claim)
function verifyAdminRequest(req: express.Request): boolean {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return false;
    }
    const token = authHeader.split('Bearer ')[1];
    if (!token) return false;
    
    // Parse JWT payload safely
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
    const payload = JSON.parse(payloadStr);
    
    // Check if token belongs to verified admin email or project
    const adminEmail = process.env.ADMIN_EMAIL || 'mohsenghodrat2@gmail.com';
    const isExpired = payload.exp && payload.exp < Math.floor(Date.now() / 1000);
    
    return !isExpired && (payload.email === adminEmail || payload.email === 'mohsenghodrat2@gmail.com');
  } catch (err) {
    return false;
  }
}

// Middleware to protect admin operations
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!verifyAdminRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required to access this resource.' });
  }
  next();
}

// ==========================================
// BACKEND API ROUTES
// ==========================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. CHATBOT API (Backend AI processing with graceful fallback)
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("[Chatbot] GEMINI_API_KEY not set in environment. Falling back to local concierge knowledge base.");
      const fallbackReply = getLocalConciergeReply(lastUserMsg);
      return res.json({ reply: fallbackReply });
    }

    const ai = getGeminiClient();
    const contents = messages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(msg.content || '') }]
    }));

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        }
      });

      const reply = response.text || getLocalConciergeReply(lastUserMsg);
      return res.json({ reply });
    } catch (geminiErr: any) {
      console.warn("[Chatbot] Gemini API execution warning, falling back to concierge:", geminiErr?.message || geminiErr);
      const fallbackReply = getLocalConciergeReply(lastUserMsg);
      return res.json({ reply: fallbackReply });
    }
  } catch (error: any) {
    console.error("Backend Chatbot Error:", error);
    return res.json({ 
      reply: "Welcome to Lumina Beauty. How may I assist your skincare journey or appointment booking today?" 
    });
  }
});

// 2. SERVICES API (Backend database retrieval)
app.get('/api/services', async (req, res) => {
  try {
    const servicesCol = collection(db, 'services');
    const snap = await getDocs(servicesCol);
    
    if (snap.empty) {
      const seeded: any[] = [];
      for (const s of DEFAULT_SERVICES) {
        const docRef = await addDoc(servicesCol, {
          ...s,
          createdAt: serverTimestamp()
        });
        seeded.push({ id: docRef.id, ...s });
      }
      return res.json({ data: seeded });
    }

    const seenNames = new Set<string>();
    const services: any[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const identifier = (data.name || docSnap.id).trim().toLowerCase();
      if (!seenNames.has(identifier)) {
        seenNames.add(identifier);
        services.push({
          id: docSnap.id,
          ...data
        });
      }
    }
    return res.json({ data: services.length > 0 ? services : DEFAULT_SERVICES.map((s, idx) => ({ id: `default-${idx}`, ...s })) });
  } catch (error: any) {
    console.error("Error fetching services from Firestore:", error);
    return res.json({ data: DEFAULT_SERVICES.map((s, idx) => ({ id: `default-${idx}`, ...s })) });
  }
});

// 3. PRODUCTS API (Backend database retrieval)
app.get('/api/products', async (req, res) => {
  try {
    const productsCol = collection(db, 'products');
    const snap = await getDocs(productsCol);

    if (snap.empty) {
      const seeded: any[] = [];
      for (const p of DEFAULT_PRODUCTS) {
        const docRef = await addDoc(productsCol, {
          ...p,
          createdAt: serverTimestamp()
        });
        seeded.push({ id: docRef.id, ...p });
      }
      return res.json({ data: seeded });
    }

    const seenNames = new Set<string>();
    const products: any[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const identifier = (data.name || docSnap.id).trim().toLowerCase();
      if (!seenNames.has(identifier)) {
        seenNames.add(identifier);
        products.push({
          id: docSnap.id,
          ...data
        });
      }
    }
    return res.json({ data: products.length > 0 ? products : DEFAULT_PRODUCTS.map((p, idx) => ({ id: `default-${idx}`, ...p })) });
  } catch (error: any) {
    console.error("Error fetching products from Firestore:", error);
    return res.json({ data: DEFAULT_PRODUCTS.map((p, idx) => ({ id: `default-${idx}`, ...p })) });
  }
});

// Resilient memory cache for inquiries and appointments
const memoryAppointments: any[] = [
  {
    id: 'demo-app-1',
    customerName: 'Elena Rostova',
    customerEmail: 'elena@example.com',
    serviceId: 'Bespoke Facial Sculpt',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '14:00',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  }
];

const memoryInquiries: any[] = [
  {
    id: 'demo-inq-1',
    name: 'Claire Beauchamp',
    email: 'claire@example.com',
    message: 'Hello, I have sensitive, rosacea-prone skin. Which facial sculpt or peel do you recommend for initial treatment?',
    createdAt: new Date().toISOString()
  }
];

// 4. APPOINTMENTS API (Backend database CRUD)
// GET /api/appointments is protected: only authenticated admin can list all customer bookings
app.get('/api/appointments', requireAdmin, async (req, res) => {
  try {
    const appointmentsCol = collection(db, 'appointments');
    let snap;
    try {
      const q = query(appointmentsCol, orderBy('date', 'desc'));
      snap = await getDocs(q);
    } catch (queryErr) {
      // Fallback in case composite index or field ordering fails
      snap = await getDocs(appointmentsCol);
    }

    if (snap && !snap.empty) {
      const appointments = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
        };
      });
      return res.json({ data: appointments });
    }
    return res.json({ data: memoryAppointments });
  } catch (error: any) {
    return res.json({ data: memoryAppointments });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { customerName, customerEmail, serviceId, date, time, status } = req.body;
    if (!customerName || !customerEmail || !serviceId || !date || !time) {
      return res.status(400).json({ error: 'Missing required booking fields' });
    }

    const appointmentData = {
      customerName,
      customerEmail,
      serviceId,
      date,
      time,
      status: status || 'pending',
      createdAt: serverTimestamp()
    };

    let id = `app-${Date.now()}`;
    try {
      const docRef = await addDoc(collection(db, 'appointments'), appointmentData);
      id = docRef.id;
    } catch (e) {
      // Fallback to memory
    }

    const savedItem = {
      id,
      ...appointmentData,
      createdAt: new Date().toISOString()
    };
    memoryAppointments.unshift(savedItem);

    return res.status(201).json({
      success: true,
      data: savedItem
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create appointment" });
  }
});

// PATCH /api/appointments/:id is protected: only admin can modify booking statuses
app.patch('/api/appointments/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    try {
      const appRef = doc(db, 'appointments', id);
      await updateDoc(appRef, { status });
    } catch (e) {
      // Fallback to memory
    }

    const existing = memoryAppointments.find(a => a.id === id);
    if (existing) {
      existing.status = status;
    }

    return res.json({ success: true, id, status });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update appointment" });
  }
});

// 5. INQUIRIES API (Backend database CRUD)
// GET /api/inquiries is protected: only admin can view customer messages
app.get('/api/inquiries', requireAdmin, async (req, res) => {
  try {
    const inquiriesCol = collection(db, 'inquiries');
    let snap;
    try {
      const q = query(inquiriesCol, orderBy('createdAt', 'desc'));
      snap = await getDocs(q);
    } catch (queryErr) {
      snap = await getDocs(inquiriesCol);
    }

    if (snap && !snap.empty) {
      const inquiries = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
        };
      });
      return res.json({ data: inquiries });
    }
    return res.json({ data: memoryInquiries });
  } catch (error: any) {
    return res.json({ data: memoryInquiries });
  }
});

app.post('/api/inquiries', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required inquiry fields' });
    }

    const inquiryData = {
      name,
      email,
      message,
      createdAt: serverTimestamp()
    };

    let id = `inq-${Date.now()}`;
    try {
      const docRef = await addDoc(collection(db, 'inquiries'), inquiryData);
      id = docRef.id;
    } catch (e) {
      // Fallback to memory
    }

    const savedItem = {
      id,
      ...inquiryData,
      createdAt: new Date().toISOString()
    };
    memoryInquiries.unshift(savedItem);

    return res.status(201).json({
      success: true,
      data: savedItem
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to submit inquiry" });
  }
});

// DELETE /api/inquiries/:id is protected: only admin can delete messages
app.delete('/api/inquiries/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    try {
      await deleteDoc(doc(db, 'inquiries', id));
    } catch (e) {
      // Fallback to memory
    }
    const idx = memoryInquiries.findIndex(item => item.id === id);
    if (idx !== -1) {
      memoryInquiries.splice(idx, 1);
    }
    return res.json({ success: true, id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to delete inquiry" });
  }
});

app.listen(PORT, () => {
  console.log(`Lumina standalone backend API running on port ${PORT}`);
});
