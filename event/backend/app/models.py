from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    registrations = relationship("Registration", back_populates="user")

class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    date = Column(DateTime, nullable=False)
    location = Column(String(255))
    max_attendees = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    registrations = relationship("Registration", back_populates="event")

class Registration(Base):
    __tablename__ = "registrations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    registration_date = Column(DateTime(timezone=True), server_default=func.now())
    qr_code_data = Column(Text, unique=True, index=True)
    qr_code_image = Column(Text)  # Base64 encoded QR code
    is_verified = Column(Boolean, default=False)
    verification_date = Column(DateTime(timezone=True))
    
    user = relationship("User", back_populates="registrations")
    event = relationship("Event", back_populates="registrations")