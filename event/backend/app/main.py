from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import os
from pathlib import Path

import models, schemas, crud, auth, email
from database import SessionLocal, engine, get_db
from config import settings

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Event Registration API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create initial admin user
def create_initial_data():
    db = SessionLocal()
    try:
        # Check if admin exists
        admin = crud.get_user_by_email(db, "admin@example.com")
        if not admin:
            # Create admin user
            from .auth import get_password_hash
            db_admin = models.User(
                email="admin@example.com",
                full_name="System Administrator", 
                hashed_password=get_password_hash("admin123"),
                is_admin=True
            )
            db.add(db_admin)
            
            # Create sample event
            from datetime import datetime, timedelta
            sample_event = models.Event(
                title="Tech Conference 2024",
                description="Annual technology conference featuring latest innovations",
                date=datetime.now() + timedelta(days=30),
                location="Convention Center",
                max_attendees=100
            )
            db.add(sample_event)
            
            db.commit()
            print("✅ Initial data created: admin@example.com / admin123")
    except Exception as e:
        print(f"⚠️ Error creating initial data: {e}")
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    create_initial_data()

# Serve HTML pages
@app.get("/", response_class=HTMLResponse)
async def read_root():
    try:
        return FileResponse("../frontend/index.html")
    except Exception as e:
        return HTMLResponse(f"<h1>Error loading page</h1><p>{str(e)}</p>")

@app.get("/admin", response_class=HTMLResponse)
async def read_admin():
    try:
        return FileResponse("../frontend/admin.html")
    except Exception as e:
        return HTMLResponse(f"<h1>Error loading admin page</h1><p>{str(e)}</p>")

@app.get("/events-page", response_class=HTMLResponse)
async def read_events_page():
    try:
        return FileResponse("../frontend/events.html")
    except Exception as e:
        return HTMLResponse(f"<h1>Error loading events page</h1><p>{str(e)}</p>")

# Authentication routes
@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "is_admin": user.is_admin}, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

# Event routes
@app.get("/events", response_model=list[schemas.Event])
def read_events(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    events = crud.get_events(db, skip=skip, limit=limit)
    return events

@app.post("/events", response_model=schemas.Event)
def create_event(
    event: schemas.EventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    return crud.create_event(db=db, event=event)

# Registration routes
@app.post("/registrations", response_model=schemas.Registration)
async def register_for_event(
    registration: schemas.RegistrationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_registration = crud.create_registration(db=db, registration=registration, user_id=current_user.id)
    if not db_registration:
        raise HTTPException(status_code=400, detail="Already registered for this event")
    
    # Get event details
    event = crud.get_event(db, registration.event_id)
    if event:
        # Send email with QR code in background
        background_tasks.add_task(
            email.send_registration_email,
            current_user.email,
            current_user.full_name,
            event.title,
            db_registration.qr_code_image
        )
    
    return db_registration

@app.get("/my-registrations", response_model=list[schemas.RegistrationWithDetails])
def get_my_registrations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    registrations = crud.get_user_registrations(db, current_user.id)
    return registrations

# Admin routes for QR verification
@app.post("/admin/verify-qr")
def verify_qr_code(
    qr_data: schemas.QRVerification,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    registration = crud.verify_registration(db, qr_data.qr_code_data)
    if not registration:
        raise HTTPException(status_code=404, detail="Invalid QR code or already verified")
    
    return {
        "message": "Registration verified successfully",
        "user_name": registration.user.full_name,
        "event_title": registration.event.title,
        "verified_at": registration.verification_date
    }

@app.get("/admin/registrations", response_model=list[schemas.RegistrationWithDetails])
def get_all_registrations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    registrations = crud.get_all_registrations(db)
    return registrations

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "Server is running"}

# Debug endpoint
@app.get("/debug/db")
def debug_db(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    events = db.query(models.Event).all()
    registrations = db.query(models.Registration).all()
    
    return {
        "users_count": len(users),
        "events_count": len(events),
        "registrations_count": len(registrations),
        "users": [{"id": u.id, "email": u.email, "is_admin": u.is_admin} for u in users],
        "events": [{"id": e.id, "title": e.title} for e in events],
        "registrations": [{"id": r.id, "user_id": r.user_id, "event_id": r.event_id} for r in registrations]
    }