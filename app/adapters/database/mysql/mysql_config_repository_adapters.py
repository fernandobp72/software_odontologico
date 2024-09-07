from contextlib import asynccontextmanager

import aiomysql
from uvicorn.config import logger

from app.config.config_yml import config

mysql = config["connection"]["mysql"]

class DataBaseConnection:
    _pool = None

    @classmethod
    async def get_pool(cls):
        if cls._pool is None:
            try:
                cls._pool = await aiomysql.create_pool(
                    host=mysql["host"],
                    port=mysql["port"],
                    user=mysql["username"],
                    password=mysql["password"],
                    db=mysql["db"],
                    connect_timeout=mysql["connect_timeout"],
                    autocommit=True
                )
            except Exception as e:
                logger.error(f"Error en la conexión a la base de datos: {e}")
                cls._pool = None            
                raise RuntimeError("No se pudo establecer la conexión con la base de datos.")

        return cls._pool

    @classmethod
    async def closed_pool(cls):
        if cls._pool:
            cls._pool.close()
            await cls._pool.wait_close()
            cls._pool = None

    @staticmethod
    @asynccontextmanager
    async def get_connection():
        pool = await DataBaseConnection.get_pool()
        async with pool.acquire() as conn:
            try:
                yield conn
            except Exception as e:
                logger.error(f"Error durante la conexión: {e}")
                raise
            finally:
                await conn.ensure_closed()


async def get_db_connection():
    async with DataBaseConnection.get_connection() as connection:
        yield connection
