// Los NICKS de los NPCs de las ligas y de los rankings de zona/país (U4-B, docs/USUARIOS.md §10). PURO: solo constantes,
// sin estado ni imports, así el test (server/src/__tests__/leaguePools.test.ts) los revisa sin levantar el server.
// REGLA 7 (docs/AGENTS.md): un chico tiene UN puntaje y aparece en UNA tabla. Por eso:
//   - cada usuario del demo compite en su liga pública con un pool de NPCs PROPIO y DISJUNTO del de los demás (si Luna e
//     Ian compartieran nicks, "Simular NPCs" de uno le cambiaría el puntaje al NPC en la tabla del otro);
//   - los nicks de zona/país no aparecen en ninguna liga; zona y país tienen DOS tops, el de los chicos y el de los grandes
//     (U4-B2: el adulto compite con grandes también ahí), disjuntos entre sí;
//   - ninguno coincide con los 14 NPCs amigos de friendsFake.ts (un chico es UNA identidad en todo el demo).
// Ian conserva EXACTAMENTE los de siempre (mudados desde leaguesFake.ts SIN cambiar el orden: sus semanas simuladas salen
// idénticas). Los de Luna (chicos de 11-13) y los de Andrés (GRANDES que aprenden en Innerith, D4 de U4) son nuevos.
// Sumar un usuario al seed = sumar acá su pool nuevo y disjunto (y su LeagueSeed en leaguesFake.ts, que falla fuerte al
// arrancar si falta).

/** Los 16 de la tabla de siempre de Ian (el mock del navegador): los 11 de su tabla del seed salen de acá. */
export const NICKS: readonly string[] = ['NachoNova', 'EmiFósil', 'ValenOrbita', 'GuadaGalaxia', 'FeliTrex', 'AguMeteoro', 'PiliCometa', 'BautiLava', 'JoaquiSaturno', 'ZoeVolcan', 'FrancoPlaneta', 'MiliEclipse', 'LautiCrater', 'RenataLuna', 'SantiAsteroide', 'OliviaNebula']
/** Más chicos para las tablas de las semanas simuladas de Ian (ninguno es de zona/país ni amigo: un chico tiene UN
 *  solo puntaje y aparece en UNA tabla de liga). */
export const MORE_NICKS: readonly string[] = ['TobiPulsar', 'CandeMarea', 'RamiTitan', 'AbriCoral', 'GonzaGlaciar', 'MaiaPrisma', 'LeoCiclon', 'AnaKiwi', 'PanchoMamut', 'JoseOrca', 'SolCaracol', 'DelfiDelfin', 'IvoMarte', 'LolaKoala', 'NinaNube', 'MatiAtomo', 'CamiloCanguro', 'ElenaCascada', 'GaelGeiser', 'PedroBambu', 'UmaTucan', 'LuchoHalcon', 'ClaraArcoiris', 'BenjaDuna', 'IaraPinguino', 'FacuBrujula', 'JazminFaro', 'PatoOla', 'RoccoSelva', 'LaraTortuga', 'CiroJaguar', 'BiancaCondor', 'MorePuma', 'LichiBisonte', 'JuanaLince', 'LoloBallena', 'TinoPulpo', 'IsaMedusa', 'BeniCristal', 'AmbarZorro', 'JuliPanda', 'VicenTrueno', 'PazNieve', 'MaxiRadar']
/** El pool de Ian para sus semanas simuladas: EN ESTE ORDEN (weekNpcs lo baraja con un PRNG sembrado). */
export const LEAGUE_NICKS: readonly string[] = [...NICKS, ...MORE_NICKS]

/* Nicks propios de los rankings geográficos, DISJUNTOS entre sí y con las ligas: si un mismo chico apareciera en dos
   tablas con dos puntajes distintos, se rompería la regla de "un solo puntaje semanal". Son GLOBALES (de la zona y del
   país, no de un usuario): los ven todos los CHICOS. EN ESTE ORDEN (el top rota sobre ellos: sus tablas no cambian). */
export const GEO_NICKS: readonly string[] = ['SofiAurora', 'ThiagoFoton', 'CamiCuarzo', 'BrunoTornado', 'AlmaBrisa', 'IkerMagma', 'LunaBoreal', 'DanteOrion', 'MiaTundra', 'TeoGranizo', 'VeraCeleste', 'SimonQuasar']
export const GEO_NICKS_PAIS: readonly string[] = ['RenzoPolaris', 'MiluVega', 'KiaraAndromeda', 'ManuLucero', 'AinaCenit', 'GaspiHorizonte', 'EmmaSolsticio', 'LucasRelampago', 'TatiArrecife', 'AxelMistral', 'AmpiSequoia', 'RomiEquinoccio']
/* U4-B2 (decisión del dueño, 28-oct): el ADULTO compite en zona y país contra los tops de GRANDES que aprenden en la zona
   y en el país (como en su liga, D4: nunca contra chicos). Mismo tamaño que los de los chicos, DISJUNTOS de todos los demás
   pools (un grande tiene UN puntaje y aparece en UNA tabla), de los NPCs amigos, de los nicks del seed y de los mentores. */
export const ADULT_GEO_NICKS: readonly string[] = ['JorgeTango', 'ElsaPiano', 'PabloKayak', 'MarisaJapones', 'HoracioBandoneon', 'SusanaCaligrafia', 'SebaEscalada', 'GiseCanto', 'RaulApicultor', 'MarcelaTelar', 'GermanFilosofia', 'AnaliaCroche']
export const ADULT_GEO_NICKS_PAIS: readonly string[] = ['BetoPanadero', 'LiliTeatro', 'WalterVelero', 'MecheCoro', 'CarlaQuimica', 'OmarFolklore', 'TereMacrame', 'LuisGeografia', 'BeaPoesia', 'ErnestoNatacion', 'MabelDibujo', 'ArielUkelele']

/** Qué gente encabeza zona y país según quién mira (UserInfo.kind del usuario activo): los chicos, la de siempre; el
 *  adulto, la de grandes. La fórmula del puesto y sus anclas son las mismas para los dos (leaguesFake.ts geoPos). */
export const GEO_POOLS: Readonly<Record<'zona' | 'pais', Readonly<Record<'child' | 'adult', readonly string[]>>>> = {
  zona: { child: GEO_NICKS, adult: ADULT_GEO_NICKS },
  pais: { child: GEO_NICKS_PAIS, adult: ADULT_GEO_NICKS_PAIS },
}

/** La liga pública de un usuario del demo: los 11 NPCs de su tabla del seed (en el orden de LEAGUE_DIFFS sin el 0) y el
 *  pool de sus semanas simuladas (incluye a los 11 de la tabla). */
export interface LeaguePool { table: readonly string[]; pool: readonly string[] }

const LUNA_TABLE = ['FlorAstrolabio', 'JeroCodigo', 'MaleAcuarela', 'TiziRobotica', 'XimeOrbital', 'YagoTeorema', 'SamiHiedra', 'UliDinamo', 'GalaPoema', 'DaniMosaico', 'PiaCompas']
/** Chicos de 11-13: la tabla de Luna (Liga Estrella en el seed). */
export const LUNA_LEAGUE: LeaguePool = {
  table: LUNA_TABLE,
  pool: [...LUNA_TABLE, 'AntoMapamundi', 'BelLibreta', 'CeciVioleta', 'DoloPlaneador', 'EliAlgebra', 'EugeMicroscopio', 'FranSextante', 'GimeCaleidoscopio', 'HugoVector', 'InesSinfonia', 'KariPentagrama', 'LucaMagnetita', 'LupeFolio', 'MauroPixel', 'NoeBotanica', 'OriTangram', 'QuiqueAtlas', 'ValuGeoda', 'ZairaCuaderno', 'KeviCircuito', 'WenAbaco', 'RoriTinta', 'AbiMeridiano', 'NeoParalaje'],
}

const ADULT_TABLE = ['MarceloViajero', 'GabiPilates', 'FerGuitarra', 'PaulaMasaMadre', 'DiegoAjedrecista', 'VeroItaliano', 'SergioMaraton', 'LauraFotografa', 'AndreaHuerta', 'GustavoPython', 'SilviCeramica']
/** GRANDES que aprenden en Innerith (D4 de U4: el adulto compite con otros adultos, nunca con chicos): la tabla de Andrés
 *  (Liga Chispa en el seed). */
export const ADULT_LEAGUE: LeaguePool = {
  table: ADULT_TABLE,
  pool: [...ADULT_TABLE, 'RicardoAcuarelas', 'MarianaFrances', 'HernanCarpinteria', 'ValeriaYoga', 'JaviPodcast', 'MartinCiclista', 'LoreViolin', 'AleAstronomia', 'NatiPortugues', 'ClaudiaJardin', 'AdrianHistoria', 'MonicaTejido', 'FabianBonsai', 'NoraCocina', 'LeandroRemo', 'SoleBordado', 'EzeAleman', 'AgustinaTenis', 'EduSudoku', 'PatriLectura', 'RodriTrekking', 'CrisRelojeria', 'ViviOrigami', 'DamianLatin'],
}
