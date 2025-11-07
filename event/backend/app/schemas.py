from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_admin: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

# ADD THIS MISSING CLASS
class TokenData(BaseModel):
    email: Optional[str] = None
    is_admin: bool = False

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    date: datetime
    location: Optional[str] = None
    max_attendees: Optional[int] = None

class EventCreate(EventBase):
    pass

class Event(EventBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class RegistrationBase(BaseModel):
    event_id: int

class RegistrationCreate(RegistrationBase):
    pass

class Registration(RegistrationBase):
    id: int
    user_id: int
    registration_date: datetime
    qr_code_data: str
    is_verified: bool
    verification_date: Optional[datetime]
    
    class Config:
        from_attributes = True

class RegistrationWithDetails(Registration):
    user: User
    event: Event

class QRVerification(BaseModel):
    qr_code_data: str