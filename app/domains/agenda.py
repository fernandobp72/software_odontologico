from pydantic import Field
from pydantic import BaseModel
from typing import Optional
from datetime import datetime



class Agenda(BaseModel):
    id: Optional[str] = Field(default=None)
    patient: str
    description: str
    document_number: str
    professional: str
    date: datetime
    time: str
    status: str