import json
from uvicorn.config import logger
from app.adapters.database.mysql.mysql_config_repository_adapters import DataBaseConnection
from app.domains.Users import Register, Users


class MysqlQueryRequestAdapter:
    async def insert_user_db(self, users: Register):
        async with DataBaseConnection.get_connection() as consulta:
            sql = ('INSERT INTO users'
                   '(names, surnames, username, document, email, phone_number, job, profession, password)'
                   'VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s)')
            try:
                async with consulta.cursor() as cursor:
                    await cursor.execute(sql, (users.names, 
                                               users.surnames, 
                                               users.username, 
                                               users.document, 
                                               users.email, 
                                               users.phone_number, 
                                               users.job, 
                                               users.profession, 
                                               users.password))
                    await consulta.commit()
                    logger.info("insercion exitosa en base de datos.")
                    return "Inserción en base de datos exitosa"
            except Exception as e:
                logger.error(f"error al insertar la base de datos, {str(e)}")
                raise

    async def get_user_db(self, username, password):
        async with DataBaseConnection.get_connection() as consulta:
            logger.info(f"Este es el usuario hacia base de datos {username}")
            logger.info(f"Este es el password hacia base de datos {password}")
            sql = ('SELECT * FROM users WHERE username = %s and password = %s')
            try:
                async with consulta.cursor() as cursor:
                    await cursor.execute(sql, (username, password))
                    result = await cursor.fetchone()
                    logger.info(f"Este es el resultado de la consulta {result}")
                    if result: 
                        columnas = [col[0] for col in cursor.description]
                        user_data = dict(zip(columnas, result))
                        return Users(**user_data)
            except Exception as e:
                logger.error(f"error al obtener usuario de la base de datos, {str(e)}")
                raise
    
    async def get_all_users_db(self):
        async with DataBaseConnection.get_connection() as consulta:
            sql = ('SELECT * FROM users')
            try:
                async with consulta.cursor() as cursor:
                    await cursor.execute(sql)
                    result = await cursor.fetchall()
                    return result
            except Exception as e:
                logger.error(f"error al obtener usuarios de la base de datos, {str(e)}")
                raise
    
    async def update_user_db(self, names, surnames, username, document, email, phone_number, job, profession, password):
        async with DataBaseConnection.get_connection() as consulta:
            sql = ('UPDATE users SET names = %s, surnames = %s, document = %s, email = %s, phone_number = %s, job = %s, profession = %s, password = %s WHERE username = %s')
            try:
                async with consulta.cursor() as cursor:
                    await cursor.execute(sql, (names, surnames, document, email, phone_number, job, profession, password, username))
                    await consulta.commit()
                    logger.info("actualización exitosa en base de datos.")
                    return "Actualización en base de datos exitosa"
            except Exception as e:
                logger.error(f"error al actualizar la base de datos, {str(e)}")
                raise

    async def delete_user_db(self, username):
        async with DataBaseConnection.get_connection() as consulta:
            sql = ('DELETE FROM users WHERE username = %s')
            try:
                async with consulta.cursor() as cursor:
                    await cursor.execute(sql, (username,))
                    await consulta.commit()
                    logger.info("eliminación exitosa en base de datos.")
                    return "Eliminación en base de datos exitosa"
            except Exception as e:
                logger.error(f"error al eliminar la base de datos, {str(e)}")
                raise


