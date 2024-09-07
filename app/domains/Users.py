
class Users:
    def __init__(self, names, surnames, username, document, email, phone_number, job, profession, **kwargs):
        self.names = names
        self.surnames = surnames
        self.username = username
        self.document = document
        self.email = email
        self.phone_number = phone_number
        self.job = job
        self.profession = profession
        for key, value in kwargs.items():
            setattr(self, key, value)



    @classmethod
    def validate_user(cls, username, password):
        instance = cls(username, password)
        return instance
    
    def json(self):
        return {
            "names": self.names,
            "surnames": self.surnames,
            "username": self.username,
            "document": self.document,
            "email": self.email,
            "phone_number": self.phone_number,
            "job": self.job,
            "profession": self.profession
        }

    def __str__(self):
        return f"names: {self.names}, surnames: {self.surnames}, username: {self.username}, document: {self.document}, email: {self.email}, phone_number: {self.phone_number}, job: {self.job}, profession: {self.profession}, password: {self.password}"
    
class Register(Users):
    def __init__(self, names, surnames, username, document, email, phone_number, job, profession, password):
        super().__init__(names, surnames, username, document, email, phone_number, job, profession)
        self.password = password