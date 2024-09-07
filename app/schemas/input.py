from datetime import date
from typing import Optional
from fastapi import Form
from pydantic import BaseModel, Field
from pydantic.networks import email_validator


class RegisterUser(BaseModel):
    names: str = Field(..., example="Pedro")
    surnames: str = Field(..., example="Capo")
    username: str = Field(..., example="pedro2024")
    document: str | int = Field(..., example="1020101020")
    email: str = Field(..., example="email@validator.com")
    phone_number: str | int = Field(..., example="3245555555")
    job: str = Field(..., example="Independiente")
    profession: str = Field(..., example="Ingeniero")
    password: str = Field(..., example="Pedro123*")
    confirm_password: str = Field(..., example="Pedro123*")

def as_form(
        names: str = Form(...),
        surnames: str = Form(...),
        username: str = Form(...),
        document: str = Form(...),
        email: str = Form(...),
        phone_number: str = Form(...),
        job: str = Form(...),
        profession: str = Form(...),
        password: str = Form(...),
        confirm_password: str = Form(...)
    ):
        return RegisterUser(
            names=names,
            surnames=surnames,
            username=username,
            document=document,
            email=email,
            phone_number=phone_number,
            job=job,
            profession=profession,
            password=password,
            confirm_password=confirm_password
        )


class UserLogin(BaseModel):
    username: str
    password: str

    @classmethod
    def as_form(
        cls,
        username: str = Form(..., example="pedro2024"),
        password: str = Form(..., example="Pedro123*")
    ) -> "UserLogin":
        return cls(username=username, password=password)
    

class Paciente(BaseModel):
    id: Optional[int] = None
    nombre: str
    segundo_nombre: Optional[str]
    apellido: str
    segundo_apellido: Optional[str]
    tipo_documento: str
    cedula: str
    direccion: str
    ciudad: str
    departamento: str
    pais: str
    barrio: str
    email: str
    telefono: str
    fecha_nacimiento: date
    genero: str
    estado_civil: str
    ocupacion: str
    escolaridad: str
    eps: str
    regimen: str
    acompanante: str
    telefono_acompanante: str
    parentesco: str
    direccion_acompanante: str

