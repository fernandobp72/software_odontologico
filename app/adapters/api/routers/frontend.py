from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

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

@router.get("/agenda", name="agenda", response_class=HTMLResponse)
async def agenda_page(request: Request):
    return templates.TemplateResponse("agenda.html", {"request": request, "user_authenticated": True})
