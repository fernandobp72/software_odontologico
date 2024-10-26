import asyncio
from datetime import date
from bson import ObjectId
from fastapi.encoders import jsonable_encoder

from app.adapters.database.mongodb.mongodb_config_adapter import MongoDBConfigAdapter
from app.domains.agenda import Agenda





class MongoDB:
    def __init__(self, collection_name=None):
        self.collection = MongoDBConfigAdapter().get_collection(collection_name)
        self.allowed_keys = Agenda.model_fields.keys()


    async def ping(self):
        try:
            await self.collection.database.client.admin.command('ping')
            print("Connected to MongoDB")
        except Exception as e:
            print("No se pudo conectar a la base de datos: " + str(e))

    async def get(self, query: dict):
        await self.validate_data(query)
        return await self.collection.find_one(query)

    async def get_all(self, query: dict):
        await self.validate_data(query)
        if 'id' in query:
            query['_id'] = ObjectId(query.pop('id'))
        documents = [document async for document in self.collection.find(query)]
        for document in documents:
            if '_id' in document:
                document['_id'] = str(document['_id'])
        return jsonable_encoder(documents)

    async def get_by_month(self, month: int, year: int):
        cursor = self.collection.aggregate([
            {
                "$match": {
                    "$expr": {
                        "$and": [
                            { "$eq": [{ "$month": { "$toDate": "$date" } }, month] },
                            { "$eq": [{ "$year": { "$toDate": "$date" } }, year] }
                        ]
                    }
                }
            }
        ])
        documents = [document async for document in cursor]
        for document in documents:
            if '_id' in document:
                document['_id'] = str(document['_id'])
        print("Documents: " + str(jsonable_encoder(documents)))
        return jsonable_encoder(documents)

    async def insert(self, doc: dict):
        await self.validate_data(doc)
        try:
            print("Document inserted")
            return await self.collection.insert_one(doc)
        except Exception as e:
            print("Error inserting document: " + str(e))

    async def update(self, query:str, update:dict):
        await self.validate_data(update)
        try:
            print("Document updated")
            await self.collection.update_one({'_id': ObjectId(query)}, {"$set": update})
            document = await self.collection.find_one({'_id': ObjectId(query)})
            if '_id' in document:
                document['_id'] = str(document['_id'])
            return jsonable_encoder(document)
        except Exception as e:
            print("Error updating document: " + str(e))

    async def validate_data(self, query: dict):
        if not query:
            raise ValueError("No se ha enviado un query válido")
        for key, value in query.items():
            if key not in self.allowed_keys:
                raise ValueError(f"El campo {key} no es un campo válido para la colección {self.collection.name}")
            if not isinstance(value, (str, date)):
                raise ValueError(f"El valor {value} de actualización debe ser un string o un date")
