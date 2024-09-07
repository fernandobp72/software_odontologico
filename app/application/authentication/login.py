from app.adapters.database.mysql.mysql_query_request_adapter import MysqlQueryRequestAdapter


db_service = MysqlQueryRequestAdapter()

async def authenticate_user(username: str, password: str):
    validation = await db_service.get_user_db(username, password)
    if validation:
        print("Usuario autenticado")
        return validation
    print("Usuario no autenticado")
    return False 

    

