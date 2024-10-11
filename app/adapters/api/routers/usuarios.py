import json
from uvicorn.config import logger
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.application.authentication.login import authenticate_user
from app.domains.Users import Users
from app.schemas.input import RegisterUser, UserLogin, as_form
from app.application.authentication.register import register_user_db 

router = APIRouter()

templates = Jinja2Templates(directory="app/templates")

# Metodos Get de consumo web
@router.get("/", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request, "user_authenticated": False})

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request, "user_authenticated": False})


@router.get("/success", response_class=HTMLResponse)
async def success_page(request: Request, names: str):
    return templates.TemplateResponse("success.html", {"request": request, "names": names})


@router.get("/homepage", name="homepage", response_class=HTMLResponse)
async def home_page(request: Request):
    return templates.TemplateResponse("homepage.html", {"request": request, "user_authenticated": True})


@router.get("/logout", name="logout", response_class=RedirectResponse)
async def logout(request: Request):
    return RedirectResponse("/login", status_code=303)


# Metodos Post de construccion de API
# Autenticacion de usuario
@router.post("/api/auth", response_class=JSONResponse)
async def login(request: Request, user: UserLogin = Depends(UserLogin.as_form)):
    validate = await authenticate_user(user.username, user.password)
    if validate:
        logger.info(f"tipo de usuario {type(validate)}")
        return JSONResponse(content={"message": "Usuario autenticado", "data": validate.json()}, status_code=200)
    else: 
        return JSONResponse(content={"message": "usuario o contraseña incorrectos"}, status_code=401)
    
# Registro de usuario
@router.post("/api/register", response_class=JSONResponse)
async def create_user(request: Request, form: RegisterUser = Depends(as_form)):
    if form.password != form.confirm_password:
        return JSONResponse(content={"message": "Las contraseñas no coinciden", "data": ""}, status_code=404)
    user = Users(**form.model_dump())
    success = await register_user_db(user)
    user.password = "********"
    user.confirm_password = "********"
    logger.info(f"Solicitud de regitro de usuario: {user.json()}")
    if success:
        return JSONResponse(content={"message": "Usuario registrado", "data": user.json()}, status_code=200)
    else:
        logger.error(f"No se pudo registrar el usuario {user.names}")
        return JSONResponse(content={"message": "No se pudo registrar el usuario", "data": ""}, status_code=404)