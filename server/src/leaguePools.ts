// Los NICKS de los NPCs de las ligas y de los rankings de zona/país (U4-B, docs/USUARIOS.md §10). PURO: solo constantes,
// sin estado ni imports, así el test (server/src/__tests__/leaguePools.test.ts) los revisa sin levantar el server.
// REGLA 7 (docs/AGENTS.md): un chico tiene UN puntaje y aparece en UNA tabla. Por eso:
//   - cada usuario del demo compite en su liga pública con un pool de NPCs PROPIO y DISJUNTO del de los demás (si Luna e
//     Ian compartieran nicks, "Simular NPCs" de uno le cambiaría el puntaje al NPC en la tabla del otro);
//   - los nicks de zona/país no aparecen en ninguna liga; zona y país tienen DOS tops, el de los chicos y el de los grandes
//     (U4-B2: el adulto compite con grandes también ahí), disjuntos entre sí;
//   - ninguno coincide con los 14 NPCs amigos de friendsFake.ts (un chico es UNA identidad en todo el demo).
// Ian conserva el MISMO pool por lugar (mudado desde leaguesFake.ts SIN cambiar el orden ni el largo: sus semanas simuladas
// salen con la misma forma). TEEN (4-nov, pedido de Esteban: «que parezca para un chico de 13»): los nicks de chicos se
// re-envejecieron a alias de 12-14 (fuera los animalitos y los diminutivos de juguete: «LolaKoala», «FeliTrex»), uno por uno
// en el mismo lugar; los de zona/país y los de Luna, apenas armonizados. Los de Andrés (GRANDES que aprenden en Innerith,
// D4 de U4) quedan.
// Sumar un usuario al seed = sumar acá su pool nuevo y disjunto (y su LeagueSeed en leaguesFake.ts, que falla fuerte al
// arrancar si falta).

/** Los 16 de la tabla de siempre de Ian (el mock del navegador): los 11 de su tabla del seed salen de acá. */
export const NICKS: readonly string[] = ['NachoPixel', 'EmiCode', 'ValenRíos', 'Guada.Beats', 'FeliSkate', 'Agu.Speedrun', 'PiliIndie', 'BautiDrift', 'JoacoSaturno', 'ZoeRiff', 'FrancoTorque', 'MiliEclipse', 'LautiSprint', 'Renata.Ink', 'SantiPivot', 'OliviaNebula']
/** Más chicos para las tablas de las semanas simuladas de Ian (ninguno es de zona/país ni amigo: un chico tiene UN
 *  solo puntaje y aparece en UNA tabla de liga). */
export const MORE_NICKS: readonly string[] = ['TobiPulsar', 'CandeSurf', 'RamiTitan', 'AbriLens', 'GonzaGlaciar', 'MaiaPrisma', 'LeoCiclon', 'AnaVinilo', 'PanchoBMX', 'JoseVoley', 'SolAcústica', 'DelfiDrums', 'IvoMarte', 'LolaStudio', 'NinaCloud', 'MatiAtomo', 'CamiloParkour', 'ElenaCascada', 'GaelGeiser', 'PedroBajo', 'UmaPolaroid', 'LuchoRally', 'ClaraSonata', 'BenjaDuna', 'IaraManga', 'FacuBrujula', 'JazminFaro', 'PatoTrail', 'RoccoBoulder', 'LaraCine', 'CiroTurbo', 'BiancaAndes', 'MoreHoops', 'LichiBeats', 'JuanaGlitch', 'LoloDribble', 'TinoQuant', 'IsaOpera', 'BeniCristal', 'AmbarZen', 'JuliTrack', 'VicenNitro', 'PazSnowboard', 'MaxiRadar']
/** El pool de Ian para sus semanas simuladas: EN ESTE ORDEN (weekNpcs lo baraja con un PRNG sembrado). */
export const LEAGUE_NICKS: readonly string[] = [...NICKS, ...MORE_NICKS]

/* Nicks propios de los rankings geográficos, DISJUNTOS entre sí y con las ligas: si un mismo chico apareciera en dos
   tablas con dos puntajes distintos, se rompería la regla de "un solo puntaje semanal". Son GLOBALES (de la zona y del
   país, no de un usuario): los ven todos los CHICOS. EN ESTE ORDEN (el top rota sobre ellos: sus tablas no cambian). */
export const GEO_NICKS: readonly string[] = ['SofiAurora', 'ThiagoFoton', 'CamiCuarzo', 'BrunoTornado', 'AlmaSaxo', 'IkerMagma', 'LunaBoreal', 'DanteOrion', 'MiaTundra', 'TeoGrind', 'VeraCeleste', 'SimonQuasar']
export const GEO_NICKS_PAIS: readonly string[] = ['RenzoPolaris', 'MiluVoltio', 'KiaraAndromeda', 'ManuLucero', 'AinaCenit', 'GaspiHorizonte', 'EmmaSolsticio', 'LucasRelampago', 'TatiApnea', 'AxelMistral', 'AmpiSequoia', 'RomiEquinoccio']
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

const LUNA_TABLE = ['FlorAstrolabio', 'JeroCodigo', 'MaleAcuarela', 'Tizi.Robotica', 'XimeOrbital', 'YagoTeorema', 'SamiHiedra', 'UliDinamo', 'GalaVerso', 'DaniMosaico', 'PiaCompas']
/** Chicos de 12-14: la tabla de Luna (Liga Estrella en el seed). */
export const LUNA_LEAGUE: LeaguePool = {
  table: LUNA_TABLE,
  pool: [...LUNA_TABLE, 'AntoMapamundi', 'BelDiario', 'CeciVioleta', 'DoloPlaneador', 'EliAlgebra', 'EugeMicroscopio', 'FranSextante', 'GimeCaleidoscopio', 'HugoVector', 'InesSinfonia', 'KariPentagrama', 'LucaMagnetita', 'LupeFolio', 'MauroPixel', 'NoeBotanica', 'OriTangram', 'QuiqueAtlas', 'ValuGeoda', 'ZairaBoceto', 'KeviCircuito', 'WenAlgoritmo', 'RoriTinta', 'AbiMeridiano', 'NeoParalaje'],
}

const ADULT_TABLE = ['MarceloViajero', 'GabiPilates', 'FerGuitarra', 'PaulaMasaMadre', 'DiegoAjedrecista', 'VeroItaliano', 'SergioMaraton', 'LauraFotografa', 'AndreaHuerta', 'GustavoPython', 'SilviCeramica']
/** GRANDES que aprenden en Innerith (D4 de U4: el adulto compite con otros adultos, nunca con chicos): la tabla de Andrés
 *  (Liga Chispa en el seed). */
export const ADULT_LEAGUE: LeaguePool = {
  table: ADULT_TABLE,
  pool: [...ADULT_TABLE, 'RicardoAcuarelas', 'MarianaFrances', 'HernanCarpinteria', 'ValeriaYoga', 'JaviPodcast', 'MartinCiclista', 'LoreViolin', 'AleAstronomia', 'NatiPortugues', 'ClaudiaJardin', 'AdrianHistoria', 'MonicaTejido', 'FabianBonsai', 'NoraCocina', 'LeandroRemo', 'SoleBordado', 'EzeAleman', 'AgustinaTenis', 'EduSudoku', 'PatriLectura', 'RodriTrekking', 'CrisRelojeria', 'ViviOrigami', 'DamianLatin'],
}
