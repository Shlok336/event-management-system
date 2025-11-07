from sqlalchemy.orm import Session
import models, schemas, auth, qr_code

# User operations
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Event operations
def get_events(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Event).offset(skip).limit(limit).all()

def get_event(db: Session, event_id: int):
    return db.query(models.Event).filter(models.Event.id == event_id).first()

def create_event(db: Session, event: schemas.EventCreate):
    db_event = models.Event(**event.dict())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

# Registration operations
def get_registration_by_qr(db: Session, qr_data: str):
    return db.query(models.Registration).filter(models.Registration.qr_code_data == qr_data).first()

def get_user_registrations(db: Session, user_id: int):
    return db.query(models.Registration).filter(models.Registration.user_id == user_id).all()

def get_all_registrations(db: Session):
    return db.query(models.Registration).all()

def create_registration(db: Session, registration: schemas.RegistrationCreate, user_id: int):
    # Check if user already registered
    existing = db.query(models.Registration).filter(
        models.Registration.user_id == user_id,
        models.Registration.event_id == registration.event_id
    ).first()
    if existing:
        return None  # Already registered
    
    # Generate QR code data and image
    qr_data = qr_code.generate_unique_qr_data(user_id, registration.event_id)
    qr_image = qr_code.generate_qr_code(qr_data)
    
    db_registration = models.Registration(
        user_id=user_id,
        event_id=registration.event_id,
        qr_code_data=qr_data,
        qr_code_image=qr_image
    )
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)
    return db_registration

def verify_registration(db: Session, qr_data: str):
    registration = get_registration_by_qr(db, qr_data)
    if registration and not registration.is_verified:
        registration.is_verified = True
        from datetime import datetime
        registration.verification_date = datetime.utcnow()
        db.commit()
        db.refresh(registration)
        return registration
    return None