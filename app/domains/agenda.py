from pydantic import Field
from pydantic import BaseModel
from typing import Optional
from datetime import datetime



class Agenda(BaseModel):
    id: Optional[str] = Field(default=None)
    title: str
    description: str
    owner: str
    professional: str
    patient: str
    date: datetime
    time: str
    status: str