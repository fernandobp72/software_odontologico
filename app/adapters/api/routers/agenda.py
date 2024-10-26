from fastapi import APIRouter
from uvicorn.config import logger

from app.adapters.database.mongodb.mongodb_crud import MongoDB
from app.domains.agenda import Agenda
from app.application.calendar.agenda import AgendaManager
from app.schemas.input import AgendaBase, AgendaBaseConsult

router = APIRouter()
db = MongoDB("agenda")
service = AgendaManager(db)

@router.post("/api/agenda/create")
async def create_agenda_mongo(agenda: AgendaBase):
    request = Agenda(**agenda.model_dump())
    valor = await service.create_agenda(request)
    return {"message": valor.model_dump()}

@router.post("/api/agenda/search")
async def search_agenda_mongo(query: AgendaBaseConsult):
    logger.info(f"query {query.model_dump()}")
    result = await service.get_agenda(query.model_dump(exclude_unset=True))
    logger.info(f"result {len(result)}")
    return {"message": result, "total": len(result)}

@router.post("/api/agenda/update")
async def update_agenda_mongo(id_doc:str, update: AgendaBaseConsult):
    result = await service.update_agenda(id_doc, update.model_dump(exclude_unset=True))
    return {"message": result}

@router.get("/agenda/{year}/{month}")
async def get_agenda_by_month(year: int, month: int):
    results = await service.get_by_months(month, year)
    return results