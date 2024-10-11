from asyncio.log import logger

from motor.motor_asyncio import AsyncIOMotorClient

from app.config.config_yml import config

config_var = config['connection']['mongodb']

uri= f'mongodb+srv://{config_var['username']}:{config_var['password']}@{config_var['host_port']}/?retryWrites=true&w=majority&appName=Cluster0&tlsAllowInvalidCertificates=true'


class MongoDBConfigAdapter:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            try:
                cls._instance.client = AsyncIOMotorClient(uri)
                cls._instance.db = cls._instance.client[config_var['db']]
                logger.info("Conexión exitosa a la base de datos")
            except Exception as e:
                logger.error(f"No se pudo conectar a la base de datos: {str(e)}")
                raise ConnectionError("Error al conectar a la base de datos") from e
        return cls._instance


    def get_collection(self, name):
        return self.db[name]



