import json
from uvicorn.config import logger
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.application.authentication.login import authenticate_user
from app.domains.Users import Users, Register
from app.schemas.input import RegisterUser, UserLogin, as_form
from app.application.authentication.register import register_user_db 

router = APIRouter()

# Metodos Post de construccion de API
# Autenticacion de usuario
@router.post("/api/auth", response_class=JSONResponse)
async def login(request: Request, user: UserLogin = Depends(UserLogin.as_form)):
    validate = await authenticate_user(user.username, user.password)
    if validate:
        logger.info(f"Response Service: {validate.json()}")
        return JSONResponse(content={"message": "Usuario autenticado", "data": validate.json()}, status_code=200)
    else: 
        return JSONResponse(content={"message": "usuario o contraseña incorrectos"}, status_code=401)
    
# Registro de usuario
@router.post("/api/register", response_class=JSONResponse)
async def create_user(request: Request, form: RegisterUser = Depends(as_form)):
    if form.password != form.confirm_password:
        return JSONResponse(content={"message": "Las contraseñas no coinciden", "data": ""}, status_code=404)
    user = Register(**form.model_dump())
    success = await register_user_db(user)
    user.password = "********"
    user.confirm_password = "********"
    logger.info(f"Solicitud de regitro de usuario: {user.json()}")
    if success:
        return JSONResponse(content={"message": "Usuario registrado", "data": user.json()}, status_code=200)
    else:
        logger.error(f"No se pudo registrar el usuario {user.names}")
        return JSONResponse(content={"message": "No se pudo registrar el usuario", "data": ""}, status_code=404)