from app.adapters.database.mysql.mysql_config_repository_adapters import DataBaseConnection
from fastapi import Depends, HTTPException
from uvicorn.config import logger

from app.domains.Patients import Patients
from app.schemas.input import Paciente


class MysqlQueryRequestPatient:
    async def create_patient(self, paciente: Paciente, db_connection):
        query = """
        INSERT INTO pacientes (
            nombre, segundo_nombre, apellido, segundo_apellido, tipo_documento, cedula, direccion, ciudad, departamento, pais, barrio, email, telefono, fecha_nacimiento, genero, estado_civil, ocupacion, escolaridad, eps, regimen, acompanante, telefono_acompanante, parentesco, direccion_acompanante
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        """
        values = (
            paciente.nombre, paciente.segundo_nombre, paciente.apellido, paciente.segundo_apellido, paciente.tipo_documento, paciente.cedula, paciente.direccion, paciente.ciudad, paciente.departamento, paciente.pais, paciente.barrio, paciente.email, paciente.telefono, paciente.fecha_nacimiento, paciente.genero, paciente.estado_civil, paciente.ocupacion, paciente.escolaridad, paciente.eps, paciente.regimen, paciente.acompanante, paciente.telefono_acompanante, paciente.parentesco, paciente.direccion_acompanante
        )
        async with db_connection.cursor() as cursor:
            try:
                await cursor.execute(query, values)
                await db_connection.commit()
            except Exception as e:
                await db_connection.rollback()
                logger.error(f"Error al insertar el paciente: {str(e)}")
                raise HTTPException(status_code=500, detail="Error al insertar el paciente")
        
        return {"message": "Paciente creado exitosamente"}
    
    async def get_all_patients(self, db_connection):
        query = f"SELECT * FROM pacientes ORDER BY ID DESC"
        async with db_connection.cursor() as cursor:
            await cursor.execute(query)
            result = await cursor.fetchall()
            columnas = [desc[0] for desc in cursor.description]
            dict_result = []
            for row in result:
                paciente_data = dict(zip(columnas, row))
                paciente = Patients(**paciente_data)
                dict_result.append(paciente)
            return dict_result
        
    