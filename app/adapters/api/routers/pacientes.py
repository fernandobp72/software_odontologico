from fastapi import APIRouter, Depends, Request

from app.adapters.database.mysql.mysql_config_repository_adapters import get_db_connection
from app.application.patients.create import register_patients_db, get_patient_db
from app.domains.Patients import Patients
from app.schemas.input import Paciente

from uvicorn.config import logger


router = APIRouter()

@router.get("/api/pacientes")
async def get_pacientes(request: Request, db_connection=Depends(get_db_connection)):
    patients = await get_patient_db(db_connection)
    return {"message": "Obtener todos los pacientes", "data": patients, "total": len(patients)}

@router.get("/pacientes/{paciente_id}")
def get_paciente(paciente_id: int):
    # Lógica para obtener un paciente por su ID
    return {"message": f"Obtener paciente con ID {paciente_id}"}

@router.post("/api/pacientes/create")
async def create_paciente(request: Request, paciente: Paciente, db_connection=Depends(get_db_connection)):
    request_json = Patients(**paciente.model_dump())
    await register_patients_db(request_json, db_connection)
    logger.info(f"Response Service: {request_json.json()}")
    return {"message": "Paciente creado", "data": request_json.json()}
