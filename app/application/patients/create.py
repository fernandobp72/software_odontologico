
from app.adapters.database.mysql.mysql_query_request_patient import MysqlQueryRequestPatient
from app.domains.Patients import Patients


db_config = MysqlQueryRequestPatient()

async def register_patients_db(register_patient: Patients, db_connection):
    return await db_config.create_patient(register_patient, db_connection)

async def get_patient_db(db_connection):
    patients = await db_config.get_all_patients(db_connection)
    result = []
    for patient in patients:
        result.append(patient.list_patients())
    return result
    