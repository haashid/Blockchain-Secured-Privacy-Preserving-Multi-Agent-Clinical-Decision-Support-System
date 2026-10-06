"""Authentication service."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import create_access_token, hash_password, verify_password
from backend.models.models import User


async def authenticate_user(db: AsyncSession, username: str, password: str) -> dict | None:
    """Authenticate a user and return JWT token."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, str(user.hashed_password)):
        return None
    if not user.is_active:
        return None

    token = create_access_token({"sub": str(user.id), "role": user.role, "username": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
    }


async def create_user(
    db: AsyncSession, username: str, email: str, password: str, role: str = "viewer"
) -> User:
    """Create a new user."""
    user = User(
        id=uuid.uuid4(),
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(user)
    await db.flush()
    return user


async def get_or_create_default_admin(db: AsyncSession) -> User:
    """Ensure default admin, doctor, and patient users exist."""
    # Admin
    result = await db.execute(select(User).where(User.username == "admin"))
    admin = result.scalar_one_or_none()
    if not admin:
        admin = await create_user(db, "admin", "admin@example.com", "admin123", "admin")

    # Doctor
    for doc_name in ["doctor", "doctor1"]:
        result = await db.execute(select(User).where(User.username == doc_name))
        doc_user = result.scalar_one_or_none()
        if not doc_user:
            doc_user = await create_user(db, doc_name, f"{doc_name}@example.com", f"{doc_name}123", "doctor")
            from backend.models.hospital import Doctor
            doctor = Doctor(
                id=uuid.uuid4(),
                user_id=doc_user.id,
                first_name="Sarah",
                last_name="Chen",
                specialization="General Medicine",
                license_number=f"MD-2024-001-{doc_name}",
                department="Internal Medicine",
                years_of_experience=12,
                qualifications=["MD", "FACP"],
            )
            db.add(doctor)

    # Patient
    for pat_name in ["patient", "patient1"]:
        result = await db.execute(select(User).where(User.username == pat_name))
        pat_user = result.scalar_one_or_none()
        if not pat_user:
            pat_user = await create_user(db, pat_name, f"{pat_name}@example.com", f"{pat_name}123", "patient")
            from backend.models.hospital import Patient
            patient = Patient(
                id=uuid.uuid4(),
                first_name="John",
                last_name="Smith",
                date_of_birth="1985-03-15",
                gender="Male",
                blood_type="O+",
                phone="+1-555-0100",
                email=f"{pat_name}@email.com",
                medical_record_number=f"MRN-2024-0001-{pat_name}",
                allergies=["Penicillin"],
                chronic_conditions=["Hypertension", "Type 2 Diabetes"],
            )
            db.add(patient)

    return admin

