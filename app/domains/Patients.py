class Patients:
    def __init__(self, id, nombre, segundo_nombre, apellido, segundo_apellido, tipo_documento, cedula, direccion, ciudad, departamento, pais, barrio, email, telefono, fecha_nacimiento, genero, estado_civil, ocupacion, escolaridad, eps, regimen, acompanante, telefono_acompanante, parentesco, direccion_acompanante):
        self.id = id
        self.nombre = nombre
        self.segundo_nombre = segundo_nombre
        self.apellido = apellido
        self.segundo_apellido = segundo_apellido
        self.tipo_documento = tipo_documento
        self.cedula = cedula
        self.direccion = direccion
        self.ciudad = ciudad
        self.departamento = departamento
        self.pais = pais
        self.barrio = barrio
        self.email = email
        self.telefono = telefono
        self.fecha_nacimiento = fecha_nacimiento
        self.genero = genero
        self.estado_civil = estado_civil
        self.ocupacion = ocupacion
        self.escolaridad = escolaridad
        self.eps = eps
        self.regimen = regimen
        self.acompanante = acompanante
        self.telefono_acompanante = telefono_acompanante
        self.parentesco = parentesco
        self.direccion_acompanante = direccion_acompanante

    def list_patients(self):
        return {
            "id": self.id,
            "nombre": self.nombre + " " + self.segundo_nombre,
            "apellido": self.apellido + " " + self.segundo_apellido,
            "tipo_documento": self.tipo_documento,
            "numero_documento": self.cedula,
            "telefono": self.telefono
        }

    def json(self):
        return {
            "nombre": self.nombre,
            "segundo_nombre": self.segundo_nombre,
            "apellido": self.apellido,
            "segundo_apellido": self.segundo_apellido,
            "tipo_documento": self.tipo_documento,
            "cedula": self.cedula,
            "direccion": self.direccion,
            "ciudad": self.ciudad,
            "departamento": self.departamento,
            "pais": self.pais,
            "barrio": self.barrio,
            "email": self.email,
            "telefono": self.telefono,
            "fecha_nacimiento": self.fecha_nacimiento,
            "genero": self.genero,
            "estado_civil": self.estado_civil,
            "ocupacion": self.ocupacion,
            "escolaridad": self.escolaridad,
            "eps": self.eps,
            "regimen": self.regimen,
            "acompanante": self.acompanante,
            "telefono_acompanante": self.telefono_acompanante,
            "parentesco": self.parentesco,
            "direccion_acompanante": self.direccion_acompanante
        }
    
    def __str__(self):
        return f"nombre: {self.nombre}, segundo_nombre: {self.segundo_nombre}, apellido: {self.apellido}, segundo_apellido: {self.segundo_apellido}, tipo_documento: {self.tipo_documento}, cedula: {self.cedula}, direccion: {self.direccion}, ciudad: {self.ciudad}, departamento: {self.departamento}, pais: {self.pais}, barrio: {self.barrio}, email: {self.email}, telefono: {self.telefono}, fecha_nacimiento: {self.fecha_nacimiento}, genero: {self.genero}, estado_civil: {self.estado_civil}, ocupacion: {self.ocupacion}, escolaridad: {self.escolaridad}, eps: {self.eps}, regimen: {self.regimen}, acompanante: {self.acompanante}, telefono_acompanante: {self.telefono_acompanante}, parentesco: {self.parentesco}, direccion_acompanante: {self.direccion_acompanante}"