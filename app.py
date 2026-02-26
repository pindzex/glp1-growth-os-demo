"""
GLP-1 Growth OS - Interactive Sales Demo
FastAPI backend for the live demo experience
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import json
import asyncio
import random
import uuid

app = FastAPI(title="GLP-1 Growth OS Demo")

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Fix for Render/static file path
import os
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# ============== DATA MODELS ==============

class Patient(BaseModel):
    id: str
    name: str
    phone: str
    stage: str  # lead, booked, showed, retained, upsold, lost
    lead_time: datetime
    response_time: Optional[datetime] = None
    booking_time: Optional[datetime] = None
    appointment_time: Optional[datetime] = None
    check_ins: List[Dict] = []
    revenue: float = 0
    mode: str  # "old" or "new"
    messages: List[Dict] = []

class DemoState:
    def __init__(self):
        self.patients: Dict[str, Patient] = {}
        self.metrics = {
            "total_leads": 0,
            "booked": 0,
            "showed": 0,
            "retained": 0,
            "upsold": 0,
            "lost": 0,
            "revenue_captured": 0,
            "revenue_lost": 0,
            "avg_response_time_old": 0,
            "avg_response_time_new": 0,
        }
        self.connections: List[WebSocket] = []
        
    def reset(self):
        self.patients = {}
        self.metrics = {
            "total_leads": 0,
            "booked": 0,
            "showed": 0,
            "retained": 0,
            "upsold": 0,
            "lost": 0,
            "revenue_captured": 0,
            "revenue_lost": 0,
            "avg_response_time_old": 0,
            "avg_response_time_new": 0,
        }

demo_state = DemoState()

# ============== MOCK DATA ==============

FIRST_NAMES = ["Sarah", "Jennifer", "Maria", "Lisa", "Amanda", "Jessica", "Michelle", "Emily"]
LAST_NAMES = ["M", "K", "R", "S", "J", "T", "P", "L"]

# ============== WEBSOCKET CONNECTIONS ==============

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# ============== AGENT SIMULATION ==============

class MockLeadAgent:
    """Simulates lead generation"""
    @staticmethod
    def generate_lead() -> Patient:
        patient_id = str(uuid.uuid4())[:8]
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}."
        return Patient(
            id=patient_id,
            name=name,
            phone=f"(555) {random.randint(100, 999)}-{random.randint(1000, 9999)}",
            stage="lead",
            lead_time=datetime.now(),
            mode="new",
            messages=[]
        )

class MockAIAgent:
    """Simulates the GLP-1 Growth OS AI responses"""
    
    CONVERSATION_FLOWS = {
        "new": [
            {"delay": 2, "sender": "ai", "text": "Hi! This is Dr. Martinez's clinic. I see you're interested in our GLP-1 program. I can help you right now! 💪"},
            {"delay": 3, "sender": "patient", "text": "Yes! How much does it cost?"},
            {"delay": 2, "sender": "ai", "text": "Our comprehensive program is $497/month including medication, coaching, and 24/7 support. When would you like to start? 🗓️"},
            {"delay": 4, "sender": "patient", "text": "Can I book for this week?"},
            {"delay": 2, "sender": "ai", "text": "Absolutely! I have Thursday at 2pm or Friday at 10am available. Which works better?"},
            {"delay": 3, "sender": "patient", "text": "Friday 10am please"},
            {"delay": 2, "sender": "ai", "text": "Perfect! You're booked for Friday at 10am. I'll send you a confirmation and pre-visit guide. See you then! ✅"},
        ],
        "old": [
            {"delay": 1, "sender": "patient", "text": "Hi, I want to book an appointment"},
            {"delay": 86400, "sender": "clinic", "text": "Hi! This is the clinic. We got your message. Please call us during business hours (9-5) to schedule. ☎️"},
            {"delay": 2, "sender": "patient", "text": "I called but got voicemail..."},
            {"delay": 172800, "sender": "clinic", "text": "Sorry we missed you! Call again tomorrow between 9-5. 📞"},
            {"delay": 1, "sender": "system", "text": "❌ PATIENT BOOKED WITH COMPETITOR"},
        ]
    }
    
    RETENTION_FLOWS = [
        {"day": 7, "text": "Hey! How are you feeling after your first week? Any questions about your medication? 💬"},
        {"day": 14, "text": "You're doing great! 2 weeks down. How's your energy level? 🌟"},
        {"day": 21, "text": "Checking in! Any side effects I should know about? I'm here to help. 🩺"},
        {"day": 28, "text": "Month 1 complete! 🎉 Ready to refill? I can schedule your Month 2 check-in."},
        {"day": 35, "text": "You're in Month 2 now! Have you thought about adding our peptide optimization program?"},
    ]

async def simulate_conversation(patient: Patient, websocket: WebSocket):
    """Simulate the SMS conversation in real-time"""
    flow = MockAIAgent.CONVERSATION_FLOWS[patient.mode]
    
    for msg in flow:
        await asyncio.sleep(msg["delay"] if patient.mode == "new" else min(msg["delay"], 3))
        
        message_data = {
            "type": "message",
            "patient_id": patient.id,
            "sender": msg["sender"],
            "text": msg["text"],
            "timestamp": datetime.now().isoformat()
        }
        
        patient.messages.append(message_data)
        await manager.broadcast(message_data)
        
        # Update patient stage based on conversation
        if patient.mode == "new":
            if "booked" in msg["text"].lower():
                patient.stage = "booked"
                patient.booking_time = datetime.now()
                patient.revenue = 2800  # Initial patient value
                demo_state.metrics["booked"] += 1
                demo_state.metrics["revenue_captured"] += patient.revenue
                await manager.broadcast({
                    "type": "stage_change",
                    "patient_id": patient.id,
                    "stage": "booked",
                    "metrics": demo_state.metrics
                })
        else:
            if "COMPETITOR" in msg["text"]:
                patient.stage = "lost"
                patient.revenue = 0
                demo_state.metrics["lost"] += 1
                demo_state.metrics["revenue_lost"] += 2800
                await manager.broadcast({
                    "type": "stage_change",
                    "patient_id": patient.id,
                    "stage": "lost",
                    "metrics": demo_state.metrics
                })

# ============== ROUTES ==============

@app.get("/", response_class=HTMLResponse)
async def get_demo():
    with open("static/demo.html", "r") as f:
        return f.read()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "reset":
                demo_state.reset()
                await manager.broadcast({"type": "reset", "metrics": demo_state.metrics})
                
            elif action == "simulate_lead":
                mode = data.get("mode", "new")
                patient = MockLeadAgent.generate_lead()
                patient.mode = mode
                demo_state.patients[patient.id] = patient
                demo_state.metrics["total_leads"] += 1
                
                await manager.broadcast({
                    "type": "new_lead",
                    "patient": patient.dict(),
                    "metrics": demo_state.metrics
                })
                
                # Start conversation simulation
                asyncio.create_task(simulate_conversation(patient, websocket))
                
            elif action == "simulate_retention":
                patient_id = data.get("patient_id")
                if patient_id in demo_state.patients:
                    patient = demo_state.patients[patient_id]
                    # Simulate retention check-ins
                    for checkin in MockAIAgent.RETENTION_FLOWS:
                        await asyncio.sleep(2)
                        checkin_data = {
                            "day": checkin["day"],
                            "text": checkin["text"],
                            "patient_id": patient_id
                        }
                        patient.check_ins.append(checkin_data)
                        
                        # Update stage
                        if checkin["day"] == 28:
                            patient.stage = "retained"
                            demo_state.metrics["retained"] += 1
                            await manager.broadcast({
                                "type": "stage_change",
                                "patient_id": patient.id,
                                "stage": "retained",
                                "metrics": demo_state.metrics
                            })
                        elif checkin["day"] == 35:
                            patient.stage = "upsold"
                            patient.revenue += 1500  # Upsell value
                            demo_state.metrics["upsold"] += 1
                            demo_state.metrics["revenue_captured"] += 1500
                            await manager.broadcast({
                                "type": "stage_change",
                                "patient_id": patient.id,
                                "stage": "upsold",
                                "metrics": demo_state.metrics
                            })
                        
                        await manager.broadcast({
                            "type": "checkin",
                            "data": checkin_data,
                            "metrics": demo_state.metrics
                        })
                        
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
