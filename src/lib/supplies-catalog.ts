// Catálogo precargado de insumos de un consultorio odontológico. El consultorio activa solo lo que usa;
// mínimo y días de aviso son sugerencias que luego puede ajustar. perishable=false: no pide fecha de vencimiento al ingresar.
export type BaseSupply = { key: string; name: string; category: string; unit: string; perishable: boolean; min: number; warn: number; pack?: string; packSize?: number };

// Los insumos que se gastan en cada procedimiento se cuentan en su unidad de uso (carpule, par, aplicación) para poder armar kits;
// pack/packSize dicen cómo vienen empacados. El resto se cuenta por empaque.
const s = (key: string, name: string, category: string, unit: string, perishable: boolean, min: number, warn = 60, pack?: string, packSize?: number): BaseSupply => ({ key, name, category, unit, perishable, min, warn, pack, packSize });

export const SUPPLY_CATALOG: BaseSupply[] = [
  s("guantes-nitrilo", "Guantes de nitrilo", "Bioseguridad", "par", false, 100, 60, "caja", 50),
  s("guantes-latex", "Guantes de látex", "Bioseguridad", "par", false, 50, 60, "caja", 50),
  s("tapabocas", "Tapabocas quirúrgicos", "Bioseguridad", "unidad", false, 100, 60, "caja", 50),
  s("gorros", "Gorros desechables", "Bioseguridad", "unidad", false, 100, 60, "paquete", 100),
  s("baberos", "Baberos desechables", "Bioseguridad", "unidad", false, 100, 60, "paquete", 100),
  s("campos", "Campos desechables", "Bioseguridad", "unidad", false, 50, 60, "paquete", 50),
  s("eyectores", "Eyectores desechables", "Bioseguridad", "unidad", false, 100, 60, "bolsa", 100),
  s("bolsas-esteril", "Bolsas de esterilización", "Bioseguridad", "caja", false, 2),
  s("indicadores", "Indicadores químicos de esterilización", "Bioseguridad", "caja", true, 1, 90),
  s("desinfectante", "Desinfectante de superficies", "Bioseguridad", "frasco", true, 2, 60),
  s("lidocaina", "Lidocaína 2 % con epinefrina", "Anestesia", "carpule", true, 50, 90, "caja", 50),
  s("articaina", "Articaína 4 % con epinefrina", "Anestesia", "carpule", true, 50, 90, "caja", 50),
  s("mepivacaina", "Mepivacaína 3 %", "Anestesia", "carpule", true, 25, 90, "caja", 50),
  s("agujas-cortas", "Agujas dentales cortas", "Anestesia", "aguja", false, 100, 60, "caja", 100),
  s("agujas-largas", "Agujas dentales largas", "Anestesia", "aguja", false, 100, 60, "caja", 100),
  s("topico", "Anestésico tópico", "Anestesia", "frasco", true, 1, 90),
  s("resina", "Resina compuesta", "Operatoria", "aplicación", true, 30, 90, "jeringa", 15),
  s("adhesivo", "Adhesivo dental", "Operatoria", "aplicación", true, 100, 90, "frasco", 100),
  s("acido-grabador", "Ácido grabador", "Operatoria", "aplicación", true, 30, 90, "jeringa", 30),
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
export const SUPPLY_UNITS = ["unidad", "par", "carpule", "aplicación", "aguja", "caja", "paquete", "bolsa", "frasco", "tubo", "jeringa", "kit", "sobre"];
