import json

from app.domains.Users import Register
from app.adapters.database.mysql.mysql_query_request_adapter import MysqlQueryRequestAdapter

db_config = MysqlQueryRequestAdapter()


async def register_user_db(register_user: Register):
    return await db_config.insert_user_db(register_user)
