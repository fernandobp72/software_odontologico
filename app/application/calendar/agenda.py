from app.adapters.database.mongodb.mongodb_crud import MongoDB
from app.domains.agenda import Agenda
from typing import List, Union
from pymongo.errors import PyMongoError
import datetime

class AgendaManager:
    def __init__(self, db: MongoDB):
        self.db = db

    async def create_agenda(self, agenda: Agenda) -> Union[Agenda, None]:
        """Inserta una nueva agenda en la base de datos."""
        try:
            agenda_dict = agenda.model_dump(exclude_unset=True)
            result = await self.db.insert(agenda_dict)
            if result.inserted_id:
                agenda.id = str(result.inserted_id)
            return agenda
        except PyMongoError as e:
            # Log del error o manejo específico
            print(f"Error creando la agenda: {e}")
            return None

    async def get_agenda(self, dict_consult: dict) -> List[Agenda]:
        """Consulta las agendas según los criterios proporcionados."""
        try:
            results = await self.db.get_all(dict_consult)
            return results
        except PyMongoError as e:
            print(f"Error obteniendo la agenda: {e}")
            return []

    async def update_agenda(self, document, dict_update: dict) -> bool:
        """Actualiza un documento específico en la colección Agenda."""
        try:
            updated_result = await self.db.update(document, dict_update)
            return updated_result.get('modified_count', 0) > 0
        except PyMongoError as e:
            print(f"Error actualizando la agenda: {e}")
            return False

    async def get_by_months(self, month: int, year: int) -> List[Agenda]:
        """Obtiene las agendas para un mes y año específicos."""
        try:
            # Validar mes y año
            if not (1 <= month <= 12):
                raise ValueError("El mes debe estar entre 1 y 12.")
            if year < 1900 or year > datetime.datetime.now().year + 10:
                raise ValueError("El año debe ser válido.")

            # Consulta en la base de datos
            results = await self.db.get_by_month(month, year)
            return results
        except ValueError as ve:
            print(f"Error de validación: {ve}")
            return []
        except PyMongoError as e:
            print(f"Error obteniendo agendas por mes y año: {e}")
            return []
