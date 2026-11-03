// Catálogo precargado de insumos de un consultorio odontológico. El consultorio activa solo lo que usa;
// mínimo y días de aviso son sugerencias que luego puede ajustar. perishable=false: no pide fecha de vencimiento al ingresar.
export type BaseSupply = { key: string; name: string; category: string; unit: string; perishable: boolean; min: number; warn: number };

const s = (key: string, name: string, category: string, unit: string, perishable: boolean, min: number, warn = 60): BaseSupply => ({ key, name, category, unit, perishable, min, warn });

export const SUPPLY_CATALOG: BaseSupply[] = [
  s("guantes-nitrilo", "Guantes de nitrilo", "Bioseguridad", "caja", false, 3),
  s("guantes-latex", "Guantes de látex", "Bioseguridad", "caja", false, 2),
  s("tapabocas", "Tapabocas quirúrgicos", "Bioseguridad", "caja", false, 3),
  s("gorros", "Gorros desechables", "Bioseguridad", "paquete", false, 2),
  s("baberos", "Baberos desechables", "Bioseguridad", "paquete", false, 3),
  s("campos", "Campos desechables", "Bioseguridad", "paquete", false, 2),
  s("eyectores", "Eyectores desechables", "Bioseguridad", "bolsa", false, 3),
  s("bolsas-esteril", "Bolsas de esterilización", "Bioseguridad", "caja", false, 2),
  s("indicadores", "Indicadores químicos de esterilización", "Bioseguridad", "caja", true, 1, 90),
  s("desinfectante", "Desinfectante de superficies", "Bioseguridad", "frasco", true, 2, 60),
  s("lidocaina", "Lidocaína 2 % con epinefrina", "Anestesia", "caja", true, 2, 90),
  s("articaina", "Articaína 4 % con epinefrina", "Anestesia", "caja", true, 2, 90),
  s("mepivacaina", "Mepivacaína 3 %", "Anestesia", "caja", true, 1, 90),
  s("agujas-cortas", "Agujas dentales cortas", "Anestesia", "caja", false, 2),
  s("agujas-largas", "Agujas dentales largas", "Anestesia", "caja", false, 2),
  s("topico", "Anestésico tópico", "Anestesia", "frasco", true, 1, 90),
  s("resina", "Resina compuesta", "Operatoria", "jeringa", true, 3, 90),
  s("adhesivo", "Adhesivo dental", "Operatoria", "frasco", true, 1, 90),
  s("acido-grabador", "Ácido grabador", "Operatoria", "jeringa", true, 2, 90),
  s("ionomero", "Ionómero de vidrio", "Operatoria", "kit", true, 1, 90),
  s("sellante", "Sellante de fosas y fisuras", "Operatoria", "jeringa", true, 1, 90),
  s("matrices", "Matrices y cuñas", "Operatoria", "paquete", false, 2),
  s("tiras-pulir", "Tiras y discos de pulido", "Operatoria", "paquete", false, 2),
  s("fresas", "Fresas (surtido)", "Operatoria", "unidad", false, 10),
  s("hidroxido", "Hidróxido de calcio", "Operatoria", "tubo", true, 1, 90),
  s("barniz", "Barniz de flúor", "Prevención", "unidad", true, 5, 90),
  s("pasta-profilaxis", "Pasta profiláctica", "Prevención", "frasco", true, 1, 90),
  s("copas-profilaxis", "Copas y cepillos de profilaxis", "Prevención", "bolsa", false, 2),
  s("limas", "Limas de endodoncia", "Endodoncia", "caja", false, 2),
  s("puntas-papel", "Puntas de papel", "Endodoncia", "caja", false, 2),
  s("gutapercha", "Gutapercha", "Endodoncia", "caja", true, 2, 90),
  s("sellador-endo", "Cemento sellador de conductos", "Endodoncia", "kit", true, 1, 90),
  s("hipoclorito", "Hipoclorito de sodio", "Endodoncia", "frasco", true, 2, 45),
  s("edta", "EDTA", "Endodoncia", "frasco", true, 1, 90),
  s("sutura", "Sutura", "Cirugía", "sobre", true, 5, 90),
  s("bisturi", "Hojas de bisturí", "Cirugía", "caja", false, 1),
  s("hemostatico", "Esponja hemostática", "Cirugía", "unidad", true, 3, 90),
  s("gasas", "Gasas estériles", "Cirugía", "paquete", true, 5, 90),
  s("algodon", "Rollos de algodón", "Cirugía", "bolsa", false, 2),
  s("clorhexidina", "Clorhexidina", "Cirugía", "frasco", true, 2, 60),
  s("alginato", "Alginato", "Impresión", "bolsa", true, 2, 60),
  s("silicona", "Silicona de impresión", "Impresión", "kit", true, 1, 90),
  s("yeso", "Yeso", "Impresión", "bolsa", false, 1),
  s("cem-resina", "Cemento de resina", "Cementación", "kit", true, 1, 90),
  s("cem-provisional", "Cemento provisional", "Cementación", "tubo", true, 1, 90),
];

export const SUPPLY_CATEGORIES = [...new Set(SUPPLY_CATALOG.map((x) => x.category)), "Otros"];
export const SUPPLY_UNITS = ["unidad", "caja", "paquete", "bolsa", "frasco", "tubo", "jeringa", "kit", "sobre"];
