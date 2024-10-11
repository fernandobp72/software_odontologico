from app.adapters.database.mongodb.mongodb_crud import MongoDB
from app.domains.agenda import Agenda


class AgendaManager:
    def __init__(self, db: MongoDB):
        self.db = db

    async def create_agenda(self, agenda: Agenda):
        agenda_dict = agenda.model_dump(exclude_unset=True)
        result = await self.db.insert(agenda_dict)
        if result.inserted_id:
            agenda.id = str(result.inserted_id)
        return agenda

    async def get_agenda(self, dict_consult: dict):
        results = await self.db.get_all(dict_consult)
        return results

    async def update_agenda(self, document, dict_update):
        return await self.db.update(document, dict_update)

