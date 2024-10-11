import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.config.config_yml import config
from app.adapters.api.routers.usuarios import router as usuarios
from app.adapters.api.routers.pacientes import router as pacientes
from app.adapters.api.routers.agenda import router as agenda

# Instancia de FastAPI
app = FastAPI()
# Carga de configuración
application = config["application"]

# Rutas de archivos estaticos como css
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Rutas de la aplicación
app.include_router(usuarios)
app.include_router(pacientes)
app.include_router(agenda)

# Inicialización de la aplicación
if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=int(application["port"]))

