import { callGemini, extractGeminiText } from "./generate-flashcards.mjs";

const MAX_TOPIC_LENGTH = 240;
const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const OPENALEX_BASE = "https://api.openalex.org";
const MESH_LOOKUP_BASE = "https://id.nlm.nih.gov/mesh/lookup";
const MESH_SPARQL_URL = "https://id.nlm.nih.gov/mesh/sparql";
const MESH_FETCH_TIMEOUT_MS = 4_500;
const GOVBR_SEARCH_URL = "https://www.gov.br/pt-br/search";
const GOVBR_PCDT_CATALOG_URL = "https://www.gov.br/conitec/pt-br/assuntos/avaliacao-de-tecnologias-em-saude/protocolos-clinicos-e-diretrizes-terapeuticas/pcdt";
const AMB_SOCIETY_DIRECTORY_URL = "https://amb.org.br/filiadas-3/sociedades-de-especialidade-contatos/";

// Registro genérico de sociedades de especialidade brasileiras. A lista é derivada do
// diretório de Sociedades de Especialidade da Associação Médica Brasileira (AMB) e serve
// como uma camada de autoridade por ESPECIALIDADE, nunca por uma doença/deck específico.
// O algoritmo pode ativar mais de uma sociedade para temas multidisciplinares.
const MEDICAL_SPECIALTY_AUTHORITIES = [
  { key: "acupuntura", specialty: "Acupuntura", name: "Colégio Médico Brasileiro de Acupuntura (CMBA)", domain: "cmba.org.br", baseUrl: "https://cmba.org.br/", signals: ["acupuntura", "agulhamento"] },
  { key: "alergia_imunologia", specialty: "Alergia e Imunologia", name: "Associação Brasileira de Alergia e Imunologia (ASBAI)", domain: "asbai.org.br", baseUrl: "https://asbai.org.br/", signals: ["alergia", "alergico", "anafilax", "imunodefic", "imunologia", "rinite alerg", "asma alerg", "urticaria", "angioedema"] },
  { key: "anestesiologia", specialty: "Anestesiologia", name: "Sociedade Brasileira de Anestesiologia (SBA)", domain: "sbahq.org", baseUrl: "https://www.sbahq.org/", signals: ["anestesia", "anestesiologia", "sedacao", "perioperatorio", "perioperat", "bloqueio regional"] },
  { key: "angiologia_vascular", specialty: "Angiologia e Cirurgia Vascular", name: "Sociedade Brasileira de Angiologia e de Cirurgia Vascular (SBACV)", domain: "sbacv.org.br", baseUrl: "https://sbacv.org.br/", signals: ["vascular", "arterial", "venosa", "trombose", "tromboembol", "varizes", "aneurisma", "isquemia de membro", "pe diabetico", "ulcera venosa"] },
  { key: "cardiologia", specialty: "Cardiologia", name: "Sociedade Brasileira de Cardiologia (SBC)", domain: "cardiol.br", baseUrl: "https://www.portal.cardiol.br/", signals: ["cardio", "coracao", "cardiaca", "cardiaco", "insuficiencia cardiaca", "hipertensao", "arritmia", "fibrilacao atrial", "infarto", "sindrome coronar", "valvopatia", "miocardi", "endocardite"] },
  { key: "cirurgia_cardiovascular", specialty: "Cirurgia Cardiovascular", name: "Sociedade Brasileira de Cirurgia Cardiovascular (SBCCV)", domain: "sbccv.org.br", baseUrl: "https://sbccv.org.br/", signals: ["cirurgia cardiovascular", "revascularizacao miocardica", "cirurgia valvar", "cirurgia aorta", "transplante cardiaco"] },
  { key: "cirurgia_mao", specialty: "Cirurgia da Mão", name: "Sociedade Brasileira de Cirurgia da Mão (SBCM)", domain: "cirurgiadamao.org.br", baseUrl: "https://www.cirurgiadamao.org.br/", signals: ["mao", "punho", "tunel do carpo", "tendao flexor", "tendao extensor"] },
  { key: "cirurgia_cabeca_pescoco", specialty: "Cirurgia de Cabeça e Pescoço", name: "Sociedade Brasileira de Cirurgia de Cabeça e Pescoço (SBCCP)", domain: "sbccp.org.br", baseUrl: "https://sbccp.org.br/", signals: ["cabeca e pescoco", "tireoide cirurgia", "paratireoide", "cancer de laringe", "tumor cervical"] },
  { key: "cirurgia_digestiva", specialty: "Cirurgia do Aparelho Digestivo", name: "Colégio Brasileiro de Cirurgia Digestiva (CBCD)", domain: "cbcd.org.br", baseUrl: "https://cbcd.org.br/", signals: ["cirurgia digestiva", "cirurgia bariatrica", "colecistectomia", "hernia hiatal", "cirurgia gastrica", "cirurgia hepatobiliar"] },
  { key: "cirurgia_geral", specialty: "Cirurgia Geral", name: "Colégio Brasileiro de Cirurgiões (CBC)", domain: "cbc.org.br", baseUrl: "https://cbc.org.br/", signals: ["cirurgia geral", "abdome agudo", "apendicite", "hernia", "trauma abdominal", "pos operatorio"] },
  { key: "cirurgia_oncologica", specialty: "Cirurgia Oncológica", name: "Sociedade Brasileira de Cirurgia Oncológica (SBCO)", domain: "sbco.org.br", baseUrl: "https://sbco.org.br/", signals: ["cirurgia oncologica", "ressecao oncologica", "cancer cirurgia", "tumor solido cirurgia"] },
  { key: "cirurgia_pediatrica", specialty: "Cirurgia Pediátrica", name: "Associação Brasileira de Cirurgia Pediátrica (CIPE)", domain: "cipe.org.br", baseUrl: "https://cipe.org.br/", signals: ["cirurgia pediatrica", "malformacao cirurgica crianca", "hernia infantil"] },
  { key: "cirurgia_plastica", specialty: "Cirurgia Plástica", name: "Sociedade Brasileira de Cirurgia Plástica (SBCP)", domain: "cirurgiaplastica.org.br", baseUrl: "https://www.cirurgiaplastica.org.br/", signals: ["cirurgia plastica", "reconstrucao", "queimadura cirurgia", "mamoplastia", "abdominoplastia"] },
  { key: "cirurgia_toracica", specialty: "Cirurgia Torácica", name: "Sociedade Brasileira de Cirurgia Torácica (SBCT)", domain: "sbct.com.br", baseUrl: "https://www.sbct.com.br/", signals: ["cirurgia toracica", "toracotomia", "videotoracoscopia", "resseccao pulmonar"] },
  { key: "clinica_medica", specialty: "Clínica Médica", name: "Sociedade Brasileira de Clínica Médica (SBCM)", domain: "sbcm.org.br", baseUrl: "https://sbcm.org.br/", signals: ["clinica medica", "medicina interna", "multimorbidade"] },
  { key: "coloproctologia", specialty: "Coloproctologia", name: "Sociedade Brasileira de Coloproctologia (SBCP)", domain: "sbcp.org.br", baseUrl: "https://sbcp.org.br/", signals: ["coloprocto", "retal", "reto", "colon", "hemorroid", "fissura anal", "doenca inflamatoria intestinal cirurgia"] },
  { key: "dermatologia", specialty: "Dermatologia", name: "Sociedade Brasileira de Dermatologia (SBD)", domain: "sbd.org.br", baseUrl: "https://www.sbd.org.br/", signals: ["dermat", "eczema", "psoria", "urticaria", "melasma", "acne", "pele", "cutane", "alopecia", "vitiligo", "hidradenite"] },
  { key: "endocrinologia", specialty: "Endocrinologia e Metabologia", name: "Sociedade Brasileira de Endocrinologia e Metabologia (SBEM)", domain: "endocrino.org.br", baseUrl: "https://www.endocrino.org.br/", signals: ["endocrino", "diabet", "diabetes", "tireoide", "hipotire", "hipertire", "adrenal", "hipofise", "osteoporose", "obesidade", "metabol"] },
  { key: "endoscopia", specialty: "Endoscopia", name: "Sociedade Brasileira de Endoscopia Digestiva (SOBED)", domain: "sobed.org.br", baseUrl: "https://www.sobed.org.br/", signals: ["endoscopia", "colonoscopia", "cpRE", "ecoendoscopia", "endoscopica"] },
  { key: "gastroenterologia", specialty: "Gastroenterologia", name: "Federação Brasileira de Gastroenterologia (FBG)", domain: "fbg.org.br", baseUrl: "https://fbg.org.br/", signals: ["gastro", "esofag", "gastr", "duoden", "intestin", "hepat", "cirrose", "pancreat", "doenca inflamatoria intestinal", "crohn", "retocolite"] },
  { key: "genetica", specialty: "Genética Médica", name: "Sociedade Brasileira de Genética Médica e Genômica (SBGM)", domain: "sbgm.org.br", baseUrl: "https://sbgm.org.br/", signals: ["genetica", "genomica", "heredit", "cromossom", "sindrome genetica", "erro inato"] },
  { key: "geriatria", specialty: "Geriatria", name: "Sociedade Brasileira de Geriatria e Gerontologia (SBGG)", domain: "sbgg.org.br", baseUrl: "https://sbgg.org.br/", signals: ["geriatr", "idoso", "idosa", "idosos", "longevidade", "fragilidade", "demencia no idoso"] },
  { key: "ginecologia_obstetricia", specialty: "Ginecologia e Obstetrícia", name: "Federação Brasileira das Associações de Ginecologia e Obstetrícia (FEBRASGO)", domain: "febrasgo.org.br", baseUrl: "https://www.febrasgo.org.br/", signals: ["gineco", "obstetr", "gestacao", "gestante", "gravidez", "parto", "puerper", "endometriose", "ovario", "uter", "colo do utero", "menopausa", "contracep"] },
  { key: "hematologia", specialty: "Hematologia e Hemoterapia", name: "Associação Brasileira de Hematologia, Hemoterapia e Terapia Celular (ABHH)", domain: "abhh.org.br", baseUrl: "https://abhh.org.br/", signals: ["hematolog", "anemia", "leucemia", "linfoma", "mieloma", "hemofilia", "trombocit", "neutropenia", "transfus", "medula ossea"] },
  { key: "homeopatia", specialty: "Homeopatia", name: "Associação Médica Homeopática Brasileira (AMHB)", domain: "amhb.org.br", baseUrl: "https://amhb.org.br/", signals: ["homeopatia", "homeopatico"] },
  { key: "infectologia", specialty: "Infectologia", name: "Sociedade Brasileira de Infectologia (SBI)", domain: "infectologia.org.br", baseUrl: "https://infectologia.org.br/", signals: ["infect", "infecc", "infection", "infectious", "sepse", "hiv", "aids", "tuberculose", "dengue", "malaria", "meningite", "antimicrob", "antibiot", "hepatite viral", "covid", "respiratory tract infection", "upper respiratory tract infection", "lower respiratory tract infection"] },
  { key: "mastologia", specialty: "Mastologia", name: "Sociedade Brasileira de Mastologia (SBM)", domain: "sbmastologia.com.br", baseUrl: "https://www.sbmastologia.com.br/", signals: ["mama", "mamario", "mamaria", "mastologia", "cancer de mama", "nodulo mamario"] },
  { key: "emergencia", specialty: "Medicina de Emergência", name: "Associação Brasileira de Medicina de Emergência (ABRAMEDE)", domain: "abramede.com.br", baseUrl: "https://abramede.com.br/", signals: ["emergencia", "urgencia", "choque", "parada cardiorrespiratoria", "ressuscitacao", "trauma", "intoxicacao aguda", "sepse"] },
  { key: "familia_comunidade", specialty: "Medicina de Família e Comunidade", name: "Sociedade Brasileira de Medicina de Família e Comunidade (SBMFC)", domain: "sbmfc.org.br", baseUrl: "https://sbmfc.org.br/", signals: ["atencao primaria", "medicina de familia", "saude da familia", "aps", "rastreamento", "prevencao primaria"] },
  { key: "trabalho", specialty: "Medicina do Trabalho", name: "Associação Nacional de Medicina do Trabalho (ANAMT)", domain: "anamt.org.br", baseUrl: "https://www.anamt.org.br/portal/", signals: ["ocupacional", "trabalho", "trabalhador", "doenca ocupacional", "acidente de trabalho"] },
  { key: "trafego", specialty: "Medicina do Tráfego", name: "Associação Brasileira de Medicina do Tráfego (ABRAMET)", domain: "abramet.com.br", baseUrl: "https://abramet.com.br/", signals: ["trafego", "transito", "condutor", "direcao veicular"] },
  { key: "esportiva", specialty: "Medicina Esportiva", name: "Sociedade Brasileira de Medicina do Exercício e do Esporte (SBMEE)", domain: "medicinadoesporte.org.br", baseUrl: "https://www.medicinadoesporte.org.br/", signals: ["esporte", "exercicio", "atleta", "lesao esportiva", "performance"] },
  { key: "reabilitacao", specialty: "Medicina Física e Reabilitação", name: "Associação Brasileira de Medicina Física e Reabilitação (ABMFR)", domain: "abmfr.com.br", baseUrl: "https://www.abmfr.com.br/", signals: ["reabilitacao", "fisiatria", "espasticidade", "incapacidade funcional", "proteses e orteses"] },
  { key: "intensiva", specialty: "Medicina Intensiva", name: "Associação de Medicina Intensiva Brasileira (AMIB)", domain: "amib.org.br", baseUrl: "https://www.amib.org.br/", signals: ["intensiva", "uti", "criticamente enfermo", "ventilacao mecanica", "choque", "sepse", "sedacao em uti", "delirium em uti"] },
  { key: "legal_pericia", specialty: "Medicina Legal e Perícia Médica", name: "Associação Brasileira de Medicina Legal e Perícia Médica (ABMLPM)", domain: "abmlpm.org.br", baseUrl: "https://abmlpm.org.br/", signals: ["medicina legal", "pericia medica", "pericial", "incapacidade laboral", "necropsia medico legal"] },
  { key: "nuclear", specialty: "Medicina Nuclear", name: "Sociedade Brasileira de Medicina Nuclear (SBMN)", domain: "sbmn.org.br", baseUrl: "https://sbmn.org.br/", signals: ["medicina nuclear", "pet ct", "cintilografia", "radiofarmaco"] },
  { key: "preventiva", specialty: "Medicina Preventiva e Social", name: "Associação Brasileira de Medicina Preventiva e Administração em Saúde (ABRAMPAS)", domain: "abrampas.org.br", baseUrl: "https://abrampas.org.br/", signals: ["saude publica", "epidemiologia", "prevencao", "vigilancia em saude", "saude coletiva", "gestao em saude"] },
  { key: "nefrologia", specialty: "Nefrologia", name: "Sociedade Brasileira de Nefrologia (SBN)", domain: "sbn.org.br", baseUrl: "https://www.sbn.org.br/", signals: ["nefro", "renal", "rim", "rins", "dialise", "hemodialise", "glomerul", "proteinuria", "doenca renal", "transplante renal"] },
  { key: "neurocirurgia", specialty: "Neurocirurgia", name: "Sociedade Brasileira de Neurocirurgia (SBN)", domain: "portalsbn.org", baseUrl: "https://www.portalsbn.org/", signals: ["neurocirurgia", "tumor cerebral cirurgia", "aneurisma cerebral cirurgia", "hidrocefalia", "coluna neurocirurgia"] },
  { key: "neurologia", specialty: "Neurologia", name: "Academia Brasileira de Neurologia (ABN)", domain: "abneuro.org.br", baseUrl: "https://abneuro.org.br/", signals: ["neuro", "avc", "acidente vascular cerebral", "epileps", "parkinson", "alzheimer", "demencia", "cefaleia", "enxaqueca", "esclerose multipla", "neuropatia", "miastenia"] },
  { key: "nutrologia", specialty: "Nutrologia", name: "Associação Brasileira de Nutrologia (ABRAN)", domain: "abran.org.br", baseUrl: "https://abran.org.br/", signals: ["nutrologia", "desnutricao", "terapia nutricional", "nutricao clinica", "deficiencia nutricional"] },
  { key: "oftalmologia", specialty: "Oftalmologia", name: "Conselho Brasileiro de Oftalmologia (CBO)", domain: "cbo.com.br", baseUrl: "https://www.cbo.com.br/", signals: ["oftalmo", "ocular", "olho", "retina", "glaucoma", "catarata", "uveite", "cornea", "acuidade visual"] },
  { key: "oncologia", specialty: "Oncologia Clínica", name: "Sociedade Brasileira de Oncologia Clínica (SBOC)", domain: "sboc.org.br", baseUrl: "https://sboc.org.br/", signals: ["oncolog", "cancer", "carcinoma", "neoplasia", "tumor maligno", "quimioterapia", "imunoterapia oncologica"] },
  { key: "ortopedia", specialty: "Ortopedia e Traumatologia", name: "Sociedade Brasileira de Ortopedia e Traumatologia (SBOT)", domain: "sbot.org.br", baseUrl: "https://sbot.org.br/", signals: ["ortoped", "fratura", "luxacao", "joelho", "quadril", "ombro", "coluna", "ligamento", "menisco", "trauma musculoesqueletico"] },
  { key: "otorrino", specialty: "Otorrinolaringologia", name: "Associação Brasileira de Otorrinolaringologia e Cirurgia Cérvico-Facial (ABORL-CCF)", domain: "aborlccf.org.br", baseUrl: "https://aborlccf.org.br/", signals: ["otorrino", "otite", "sinusite", "rinossinusite", "amigdal", "faringite", "faringotonsilite", "tonsilite", "rinofaringite", "nasofaringite", "resfriado", "laringe", "surdez", "vertigem", "tontura", "audiometria", "vias aereas superiores", "via aerea superior", "trato respiratorio superior", "upper respiratory", "upper airway", "pharyngitis", "tonsillitis", "rhinosinusitis", "sinusitis", "otitis", "common cold"] },
  { key: "patologia", specialty: "Patologia", name: "Sociedade Brasileira de Patologia (SBP)", domain: "sbp.org.br", baseUrl: "https://www.sbp.org.br/", signals: ["patologia", "histopatologia", "biopsia", "imuno histoquimica", "anatomopatologico"] },
  { key: "patologia_clinica", specialty: "Patologia Clínica / Medicina Laboratorial", name: "Sociedade Brasileira de Patologia Clínica e Medicina Laboratorial (SBPC/ML)", domain: "sbpc.org.br", baseUrl: "https://www.sbpc.org.br/pt/", signals: ["laboratorial", "exame laboratorial", "biomarcador", "hemograma", "bioquimica clinica", "patologia clinica"] },
  { key: "pediatria", specialty: "Pediatria", name: "Sociedade Brasileira de Pediatria (SBP)", domain: "sbp.com.br", baseUrl: "https://www.sbp.com.br/", signals: ["pediatr", "crianca", "criancas", "infancia", "infantil", "lactente", "neonato", "recem nascido", "adolescente"] },
  { key: "pneumologia", specialty: "Pneumologia", name: "Sociedade Brasileira de Pneumologia e Tisiologia (SBPT)", domain: "sbpt.org.br", baseUrl: "https://sbpt.org.br/portal/", signals: ["pneumo", "pulmao", "pulmonar", "respirator", "respiratory", "vias aereas", "airway", "asma", "dpoc", "pneumonia", "bronqu", "fibrose pulmonar", "embolia pulmonar", "tuberculose"] },
  { key: "psiquiatria", specialty: "Psiquiatria", name: "Associação Brasileira de Psiquiatria (ABP)", domain: "abp.org.br", baseUrl: "https://www.abp.org.br/", signals: ["psiquiatr", "depress", "ansiedade", "transtorno bipolar", "esquizofrenia", "suicid", "tdah", "autismo", "dependencia quimica"] },
  { key: "radiologia", specialty: "Radiologia e Diagnóstico por Imagem", name: "Colégio Brasileiro de Radiologia e Diagnóstico por Imagem (CBR)", domain: "cbr.org.br", baseUrl: "https://cbr.org.br/", signals: ["radiologia", "imagem", "tomografia", "ressonancia", "ultrassom", "mamografia", "radiografia"] },
  { key: "radioterapia", specialty: "Radioterapia", name: "Sociedade Brasileira de Radioterapia (SBRT)", domain: "sbradioterapia.com.br", baseUrl: "https://sbradioterapia.com.br/", signals: ["radioterapia", "radiocirurgia", "irradiacao oncologica"] },
  { key: "reumatologia", specialty: "Reumatologia", name: "Sociedade Brasileira de Reumatologia (SBR)", domain: "reumatologia.org.br", baseUrl: "https://www.reumatologia.org.br/", signals: ["reumato", "artrite", "lupus", "vasculite", "espondil", "fibromialgia", "sjogren", "antifosfolip", "esclerodermia", "gota"] },
  { key: "urologia", specialty: "Urologia", name: "Sociedade Brasileira de Urologia (SBU)", domain: "portaldaurologia.org.br", baseUrl: "https://portaldaurologia.org.br/", signals: ["uro", "prostata", "prostatic", "bexiga", "rim calculo", "litíase", "litias", "incontinencia urinaria", "disfuncao eretil", "cancer renal", "cancer de prostata"] },
];

const MEDICAL_SPECIALTY_BY_KEY = new Map(MEDICAL_SPECIALTY_AUTHORITIES.map((item) => [item.key, { ...item }]));

function registeredMedicalAuthorities() {
  return Array.from(MEDICAL_SPECIALTY_BY_KEY.values());
}

function registeredMedicalSocietyDomains() {
  return Array.from(new Set(registeredMedicalAuthorities().map((item) => String(item.domain || "").toLowerCase()).filter(Boolean)));
}
const OFFICIAL_FETCH_TIMEOUT_MS = 8_000;
const OFFICIAL_MAX_HTML_BYTES = 2_000_000;

// Páginas que podem ajudar a DESCOBRIR documentos, mas não devem virar evidência final.
// Isso evita transformar resultado de busca, categoria, evento ou notícia em "diretriz" só
// porque a palavra do tema aparece em menus, tags ou metadados periféricos.
const OFFICIAL_DISCOVERY_ONLY_PATH_PATTERNS = [
  /\/search(?:\/|$)/i,
  /\/busca(?:\/|$)/i,
  /\/category(?:\/|$)/i,
  /\/categoria(?:\/|$)/i,
  /\/tag(?:\/|$)/i,
  /\/tags(?:\/|$)/i,
  /\/evento(?:s)?(?:\/|$)/i,
  /\/agenda(?:\/|$)/i,
  /\/noticias?(?:\/|$)/i,
  /\/campanhas?(?:\/|$)/i,
];

const OFFICIAL_HARD_REJECT_PATH_PATTERNS = [
  /\/login(?:\/|$)/i,
  /\/acesso-a-informacao(?:\/|$)/i,
  /\/institucional(?:\/|$)/i,
  /\/fale-conosco(?:\/|$)/i,
  /\/licitacoes?(?:\/|$)/i,
];

const SEARCH_MODELS = Array.from(new Set([
  process.env.GEMINI_RESEARCH_MODEL,
  process.env.GEMINI_FLASHCARD_CLINICAL_MODEL,
  "gemini-3.6-flash",
  process.env.GEMINI_FLASHCARD_FAST_MODEL,
  "gemini-3.5-flash-lite",
].filter(Boolean)));

const NORMALIZATION_MODELS = Array.from(new Set([
  process.env.GEMINI_FLASHCARD_FAST_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
].filter(Boolean)));

const BLOCKED_HOSTS = [
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "wikipedia.org",
  "reddit.com",
  "pinterest.com",
  "quora.com",
];

const HIGH_TRUST_HOST_PATTERNS = [
  /(^|\.)gov\.br$/i,
  /(^|\.)bvsalud\.org$/i,
  /(^|\.)scielo\.br$/i,
  /(^|\.)scielo\.org$/i,
  /(^|\.)paho\.org$/i,
  /(^|\.)who\.int$/i,
  /(^|\.)ncbi\.nlm\.nih\.gov$/i,
  /(^|\.)pubmed\.ncbi\.nlm\.nih\.gov$/i,
  /(^|\.)cochranelibrary\.com$/i,
  /(^|\.)nice\.org\.uk$/i,
  /(^|\.)cdc\.gov$/i,
  /(^|\.)nih\.gov$/i,
  /(^|\.)aad\.org$/i,
  /(^|\.)acc\.org$/i,
  /(^|\.)heart\.org$/i,
  /(^|\.)escardio\.org$/i,
  /(^|\.)eular\.org$/i,
];

const GOVERNMENT_HOST_PATTERNS = [/(^|\.)gov\.br$/i, /(^|\.)cdc\.gov$/i, /(^|\.)nih\.gov$/i];
const MEDICAL_SOCIETY_HOST_PATTERNS = [
  /(^|\.)aad\.org$/i,
  /(^|\.)acc\.org$/i,
  /(^|\.)heart\.org$/i,
  /(^|\.)escardio\.org$/i,
  /(^|\.)eular\.org$/i,
];
const INTERNATIONAL_AUTHORITY_HOST_PATTERNS = [/(^|\.)who\.int$/i, /(^|\.)paho\.org$/i, /(^|\.)nice\.org\.uk$/i];
const EVIDENCE_SYNTHESIS_HOST_PATTERNS = [/(^|\.)cochranelibrary\.com$/i];

const EVIDENCE_SCORES = {
  guideline: 100,
  consensus: 95,
  official_document: 78,
  meta_analysis: 91,
  systematic_review: 89,
  review: 73,
  clinical_trial: 69,
  observational: 56,
  other: 45,
};

const BREADTH_IGNORED_WORDS = new Set([
  "ampla", "amplo", "abordagem", "bibliografica", "bibliografico", "literatura", "narrativa", "narrativo",
  "integrativa", "integrativo", "sistematica", "sistematico", "meta", "analise", "atual", "atuais", "atualizacao",
  "atualizacoes", "novos", "novas", "avanco", "avancos", "estado", "arte", "overview", "update", "updates",
  "current", "advances", "literature", "narrative", "systematic", "integrative", "meta", "analysis", "overview",
  "evidencias", "evidence", "clinical", "clinica", "clinico", "practice", "recommendations", "recomendacoes",
  "diagnostico", "diagnosis", "avaliacao", "evaluation", "assessment", "tratamento", "treatment", "manejo", "management", "terapia", "therapy", "guideline",
  "guidelines", "diretriz", "diretrizes", "consenso", "consensus", "protocolo", "protocol", "review", "revisao",
  "pcdt", "pdf", "documento", "document", "oficial", "official", "resumido", "resumida",
]);

const CLINICAL_SCOPE_DOMAINS = [
  ["epidemiologia", "epidemiology", "prevalencia", "prevalence", "incidencia", "incidence"],
  ["fisiopatologia", "pathophysiology", "patogenese", "pathogenesis", "imunologia", "immunology"],
  ["manifestacoes", "manifestation", "manifestations", "sintomas", "symptoms", "clinical features", "apresentacao"],
  ["diagnostico", "diagnosis", "diagnostic", "criterios", "criteria"],
  ["tratamento", "treatment", "manejo", "management", "terapia", "therapy", "therapeutic"],
  ["prognostico", "prognosis", "prevencao", "prevention", "seguimento", "follow up", "quality of life", "qualidade de vida"],
];

const SOURCE_SCHEMA = {
  type: "object",
  properties: {
    normalizedTopic: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          institution: { type: "string" },
          sourceType: {
            type: "string",
            enum: [
              "guideline",
              "consensus",
              "official_document",
              "systematic_review",
              "meta_analysis",
              "review",
              "clinical_trial",
              "observational",
              "other",
            ],
          },
          credibility: {
            type: "string",
            enum: ["government", "medical_society", "evidence_synthesis", "peer_reviewed", "international_authority"],
          },
          language: { type: "string" },
          country: { type: "string" },
          year: { type: "integer" },
          summary: { type: "string" },
          whyRelevant: { type: "string" },
        },
        required: ["title", "url", "institution", "sourceType", "credibility", "language", "country", "summary", "whyRelevant"],
      },
    },
  },
  required: ["normalizedTopic", "sources"],
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function clean(value, max = 600) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function verifyFirebaseUser(idToken) {
  const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!firebaseApiKey) return false;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) return false;
  const data = await response.json();
  return Array.isArray(data.users) && data.users.length > 0;
}

function parseJsonObject(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function isBlockedUrl(url) {
  const host = hostnameOf(url);
  if (!host) return true;
  return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function isKnownMedicalSocietyHost(host) {
  const value = String(host || "").toLowerCase().replace(/^www\./, "");
  return registeredMedicalSocietyDomains().some((domain) => value === domain || value.endsWith(`.${domain}`));
}

function medicalSocietyAuthorityForUrl(url) {
  const host = hostnameOf(url).replace(/^www\./, "");
  if (!host) return null;
  return registeredMedicalAuthorities().find((authority) => host === authority.domain || host.endsWith(`.${authority.domain}`)) || null;
}

function isHighTrustDomain(url) {
  const host = hostnameOf(url);
  return Boolean(host && (HIGH_TRUST_HOST_PATTERNS.some((pattern) => pattern.test(host)) || isKnownMedicalSocietyHost(host)));
}

function isPortuguese(language, country, url) {
  const lang = String(language || "").toLowerCase();
  const c = String(country || "").toLowerCase();
  const host = hostnameOf(url);
  return lang.startsWith("pt") || lang.includes("portugu") || c.includes("brasil") || c === "br" || host.endsWith(".br");
}

function isPdfUrl(url) {
  try {
    const parsed = new URL(url);
    return /\.pdf(?:$|\/)/i.test(parsed.pathname) || /(?:download|display-file)\/file$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function detectLanguageFromText(text, declaredLanguage = "") {
  const normalized = ` ${normalizeMedicalText(text)} `;
  const declared = String(declaredLanguage || "").toLowerCase();
  const englishSignals = [" the ", " of ", " and ", " with ", " for ", " in ", " adults ", " review ", " treatment ", " guideline "];
  const portugueseSignals = [" de ", " da ", " do ", " e ", " com ", " para ", " em ", " adultos ", " revisao ", " tratamento ", " diretriz "];
  const en = englishSignals.reduce((sum, token) => sum + (normalized.includes(token) ? 1 : 0), 0);
  const pt = portugueseSignals.reduce((sum, token) => sum + (normalized.includes(token) ? 1 : 0), 0);
  if (en >= 4 && en >= pt + 2) return "Inglês";
  if (pt >= 4 && pt >= en + 2) return "Português";
  if (declared === "pt" || declared.startsWith("pt-") || declared.includes("portugu")) return "Português";
  if (declared === "en" || declared.startsWith("en-") || declared.includes("ingl") || declared.includes("english")) return "Inglês";
  return clean(declaredLanguage, 40) || "Não informado";
}

// Filtro temático determinístico: evita que resultados semanticamente próximos, mas
// clinicamente fora do tema/população, entrem na base documental. Ele não depende
// do Gemini e continua funcionando no fallback gratuito (OpenAlex/PubMed).
const TOPIC_STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos",
  "e", "ou", "em", "no", "na", "nos", "nas", "para", "por", "com", "sem", "sobre",
  "entre", "ao", "aos", "the", "a", "an", "of", "and", "or", "in", "on", "for", "with",
  "without", "among", "to", "from", "by",
]);

const GENERIC_TOPIC_WORDS = new Set([
  "tratamento", "tratar", "manejo", "abordagem", "terapia", "terapeutica", "diagnostico",
  "diagnostica", "diagnosticar", "atualizacao", "atualizacoes", "revisao", "revisoes",
  "estudo", "estudos", "evidencia", "evidencias", "diretriz", "diretrizes", "guideline",
  "guidelines", "consenso", "consensus", "management", "treatment", "therapy", "diagnosis",
  "diagnostic", "review", "reviews", "update", "updates", "study", "studies", "evidence",
  "clinico", "clinica", "clinical", "medico", "medica", "medical", "fator", "fatores",
  "factor", "factors", "risco", "riscos", "risk", "prevention", "prevencao",
]);

// Termos genéricos usados pelo motor semântico. Eles não descrevem uma doença específica;
// servem apenas para impedir que palavras metodológicas/editoriais dominem a expansão.
const SEMANTIC_GENERIC_WORDS = new Set([
  ...GENERIC_TOPIC_WORDS,
  "doenca", "doencas", "disease", "diseases", "sindrome", "syndrome", "condicao", "condition",
  "paciente", "pacientes", "patient", "patients", "saude", "health", "medicine", "medicina",
  "resultados", "results", "avaliacao", "evaluation", "analise", "analysis", "clinical", "clinica",
  "literature", "bibliografica", "bibliografico", "integrativa", "integrative", "narrative", "narrativa",
  "introducao", "objetivo", "objetivos", "metodologia", "metodo", "metodos", "discussao", "conclusao",
  "introduction", "objective", "objectives", "methods", "methodology", "discussion", "conclusion",
  // Classes biomédicas amplas não podem, sozinhas, provar uma relação entre duas doenças.
  // Mantemos esta lista curta e ontológica (não doença->doença) para impedir colisões como
  // "anticorpos" ou "células" virarem pontes semânticas perfeitas.
  "anticorpo", "anticorpos", "antibody", "antibodies",
  "celula", "celulas", "cell", "cells",
  "proteina", "proteinas", "protein", "proteins",
  "gene", "genes", "receptor", "receptores", "receptors",
  "pathway", "pathways", "via", "vias",
  "mecanismo", "mecanismos", "mechanism", "mechanisms",
  "marcador", "marcadores", "marker", "markers",
]);

const OFFICIAL_PUBLIC_EDUCATION_PATTERNS = [
  /\bpublico\b/i, /\bpara pacientes?\b/i, /\bperguntas frequentes\b/i,
  /\bconecta(?: mais)?\b/i, /\bexplica\b/i, /\beducacao em saude\b/i,
];

// Conteúdos institucionais que podem ajudar a DESCOBRIR documentos, mas nunca devem
// competir como evidência clínica final. A checagem usa título + resumo + URL, não só path,
// porque muitos sites de sociedades publicam eventos/notícias em rotas neutras.
const OFFICIAL_NON_DOCUMENT_PATTERNS = [
  /\bnoticia[s]?\b/i, /\bna midia\b/i, /\bmidia\b/i, /\bpodcast\b/i, /\bvideo\b/i,
  /\bcampanha\b/i, /\bentrevista\b/i, /\bcarta conjunta\b/i, /\bcomunicado\b/i,
  /\bimprensa\b/i, /\bevento[s]?\b/i, /\bsimposio\b/i, /\bcongresso\b/i,
  /\bjornada\b/i, /\bwebinar\b/i, /\bcurso[s]?\b/i, /\binscricao\b/i,
  /\bworkshop\b/i, /\bseminario\b/i, /\bagenda\b/i, /\baula aberta\b/i,
];

const STRONG_CLINICAL_DOCUMENT_PATTERNS = [
  /\bpcdt\b/i, /\bprotocolo clinico\b/i, /\bdiretriz(?:es)?\b/i, /\bguideline[s]?\b/i,
  /\bconsenso\b/i, /\bconsensus\b/i, /\bposition statement\b/i, /\bposicionamento\b/i,
  /\brecomendacoes? clinicas?\b/i, /\bclinical practice guideline\b/i, /\bpractice guideline\b/i,
];

const POPULATION_TERMS = {
  adult: ["adulto", "adultos", "adulta", "adultas", "adult", "adults", "adulthood"],
  child: ["crianca", "criancas", "infancia", "infantil", "pediatrico", "pediatrica", "pediatric", "paediatric", "child", "children", "childhood"],
  adolescent: ["adolescente", "adolescentes", "adolescencia", "adolescent", "adolescents", "teen", "teenager"],
  elderly: ["idoso", "idosos", "idosa", "idosas", "geriatrico", "geriatrica", "elderly", "older", "geriatric"],
  pregnant: ["gestante", "gestantes", "gravida", "gravidas", "gestacao", "gravidez", "gestacional", "gestacionais", "obstetrica", "obstetrico", "pregnant", "pregnancy", "gestation", "gestational", "obstetric"],
};

const ALL_POPULATION_WORDS = new Set(Object.values(POPULATION_TERMS).flat());
const ANIMAL_TERMS = [
  "cao", "caes", "canino", "canina", "cachorro", "cachorros", "gato", "gatos", "felino", "felina",
  "veterinario", "veterinaria", "veterinary", "dog", "dogs", "canine", "cat", "cats", "feline",
  "equino", "equina", "equine", "bovino", "bovina", "bovine", "suino", "suina", "porcine",
];

function normalizeMedicalText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalização leve de cognatos médicos greco-latinos entre português/inglês.
// Não traduz doenças e não contém dicionário de diagnósticos: apenas aproxima grafias
// como thrombophilia↔trombofilia e phospholipid↔fosfolipid para a ponte semântica.
function normalizeMedicalCognate(value) {
  return normalizeMedicalText(value)
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/ch/g, "c")
    .replace(/y/g, "i")
    .replace(/ae/g, "e")
    .replace(/oe/g, "e")
    .replace(/ck/g, "c")
    .split(" ")
    .map((token) => token.length >= 6 ? token.replace(/(?:es|os|as|us|um|a|o|e)$/g, "") : token)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalTopicTokens(value, { keepPopulation = false } = {}) {
  return uniqueWords(normalizeMedicalText(value).split(" ").filter((word) => {
    if (!word || TOPIC_STOPWORDS.has(word)) return false;
    if (!keepPopulation && ALL_POPULATION_WORDS.has(word)) return false;
    if (GENERIC_TOPIC_WORDS.has(word)) return false;
    return /^[0-9]+$/.test(word) ? false : word.length >= 3;
  }));
}

function orderedTokenMatch(text, tokens) {
  if (!tokens.length) return false;
  const words = normalizeMedicalText(text).split(" ").filter((word) => !TOPIC_STOPWORDS.has(word));
  let cursor = 0;
  for (const word of words) {
    if (word === tokens[cursor]) cursor += 1;
    if (cursor >= tokens.length) return true;
  }
  return false;
}

function semanticPhraseTokens(value) {
  return uniqueWords(normalizeMedicalCognate(value).split(" ").filter((word) =>
    word.length >= 4 && !TOPIC_STOPWORDS.has(word) && !SEMANTIC_GENERIC_WORDS.has(word)));
}

function cognateTokenCoverageDetails(text, phrase) {
  const textTokens = new Set(normalizeMedicalCognate(text).split(" ").filter(Boolean));
  const phraseTokens = semanticPhraseTokens(phrase);
  if (!phraseTokens.length) return { coverage: 0, hits: 0, tokenCount: 0, matchedTokens: [] };
  const matchedTokens = phraseTokens.filter((token) => textTokens.has(token));
  return {
    coverage: matchedTokens.length / phraseTokens.length,
    hits: matchedTokens.length,
    tokenCount: phraseTokens.length,
    matchedTokens,
  };
}

function cognateTokenCoverage(text, phrase) {
  return cognateTokenCoverageDetails(text, phrase).coverage;
}

function uniqueWords(words) {
  return Array.from(new Set(words.filter(Boolean)));
}

function detectPopulations(text) {
  const normalized = normalizeMedicalText(text);
  const words = new Set(normalized.split(" ").filter(Boolean));
  const found = new Set();
  for (const [population, terms] of Object.entries(POPULATION_TERMS)) {
    if (terms.some((term) => words.has(term))) found.add(population);
  }
  return found;
}

function buildTopicProfile(topic) {
  const normalized = normalizeMedicalText(topic);
  const populations = detectPopulations(normalized);
  const rawWords = normalized.split(" ").filter(Boolean);
  let coreTokens = canonicalTopicTokens(topic);

  // Para temas muito curtos, nunca deixa o perfil sem conceito clínico.
  if (!coreTokens.length) {
    coreTokens = uniqueWords(rawWords.filter((word) => !TOPIC_STOPWORDS.has(word) && !ALL_POPULATION_WORDS.has(word)));
  }

  const orderedCoreTokens = rawWords.filter((word) => coreTokens.includes(word));
  return {
    original: clean(topic, MAX_TOPIC_LENGTH),
    normalized,
    coreTokens: coreTokens.slice(0, 12),
    orderedCoreTokens: orderedCoreTokens.slice(0, 12),
    corePhrase: orderedCoreTokens.slice(0, 8).join(" "),
    comparablePhrase: orderedCoreTokens.slice(0, 12).join(" "),
    populations,
  };
}

function tokenCoverage(text, tokens) {
  if (!tokens.length) return 1;
  const normalized = ` ${normalizeMedicalText(text)} `;
  const hits = tokens.filter((token) => normalized.includes(` ${token} `)).length;
  return hits / tokens.length;
}

function hasAnyNormalizedTerm(text, terms) {
  const normalized = ` ${normalizeMedicalText(text)} `;
  return terms.some((term) => normalized.includes(` ${normalizeMedicalText(term)} `));
}

function assessTopicRelevance(source, profile) {
  const title = clean(source?.title, 1200);
  const body = [source?.title, source?.summary, source?.whyRelevant, source?.institution].filter(Boolean).join(" ");
  const normalizedTitle = normalizeMedicalText(title);
  const normalizedBody = normalizeMedicalText(body);

  const titlePopulations = detectPopulations(title);
  const bodyPopulations = detectPopulations(body);
  const targetPopulations = profile.populations;

  const veterinaryTitle = hasAnyNormalizedTerm(title, ANIMAL_TERMS);
  const veterinaryBody = hasAnyNormalizedTerm(body, ANIMAL_TERMS);
  const hasHumanPopulation = bodyPopulations.size > 0;
  if (veterinaryTitle || (veterinaryBody && !hasHumanPopulation)) {
    return { accepted: false, score: 0, level: "low", reasons: ["conteúdo veterinário/animal"] };
  }

  const titleCoverage = tokenCoverage(title, profile.coreTokens);
  const bodyCoverage = tokenCoverage(body, profile.coreTokens);
  // Comparação simétrica: consulta e título são avaliados depois da mesma remoção de
  // stopwords. Isso evita classificar como "moderado" um título praticamente idêntico
  // só porque contém "com", "de", "da" etc. entre os termos clínicos.
  const exactPhraseInTitle = Boolean(
    profile.coreTokens.length >= 2
    && titleCoverage === 1
    && orderedTokenMatch(title, profile.orderedCoreTokens?.length ? profile.orderedCoreTokens : profile.coreTokens)
  );

  // O OpenAlex pode devolver resultados com apenas uma palavra genérica em comum.
  // Exigimos correspondência substancial do conceito clínico para entrar na lista.
  if (profile.coreTokens.length >= 2) {
    if (bodyCoverage < 0.66) return { accepted: false, score: 0, level: "low", reasons: ["baixa correspondência temática"] };
    if (titleCoverage < 0.34 && bodyCoverage < 0.9) {
      return { accepted: false, score: 0, level: "low", reasons: ["tema apenas incidental"] };
    }
  } else if (profile.coreTokens.length === 1 && titleCoverage < 1 && bodyCoverage < 1) {
    return { accepted: false, score: 0, level: "low", reasons: ["conceito principal ausente"] };
  }

  const targetInTitle = Array.from(targetPopulations).some((population) => titlePopulations.has(population));
  const targetInBody = Array.from(targetPopulations).some((population) => bodyPopulations.has(population));
  const conflictingInTitle = targetPopulations.size > 0 && Array.from(titlePopulations).some((population) => !targetPopulations.has(population));

  // Ex.: tema "em adultos" não deve trazer revisão exclusivamente "na infância".
  if (targetPopulations.size > 0 && conflictingInTitle && !targetInTitle) {
    return { accepted: false, score: 0, level: "low", reasons: ["população incompatível com o tema"] };
  }

  let score = 0;
  if (exactPhraseInTitle) score += 35;
  score += Math.round(titleCoverage * 35);
  score += Math.round(bodyCoverage * 25);
  if (titleCoverage === 1) score += 10;

  const reasons = [];
  if (exactPhraseInTitle || titleCoverage >= 0.75) reasons.push("tema central no título");
  else if (bodyCoverage >= 0.9) reasons.push("alta correspondência temática");

  if (targetPopulations.size > 0) {
    if (targetInTitle) {
      score += 10;
      reasons.push("população-alvo explícita no título");
    } else if (targetInBody) {
      score += 5;
      reasons.push("população-alvo contemplada");
    } else {
      score -= 10;
      reasons.push("fonte geral, sem população-alvo explícita");
    }
  }

  // Se a consulta contém um modificador contrastivo explícito (ex.: superior, reduzida,
  // aguda) e a fonte não o representa em título/resumo, ela continua podendo ser útil como
  // fonte geral, mas NÃO recebe relevância alta. Isso diferencia "respiratory tract
  // infections" de "upper respiratory tract infections" sem excluir revisões gerais.
  let missingRequestedContrast = false;
  for (const group of CLINICAL_CONTRAST_GROUPS) {
    const queryLeft = normalizedContainsAny(profile.original, group.left);
    const queryRight = normalizedContainsAny(profile.original, group.right);
    if (queryLeft && !queryRight && !normalizedContainsAny(body, group.left)) missingRequestedContrast = true;
    if (queryRight && !queryLeft && !normalizedContainsAny(body, group.right)) missingRequestedContrast = true;
  }
  if (missingRequestedContrast) {
    score -= 24;
    reasons.push("fonte geral sem o modificador clínico específico da consulta");
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 85 ? "high" : score >= 62 ? "medium" : "low";
  return { accepted: score >= 62, score, level, reasons };
}

function attachTopicRelevance(source, profile, minimumScore = 62) {
  const relevance = assessTopicRelevance(source, profile);
  if (!relevance.accepted || relevance.score < minimumScore) return null;
  return {
    ...source,
    relevanceScore: relevance.score,
    relevanceLevel: relevance.level,
    relevanceReasons: relevance.reasons,
  };
}

// Contrastes clínicos gerais que não podem ser trocados silenciosamente pela expansão.
// Não são doenças hardcoded; são modificadores reutilizáveis entre especialidades.
const CLINICAL_CONTRAST_GROUPS = [
  { left: ["reduzida", "reduzido", "reduced"], right: ["preservada", "preservado", "preserved"], leftEnglish: "reduced", rightEnglish: "preserved" },
  { left: ["aguda", "agudo", "acute"], right: ["cronica", "cronico", "chronic"], leftEnglish: "acute", rightEnglish: "chronic" },
  { left: ["primaria", "primario", "primary"], right: ["secundaria", "secundario", "secondary"], leftEnglish: "primary", rightEnglish: "secondary" },
  { left: ["superior", "superiores", "upper"], right: ["inferior", "inferiores", "lower"], leftEnglish: "upper", rightEnglish: "lower" },
  { left: ["hipo", "hypo"], right: ["hiper", "hyper"], leftEnglish: "hypo", rightEnglish: "hyper" },
];

function queryEnglishContrastTerms(originalTopic) {
  const query = normalizeMedicalText(originalTopic);
  const result = [];
  for (const group of CLINICAL_CONTRAST_GROUPS) {
    const left = normalizedContainsAny(query, group.left);
    const right = normalizedContainsAny(query, group.right);
    if (left && !right && group.leftEnglish) result.push(group.leftEnglish);
    if (right && !left && group.rightEnglish) result.push(group.rightEnglish);
  }
  return uniqueWords(result);
}


function normalizedContainsAny(text, terms) {
  const normalized = ` ${normalizeMedicalText(text)} `;
  return (terms || []).some((term) => {
    const token = normalizeMedicalText(term);
    if (!token) return false;
    if (token === "hipo" || token === "hypo" || token === "hiper" || token === "hyper") {
      return normalized.split(" ").some((word) => word.startsWith(token));
    }
    return normalized.includes(` ${token} `);
  });
}

function sourceContradictsOriginalTopic(source, originalTopic) {
  const query = normalizeMedicalText(originalTopic);
  const title = normalizeMedicalText(source?.title || "");
  const text = normalizeMedicalText([source?.title, source?.summary].filter(Boolean).join(" "));
  if (!query || !title) return false;

  for (const group of CLINICAL_CONTRAST_GROUPS) {
    const queryLeft = normalizedContainsAny(query, group.left);
    const queryRight = normalizedContainsAny(query, group.right);
    const titleLeft = normalizedContainsAny(title, group.left);
    const titleRight = normalizedContainsAny(title, group.right);
    if (queryLeft && titleRight && !titleLeft) return true;
    if (queryRight && titleLeft && !titleRight) return true;

    const titleWords = title.split(" ");
    const sideTerms = queryLeft ? group.left : (queryRight ? group.right : []);
    for (let index = 0; index < titleWords.length; index += 1) {
      const word = titleWords[index];
      const matchesRequestedSide = sideTerms.some((term) => {
        const normalizedTerm = normalizeMedicalText(term);
        return word === normalizedTerm || ((normalizedTerm === "hypo" || normalizedTerm === "hyper" || normalizedTerm === "hipo" || normalizedTerm === "hiper") && word.startsWith(normalizedTerm));
      });
      if (!matchesRequestedSide) continue;
      const before = titleWords.slice(Math.max(0, index - 3), index).join(" ");
      if (/\b(?:without|excluding|except|non|nao|sem)\b/.test(before)) return true;
    }
  }

  // Negação explícita do modificador solicitado no título (ex.: "without reduced ejection
  // fraction") deve ser excluída mesmo que a palavra "reduced" esteja literalmente ali.
  const queryWords = query.split(" ").filter((word) => word.length >= 5 && !TOPIC_STOPWORDS.has(word));
  for (const word of queryWords) {
    const cognate = normalizeMedicalCognate(word);
    if (!cognate || cognate.length < 5) continue;
    const words = title.split(" ");
    for (let index = 0; index < words.length; index += 1) {
      if (normalizeMedicalCognate(words[index]) !== cognate) continue;
      const before = words.slice(Math.max(0, index - 3), index).join(" ");
      if (/\b(?:without|excluding|except|non|nao|sem)\b/.test(before)) return true;
    }
  }

  // Se o texto inteiro contém ambos os polos, não rejeitamos automaticamente: uma revisão
  // comparativa pode ser útil. O bloqueio acima é deliberadamente orientado pelo TÍTULO.
  return false;
}

function hostMatches(host, patterns) {
  return Boolean(host && patterns.some((pattern) => pattern.test(host)));
}

function inferredCredibility(source) {
  const host = hostnameOf(source?.url);
  const institution = normalizeMedicalText(source?.institution || source?.journal || "");
  const declared = String(source?.credibility || "").toLowerCase();

  // PubMed e NCBI são excelentes índices, mas o domínio pubmed.ncbi.nlm.nih.gov não
  // transforma automaticamente qualquer artigo em uma fonte institucional de alta autoridade.
  if (source?.searchOrigin !== "pubmed") {
    if (hostMatches(host, GOVERNMENT_HOST_PATTERNS)) return "government";
    if (isKnownMedicalSocietyHost(host) || hostMatches(host, MEDICAL_SOCIETY_HOST_PATTERNS)) return "medical_society";
    if (hostMatches(host, INTERNATIONAL_AUTHORITY_HOST_PATTERNS)) return "international_authority";
    if (hostMatches(host, EVIDENCE_SYNTHESIS_HOST_PATTERNS)) return "evidence_synthesis";
  }

  if (["government", "medical_society", "international_authority", "evidence_synthesis"].includes(declared)) return declared;
  if (/cochrane/.test(institution)) return "evidence_synthesis";
  if (/ministerio da saude|ministry of health|conitec|secretaria de saude/.test(institution)) return "government";
  const looksLikeJournal = /journal|revista|research|press|editora|publishing/.test(institution);
  const looksLikeNamedMedicalSociety = /sociedade brasileira|sociedade portuguesa|american academy|european academy|american college|european society|international society|world federation/.test(institution);
  if (!looksLikeJournal && looksLikeNamedMedicalSociety) return "medical_society";
  return "peer_reviewed";
}

function authorityScore(source) {
  const credibility = inferredCredibility(source);
  const host = hostnameOf(source?.url);
  if (source?.officialContentClass === "public_education") return credibility === "government" ? 72 : 66;
  if (credibility === "government") return 100;
  if (credibility === "medical_society") return 97;
  if (credibility === "international_authority") return 97;
  if (credibility === "evidence_synthesis") return 95;
  if (hostMatches(host, [/(^|\.)bvsalud\.org$/i, /(^|\.)scielo\.br$/i, /(^|\.)scielo\.org$/i])) return 75;
  if (source?.searchOrigin === "pubmed") return 68;
  if (source?.searchOrigin === "openalex") return 62;
  return isHighTrustDomain(source?.url) ? 78 : 60;
}

function evidenceScore(source) {
  if (source?.officialContentClass === "public_education") return 38;
  return EVIDENCE_SCORES[source?.evidenceLevel] || EVIDENCE_SCORES.other;
}

function recencyScore(source) {
  const year = Number(source?.year);
  if (!Number.isFinite(year)) return 1;
  const age = Math.max(0, new Date().getUTCFullYear() - year);
  if (age <= 2) return 5;
  if (age <= 5) return 4;
  if (age <= 10) return 2;
  return 0;
}

function breadthContentTokens(text, profile) {
  const target = new Set(profile.coreTokens);
  // Não confundir títulos escritos inteiramente em CAIXA ALTA com siglas. Só ignoramos
  // tokens curtos/alfanuméricos plausíveis como DRC, IL-4 etc.
  const acronymTokens = new Set((String(text || "").match(/\b[A-Z][A-Z0-9-]{2,12}\b/g) || [])
    .filter((token) => token.length <= 5 || /[0-9-]/.test(token))
    .map((token) => normalizeMedicalText(token)));
  return uniqueWords(normalizeMedicalText(text).split(" ").filter((word) => {
    if (!word || word.length < 4 || /^[0-9]+$/.test(word)) return false;
    if (acronymTokens.has(word)) return false;
    if (TOPIC_STOPWORDS.has(word) || GENERIC_TOPIC_WORDS.has(word) || ALL_POPULATION_WORDS.has(word)) return false;
    if (BREADTH_IGNORED_WORDS.has(word) || target.has(word)) return false;
    return true;
  }));
}

function assessSourceBreadth(source, profile) {
  const title = clean(source?.title, 1000);
  const combined = [source?.title, source?.summary].filter(Boolean).join(" ");
  const normalizedTitle = normalizeMedicalText(title);
  const extraTokens = breadthContentTokens(title, profile);
  const titleCoverage = tokenCoverage(title, profile.coreTokens);
  const topicInOrder = titleCoverage === 1 && orderedTokenMatch(title, profile.orderedCoreTokens?.length ? profile.orderedCoreTokens : profile.coreTokens);
  const scopeHits = CLINICAL_SCOPE_DOMAINS.filter((terms) => hasAnyNormalizedTerm(combined, terms)).length;

  let score = 92;
  score -= Math.min(48, extraTokens.length * 9);
  if (extraTokens.length >= 2) score -= Math.min(16, (extraTokens.length - 1) * 4);

  const focusedPattern = /\b(uso|utilizacao|eficacia|efeito|influencia|associacao|correlacao|impacto|modulador|inibidor|tratad[oa]s? com|therapy with|treated with|efficacy|effect|association|correlation|impact of|use of|progressao|progression|complicacao|complication)\b/.test(normalizedTitle);
  if (focusedPattern && extraTokens.length) score -= 14;

  const broadPattern = /\b(ampla abordagem|revisao de literatura|revisao narrativa|atualizacoes? no manejo|overview|current management|clinical practice guideline|practice guideline|diretriz|consenso|guideline|consensus|protocolo clinico|pcdt)\b/.test(normalizedTitle);
  if (broadPattern) score += 12;
  if (titleCoverage === 1 && extraTokens.length === 0) score += 8;
  score += Math.min(15, scopeHits * 3);
  if (["guideline", "consensus", "official_document"].includes(source?.evidenceLevel)) score += 10;

  // Regra estrutural geral: quando o conceito pesquisado aparece integralmente no título,
  // mas é cercado por termos clínicos adicionais relevantes, a fonte é sobre um ASPECTO
  // do tema. Assim "anemia na DRC" não vira escopo amplo para uma busca por "DRC".
  // Se o próprio usuário pesquisar "anemia na DRC", esses termos passam a fazer parte do
  // perfil e a mesma fonte pode voltar a ser ampla.
  if (topicInOrder && extraTokens.length >= 2) {
    score = Math.min(score, broadPattern ? 72 : 52);
  } else if (topicInOrder && extraTokens.length === 1 && !broadPattern) {
    score = Math.min(score, 70);
  }

  // Títulos que anunciam explicitamente UMA intervenção, mecanismo, complicação ou fator
  // são subtemas numa pergunta mais geral, independentemente de o resumo mencionar várias
  // dimensões clínicas.
  const interventionSpecificPattern = /\b(uso de|utilizacao de|eficacia (?:clinica )?de|efeito de|influencia d[oa]|associacao (?:de|entre)|correlacao (?:de|entre)|moduladores? d[oa]|inibidores? d[oa]|therapy with|treated with|use of|efficacy of|effect of|impact of)\b/.test(normalizedTitle);
  const aspectSpecificPattern = /\b(mortalidade|mortality|incidencia|incidence|prevalencia|prevalence|qualidade de vida|quality of life|manifestacoes? (?:bucais|orais|cutaneas|neurologicas|cardiacas)|oral manifestations?|nutricao|nutrition|terapia nutricional|nutritional therapy|exercicio|exercise|atividade fisica|physical activity|biomarcador|biomarker|fisiopatologia|pathophysiology|patogenese|pathogenesis|desfechos?|outcomes?)\b/.test(normalizedTitle);
  if (interventionSpecificPattern && extraTokens.length >= 1) score = Math.min(score, 50);
  else if (aspectSpecificPattern && extraTokens.length >= 1) score = extraTokens.length <= 3 ? Math.max(58, Math.min(score, 68)) : Math.min(score, 52);
  else if (focusedPattern && extraTokens.length >= 1) score = Math.min(score, 70);

  // Conteúdo oficial voltado ao público/notícia/mídia nunca deve se apresentar como
  // "escopo amplo" de evidência clínica só porque descreve vários aspectos da doença.
  if (source?.officialContentClass === "public_education") score = Math.min(score, 58);

  score = Math.max(10, Math.min(100, Math.round(score)));
  return {
    score,
    level: score >= 78 ? "broad" : score >= 55 ? "focused" : "narrow",
    extraTokens: extraTokens.slice(0, 8),
    scopeHits,
  };
}

function inferPriority(source) {
  if (!isPortuguese(source.language, source.country, source.url)) return "international";

  // Regra dura: prioridade exige alta relevância E escopo amplo em relação à pergunta.
  // Um PCDT de complicação (ex.: anemia na DRC) continua valioso, mas é complementar
  // quando o usuário pesquisou a doença geral. Se a pergunta já for sobre a complicação,
  // o próprio perfil muda e o documento pode voltar a ser amplo/prioritário.
  if (source.relevanceLevel !== "high" || source.breadthLevel !== "broad") return "complementary";

  // Documento preliminar/consulta pública/relatório de recomendação pode ser útil, mas não
  // deve competir visualmente com a versão final vigente do PCDT/diretriz.
  if (["preliminary", "recommendation_report"].includes(source.officialStatus)) return "complementary";

  const credibility = inferredCredibility(source);
  if (source.searchOrigin === "official") {
    if (["guideline", "consensus"].includes(source.evidenceLevel)) return "priority";
    // Página educacional/clínica de sociedade é útil, mas não recebe prioridade só por
    // estar em um domínio oficial. Prioridade fica reservada a diretriz/consenso/PCDT.
    return "complementary";
  }

  if (credibility === "international_authority" && ["guideline", "consensus"].includes(source.evidenceLevel)) return "priority";
  if (["systematic_review", "meta_analysis"].includes(source.evidenceLevel)
    && (source.breadthScore || 0) >= 82
    && (source.authorityScore || 0) >= 70) return "priority";
  return "complementary";
}

function applySelectionMetrics(source, profile) {
  const breadth = assessSourceBreadth(source, profile);
  const authority = authorityScore(source);
  const evidence = evidenceScore(source);
  const relevance = Number(source?.relevanceScore) || 0;
  const recency = recencyScore(source);
  const portugueseBonus = isPortuguese(source.language, source.country, source.url) ? 2 : 0;
  const officialBonus = officialQualityBonus(source);

  // O ranking separa relevância, autoridade, nível de evidência e abrangência. A camada
  // oficial recebe um bônus pequeno e explícito apenas para documentos clínicos fortes
  // (principalmente PCDT/diretriz final), nunca simplesmente por estar em um domínio .gov.br.
  const weighted = (relevance * 0.24) + (authority * 0.23) + (evidence * 0.20) + (breadth.score * 0.23) + recency + portugueseBonus + officialBonus;
  let finalScore = Math.max(0, Math.min(100, Math.round(weighted)));
  // Autoridade não pode transformar uma complicação/subtema em melhor resposta para uma
  // pergunta geral. O teto é relativo à própria consulta: se o usuário pesquisar o subtema,
  // a fonte passa a ser ampla e deixa de sofrer este limite.
  if (breadth.level === "focused") finalScore = Math.min(finalScore, 84);
  if (breadth.level === "narrow") finalScore = Math.min(finalScore, 76);
  if (source?.semanticRelation) finalScore = Math.min(finalScore, 74);
  if (source?.officialContentClass === "public_education") finalScore = Math.min(finalScore, 52);
  const enriched = {
    ...source,
    credibility: inferredCredibility(source),
    authorityScore: authority,
    evidenceScore: evidence,
    breadthScore: breadth.score,
    breadthLevel: breadth.level,
    breadthReasons: breadth.extraTokens.length ? [`subtema/tópicos específicos: ${breadth.extraTokens.join(", ")}`] : ["escopo amplo em relação à pergunta"],
    officialBonus,
    score: finalScore,
  };
  enriched.priority = inferPriority(enriched);
  const breadthLabel = breadth.level === "broad" ? "ampla" : breadth.level === "focused" ? "focada" : "específica";
  if (!/Abrangência clínica:/i.test(enriched.whyRelevant || "")) {
    enriched.whyRelevant = `${clean(enriched.whyRelevant, 620)} Abrangência clínica: ${breadthLabel} em relação à pergunta.`.trim();
  }
  return enriched;
}

function sourceScore(source, profile) {
  if (!profile) return Number(source?.score) || 0;
  return applySelectionMetrics(source, profile).score;
}

function extractGrounding(data) {
  const annotations = [];
  const queries = [];
  let searchCalls = 0;
  if (!Array.isArray(data?.steps)) return { annotations, queries, searchCalls };

  for (const step of data.steps) {
    if (step?.type === "google_search_call") {
      searchCalls += 1;
      const values = step?.arguments?.queries;
      if (Array.isArray(values)) queries.push(...values.map((value) => clean(value, 400)).filter(Boolean));
    }
    if (step?.type !== "model_output" || !Array.isArray(step?.content)) continue;
    for (const block of step.content) {
      if (block?.type !== "text" || !Array.isArray(block?.annotations)) continue;
      for (const annotation of block.annotations) {
        if (annotation?.type !== "url_citation") continue;
        const url = normalizeUrl(annotation.url);
        if (!url || isBlockedUrl(url)) continue;
        annotations.push({
          url,
          title: clean(annotation.title, 300),
          startIndex: safeNumber(annotation.start_index ?? annotation.startIndex),
          endIndex: safeNumber(annotation.end_index ?? annotation.endIndex),
        });
      }
    }
  }
  return { annotations, queries: Array.from(new Set(queries)), searchCalls };
}

function findCitationForSource(rawText, source, annotations, usedUrls) {
  const candidateUrl = normalizeUrl(source.url);
  const candidateHost = hostnameOf(candidateUrl);
  let match = annotations.find((item) => item.url === candidateUrl && !usedUrls.has(item.url));
  if (!match && candidateHost) {
    match = annotations.find((item) => hostnameOf(item.url) === candidateHost && !usedUrls.has(item.url));
  }
  if (!match && source.title) {
    const titleIndex = rawText.toLowerCase().indexOf(source.title.toLowerCase().slice(0, 80));
    if (titleIndex >= 0) {
      match = annotations.find((item) => {
        if (usedUrls.has(item.url)) return false;
        if (item.startIndex == null || item.endIndex == null) return false;
        return item.startIndex <= titleIndex + 1200 && item.endIndex >= Math.max(0, titleIndex - 300);
      });
    }
  }
  return match || null;
}

function mapGroundedSources(parsed, rawText, grounding, maxResults, topic) {
  const topicProfile = buildTopicProfile(topic);
  const rawSources = Array.isArray(parsed?.sources) ? parsed.sources : [];
  const usedUrls = new Set();
  const mapped = [];

  for (let index = 0; index < rawSources.length; index += 1) {
    const item = rawSources[index];
    const title = clean(item?.title, 900);
    const directUrl = normalizeUrl(item?.url);
    if (!title || !directUrl || isBlockedUrl(directUrl)) continue;

    const citation = findCitationForSource(rawText, { title, url: directUrl }, grounding.annotations, usedUrls);
    const verifiedUrl = citation?.url || directUrl;
    if (!verifiedUrl || isBlockedUrl(verifiedUrl)) continue;
    if (citation) usedUrls.add(citation.url);

    const source = {
      id: `web-${index}-${Buffer.from(verifiedUrl).toString("base64url").slice(0, 18)}`,
      title,
      url: verifiedUrl,
      institution: clean(item?.institution, 220) || citation?.title || hostnameOf(verifiedUrl),
      domain: hostnameOf(verifiedUrl),
      provider: "Google Search",
      language: clean(item?.language, 40) || "Não informado",
      country: clean(item?.country, 80) || undefined,
      year: safeNumber(item?.year),
      evidenceLevel: clean(item?.sourceType, 60) || "other",
      credibility: clean(item?.credibility, 80) || "peer_reviewed",
      summary: clean(item?.summary, 900),
      whyRelevant: clean(item?.whyRelevant, 700),
      verificationStatus: citation ? "verified" : "grounded",
      searchOrigin: "web",
      isPdf: isPdfUrl(verifiedUrl),
      documentFormat: isPdfUrl(verifiedUrl) ? "PDF" : "HTML",
      officialDocument: isOfficialBrazilianHost(verifiedUrl),
    };
    const relevantSource = attachTopicRelevance(source, topicProfile);
    if (!relevantSource) continue;
    mapped.push(applySelectionMetrics(relevantSource, topicProfile));
  }

  const seen = new Set();
  return mapped
    .filter((source) => {
      const key = `${source.domain}|${source.title.toLowerCase().replace(/\W+/g, " ").slice(0, 140)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0)
      || (b.authorityScore || 0) - (a.authorityScore || 0)
      || (b.breadthScore || 0) - (a.breadthScore || 0)
      || (b.year || 0) - (a.year || 0))
    .slice(0, maxResults);
}

function buildGroundedPrompt({ topic, sourceGroups, recency, maxResults, allowInternational }) {
  const sourceRequests = [];
  if (sourceGroups.includes("guidelines")) sourceRequests.push("diretrizes, consensos, PCDTs e documentos oficiais");
  if (sourceGroups.includes("reviews")) sourceRequests.push("revisões sistemáticas, meta-análises e revisões clínicas de alta qualidade");
  if (sourceGroups.includes("primary")) sourceRequests.push("ensaios clínicos e estudos primários relevantes");

  const dateRule = recency === "5y"
    ? "Priorize publicações dos últimos 5 anos; aceite documento oficial vigente mais antigo quando ainda for a referência atual."
    : recency === "10y"
      ? "Priorize publicações dos últimos 10 anos; aceite documento oficial vigente mais antigo quando necessário."
      : "Sem limite rígido de data, mas priorize a fonte vigente e mais atual.";

  return `Você é o mecanismo de descoberta de fontes do Fichário, uma plataforma brasileira de estudo médico.\n\nTEMA: ${topic}\n\nOBJETIVO: encontrar até ${maxResults} FONTES MÉDICAS REAIS, VERIFICÁVEIS E DIRETAMENTE RELACIONADAS ao tema. NÃO gere flashcards e NÃO responda ao tema; apenas descubra fontes.\n\nIDIOMA E ORDEM DE PRIORIDADE:\n1. Pesquise PRIMEIRO em português do Brasil e em fontes brasileiras.\n2. Priorize Ministério da Saúde, CONITEC/PCDT, outras páginas oficiais gov.br, sociedades médicas brasileiras, BVS/LILACS e SciELO.\n3. Se não houver fontes brasileiras suficientes ou atualizadas, complemente com OMS/OPAS, diretrizes de sociedades internacionais, Cochrane e artigos indexados/PubMed.\n4. ${allowInternational ? "Fontes em inglês podem complementar a seleção, mas nunca devem deslocar uma fonte brasileira equivalente e atual." : "Não inclua fontes em inglês."}\n\nTIPOS PEDIDOS: ${sourceRequests.join("; ")}.\n${dateRule}\n\nQUALIDADE E RELEVÂNCIA:\n- O título/escopo deve corresponder diretamente ao tema. Não inclua doenças apenas associadas, diagnósticos vizinhos ou artigos que só mencionem o tema incidentalmente.\n- Exclua blogs, clínicas, portais comerciais, Wikipédia, redes sociais, imprensa, páginas de fabricantes e conteúdo promocional.\n- Para recomendações clínicas, prefira diretrizes/PCDT/consensos e sínteses de evidência antes de estudos isolados.\n- Cada item deve corresponder a uma página que você realmente encontrou na Pesquisa Google.\n- Copie o URL real da fonte encontrada.\n- Faça poucas buscas bem direcionadas (idealmente 2 a 4), incluindo fontes brasileiras antes de ampliar internacionalmente.\n\nPara cada fonte, descreva em PORTUGUÊS DO BRASIL o resumo e por que ela é relevante, mesmo quando o documento original estiver em inglês.`;
}

async function callGroundedSearch({ apiKey, model, prompt, timeoutMs = 35_000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        store: false,
        tools: [{ type: "google_search" }],
        generation_config: { thinking_level: "minimal" },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: SOURCE_SCHEMA,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function cleanSecret(value) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function getGeminiApiKey() {
  const candidates = [
    ["FICHARIO_GEMINI_API_KEY", process.env.FICHARIO_GEMINI_API_KEY],
    ["GEMINI_API_KEY", process.env.GEMINI_API_KEY],
    ["AI_API_KEY", process.env.AI_API_KEY],
  ];

  for (const [name, rawValue] of candidates) {
    const value = cleanSecret(rawValue);
    // Evita que um valor acidentalmente enorme/serializado sobrescreva a chave real.
    if (value.length >= 20 && value.length <= 200) {
      return { apiKey: value, source: name };
    }
  }

  return { apiKey: "", source: "" };
}

async function searchWebGrounded(options) {
  const { apiKey, source: apiKeySource } = getGeminiApiKey();
  if (!apiKey) return { sources: [], errorCode: "missing_api_key", attempts: [] };
  console.log("Pesquisa médica web: chave carregada", {
    source: apiKeySource,
    length: apiKey.length,
    suffix: apiKey.slice(-4),
  });
  const prompt = buildGroundedPrompt(options);
  const attempts = [];

  for (const model of SEARCH_MODELS) {
    try {
      const response = await callGroundedSearch({ apiKey, model, prompt });
      if (!response.ok) {
        const errorText = await response.text();
        attempts.push({ model, status: response.status });
        console.warn(`Pesquisa médica web: ${model} retornou ${response.status}`, errorText.slice(0, 800));
        continue;
      }
      const data = await response.json();
      const rawText = extractGeminiText(data);
      const parsed = parseJsonObject(rawText);
      const grounding = extractGrounding(data);
      attempts.push({ model, status: 200, searchCalls: grounding.searchCalls });
      if (!parsed || grounding.searchCalls < 1) {
        console.warn(`Pesquisa médica web: ${model} respondeu sem pesquisa/carga estruturada.`);
        continue;
      }
      const sources = mapGroundedSources(parsed, rawText, grounding, options.maxResults, options.topic);
      if (sources.length) {
        return {
          sources,
          normalizedTopic: clean(parsed.normalizedTopic, 220) || options.topic,
          queries: grounding.queries,
          model,
          attempts,
        };
      }
    } catch (error) {
      attempts.push({ model, status: error?.name === "AbortError" ? 504 : 0 });
      console.warn(`Pesquisa médica web: falha em ${model}`, error);
    }
  }
  return { sources: [], errorCode: "grounding_unavailable", attempts };
}


function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16) || 32));
}

function stripHtml(value) {
  return clean(decodeHtmlEntities(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")), 1800);
}

function extractHtmlTitle(html) {
  const og = String(html || "").match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || String(html || "").match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i);
  if (og?.[1]) return stripHtml(og[1]);
  const title = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? stripHtml(title[1]).replace(/\s+-\s+Portal Gov\.br.*$/i, "") : "";
}

function extractHtmlHeading(html) {
  const match = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match?.[1] ? stripHtml(match[1]) : "";
}

function extractMetaDescription(html) {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = String(html || "").match(pattern);
    if (match?.[1]) return stripHtml(match[1]);
  }
  return "";
}

function extractCanonicalUrl(html, baseUrl) {
  const patterns = [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = String(html || "").match(pattern);
    if (!match?.[1]) continue;
    try {
      const normalized = normalizeUrl(new URL(decodeHtmlEntities(match[1]), baseUrl).toString());
      if (normalized) return normalized;
    } catch {
      // ignora canonical malformado
    }
  }
  return "";
}

function extractMainTextSample(html) {
  const stripped = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
  return stripHtml(stripped);
}

function extractHtmlAnchors(html, baseUrl) {
  const anchors = [];
  const regex = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(String(html || "")))) {
    const rawHref = decodeHtmlEntities(match[2]).trim();
    if (!rawHref || rawHref.startsWith("#") || /^javascript:/i.test(rawHref) || /^mailto:/i.test(rawHref)) continue;
    let url;
    try {
      url = normalizeUrl(new URL(rawHref, baseUrl).toString());
    } catch {
      continue;
    }
    if (!url) continue;
    const text = stripHtml(match[3]);
    if (!text && !isPdfUrl(url)) continue;
    anchors.push({ url, text: clean(text, 900) });
  }
  return anchors;
}

async function fetchOfficialHtml(url, timeoutMs = OFFICIAL_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5",
        "user-agent": "FicharioMed/1.0 (medical-source-discovery)",
      },
    });
    if (!response.ok) throw new Error(`official_fetch_${response.status}`);
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const finalUrl = normalizeUrl(response.url || url) || normalizeUrl(url);
    if (contentType.includes("application/pdf") || isPdfUrl(finalUrl)) {
      return { html: "", finalUrl, contentType, isPdf: true };
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > OFFICIAL_MAX_HTML_BYTES * 2) throw new Error("official_html_too_large");
    const html = (await response.text()).slice(0, OFFICIAL_MAX_HTML_BYTES);
    return { html, finalUrl, contentType, isPdf: false };
  } finally {
    clearTimeout(timer);
  }
}

function isOfficialBrazilianHost(url) {
  const host = hostnameOf(url);
  return host === "gov.br" || host.endsWith(".gov.br") || isKnownMedicalSocietyHost(host);
}

function officialPath(url) {
  try {
    return decodeURIComponent(new URL(url).pathname || "/").toLowerCase();
  } catch {
    return "";
  }
}

function officialUrlDisposition(url) {
  const path = officialPath(url);
  if (OFFICIAL_HARD_REJECT_PATH_PATTERNS.some((pattern) => pattern.test(path))) return "reject";
  if (/\/evento(?:s)?(?:\/|$)/i.test(path)) return "reject";
  if (OFFICIAL_DISCOVERY_ONLY_PATH_PATTERNS.some((pattern) => pattern.test(path))) return "discovery";
  return "final";
}

function officialInstitution(url) {
  const path = officialPath(url);
  const society = medicalSocietyAuthorityForUrl(url);
  if (society) return society.name;
  if (path.includes("/conitec/")) return "Ministério da Saúde · CONITEC";
  if (path.includes("/saude/")) return "Ministério da Saúde";
  return "Governo Federal · gov.br";
}

function officialProvider(url) {
  const society = medicalSocietyAuthorityForUrl(url);
  return society ? `${society.specialty} · sociedade de especialidade` : "gov.br · fonte oficial";
}

function officialContentClass(title, url, summary = "", forcePdf = false) {
  const value = normalizeMedicalText(`${title} ${summary}`);
  const path = officialPath(url);
  const society = medicalSocietyAuthorityForUrl(url);
  const isGovernment = !society && isOfficialBrazilianHost(url);
  const contentSignals = normalizeMedicalText(`${title} ${path} ${clean(summary, 280)}`);

  // Evento/notícia/campanha é material de descoberta, não evidência documental. A regra
  // combina conteúdo e URL para impedir que um simpósio hospedado em rota neutra escape.
  if (OFFICIAL_NON_DOCUMENT_PATTERNS.some((pattern) => pattern.test(contentSignals))) {
    return "non_document";
  }
  if (/\/(?:eventos?|agenda|noticias?|midia|podcast|campanhas?|imprensa)(?:\/|$)/i.test(path)) {
    return "non_document";
  }

  if (OFFICIAL_PUBLIC_EDUCATION_PATTERNS.some((pattern) => pattern.test(contentSignals))) {
    return "public_education";
  }
  if (/\/(?:publico|pacientes|conecta_mais)(?:\/|$)/i.test(path)) {
    return "public_education";
  }

  // Em gov.br/CONITEC, a própria estrutura de protocolos/PCDT é um sinal forte. Em sites
  // de sociedades, mencionar a palavra "PCDT" numa notícia NÃO basta: exige-se documento
  // cujo título/rota seja realmente diretriz, consenso, protocolo ou posicionamento.
  const governmentPcdtPath = isGovernment && (/\/conitec\//.test(path) || /\/protocolos\//.test(path) || /\/pcdt/.test(path));
  const titleLooksClinical = STRONG_CLINICAL_DOCUMENT_PATTERNS.some((pattern) => pattern.test(normalizeMedicalText(title)));
  const societyClinicalPath = society && /\/(?:diretrizes?|consensos?|protocolos?|documentos?|publicacoes?|posicionamentos?|recomendacoes?)(?:\/|$)/i.test(path);

  if (governmentPcdtPath || titleLooksClinical || societyClinicalPath) return "strong_clinical";
  if (forcePdf || isPdfUrl(url)) return "official_pdf";
  if (society && /\/(?:doencas?|temas?|conteudos?|educacao|profissionais?)(?:\/|$)/i.test(path)) return "clinical_reference";
  return "official_page";
}

function officialDocumentKind(title, url, forcePdf = false, summary = "") {
  const value = normalizeMedicalText(`${title} ${url}`);
  const path = officialPath(url);
  const society = medicalSocietyAuthorityForUrl(url);
  const contentClass = officialContentClass(title, url, summary, forcePdf);

  if (contentClass === "non_document") return "non_document";
  if (contentClass === "public_education") return "public_education";
  if (!society && (/\bpcdt\b|protocolo clinico|diretrizes terapeuticas/.test(value) || /\/assuntos\/pcdt\//.test(path) || (/\/protocolos\//.test(path) && /pcdt/.test(value)))) return "pcdt";
  if (contentClass === "strong_clinical") {
    if (/\bconsenso\b|\bconsensus\b/.test(value)) return "consensus";
    if (/\bdiretriz\b|\bguideline\b|clinical practice guideline|practice guideline|posicionamento|position statement|protocolo/.test(value)) return "guideline";
  }
  const summaryValue = normalizeMedicalText(summary);
  if ((forcePdf || isPdfUrl(url)) && /\bconsenso\b|\bconsensus\b/.test(summaryValue)) return "consensus";
  if ((forcePdf || isPdfUrl(url)) && /\bdiretriz\b|\bguideline\b|clinical practice guideline|practice guideline|posicionamento|position statement|protocolo/.test(summaryValue)) return "guideline";
  if (contentClass === "clinical_reference") return "clinical_reference";
  if (forcePdf || isPdfUrl(url)) return "official_pdf";
  return "official_page";
}

function classifyOfficialDocument(title, url, forcePdf = false, summary = "") {
  const kind = officialDocumentKind(title, url, forcePdf, summary);
  if (kind === "pcdt" || kind === "guideline") return "guideline";
  if (kind === "consensus") return "consensus";
  if (kind === "public_education") return "other";
  if (kind === "clinical_reference" || kind === "official_pdf" || kind === "official_page") return "official_document";
  return "other";
}

function officialDocumentStatus(title, url) {
  const value = normalizeMedicalText(`${title} ${url}`);
  if (/relatorio preliminar|consulta publica|versao preliminar|draft|preliminary/.test(value)) return "preliminary";
  if (/relatorio de recomendacao/.test(value)) return "recommendation_report";
  if (/resumido|resumida|summary/.test(value)) return "summary";
  return "final";
}

function officialQualityBonus(source) {
  if (source?.searchOrigin !== "official") return 0;
  if (source?.officialContentClass === "public_education") return -18;
  const kind = source?.officialKind || officialDocumentKind(source?.title, source?.url, source?.isPdf, source?.summary);
  const status = source?.officialStatus || officialDocumentStatus(source?.title, source?.url);
  let bonus = 0;
  if (kind === "pcdt") bonus += source?.isPdf ? 16 : 13;
  else if (kind === "guideline" || kind === "consensus") bonus += source?.isPdf ? 12 : 9;
  else if (kind === "clinical_reference") bonus += 4;
  else if (kind === "official_pdf") bonus += 3;
  if (status === "preliminary") bonus -= 14;
  else if (status === "recommendation_report") bonus -= 8;
  else if (status === "summary") bonus -= 3;
  return bonus;
}

function extractYearFromOfficialText(...values) {
  const current = new Date().getUTCFullYear() + 1;
  const years = values.join(" ").match(/\b(20\d{2}|19\d{2})\b/g) || [];
  const valid = years.map(Number).filter((year) => year >= 1990 && year <= current);
  return valid.length ? Math.max(...valid) : undefined;
}

function topicSignalCount({ title, heading, url }, topicProfile) {
  if (!topicProfile.coreTokens.length) return 3;
  const threshold = topicProfile.coreTokens.length >= 2 ? 0.66 : 1;
  const fields = [title, heading, officialPath(url).replace(/[\/_-]+/g, " ")].filter(Boolean);
  return fields.reduce((count, value) => count + (tokenCoverage(value, topicProfile.coreTokens) >= threshold ? 1 : 0), 0);
}

function isCentralOfficialPage({ title, heading, url, topicProfile }) {
  const disposition = officialUrlDisposition(url);
  if (disposition !== "final") return false;
  const signals = topicSignalCount({ title, heading, url }, topicProfile);
  // Exige confirmação em pelo menos dois sinais independentes quando eles existem.
  // Assim, um og:title contaminado por tag/menu não transforma uma página de hanseníase
  // em fonte de dermatite atópica.
  return signals >= 2;
}

function buildOfficialSource({ title, url, summary, year, topicProfile, originPageUrl, forcePdf = false, titleHint = "", semanticBridge }) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl || !isOfficialBrazilianHost(normalizedUrl)) return null;
  if (officialUrlDisposition(normalizedUrl) !== "final" && !forcePdf && !isPdfUrl(normalizedUrl)) return null;
  const institution = officialInstitution(normalizedUrl);
  const societyAuthority = medicalSocietyAuthorityForUrl(normalizedUrl);
  const credibility = societyAuthority ? "medical_society" : "government";
  const pdf = Boolean(forcePdf || isPdfUrl(normalizedUrl) || /\bpdf\b/i.test(title || ""));
  const opaqueMediaTitle = looksGenericMediaTitle(title);
  const chosenTitle = clean(opaqueMediaTitle ? titleHint : title, 900)
    || clean(titleHint, 900)
    || clean(title, 900)
    || (pdf ? "Documento oficial em PDF" : "Documento oficial");
  const cleanedSummary = clean(summary, 900) || (pdf
    ? "Documento oficial brasileiro em PDF localizado diretamente em fonte institucional."
    : "Documento oficial brasileiro localizado diretamente em fonte institucional.");
  const contentClass = officialContentClass(chosenTitle, normalizedUrl, cleanedSummary, pdf);
  if (contentClass === "non_document") return null;
  const officialKind = officialDocumentKind(chosenTitle, normalizedUrl, pdf, cleanedSummary);
  const officialStatus = officialDocumentStatus(chosenTitle, normalizedUrl);
  const source = {
    id: `official-${Buffer.from(normalizedUrl).toString("base64url").slice(0, 24)}`,
    title: chosenTitle,
    url: normalizedUrl,
    institution,
    domain: hostnameOf(normalizedUrl),
    provider: officialProvider(normalizedUrl),
    language: "Português",
    country: "Brasil",
    year,
    evidenceLevel: classifyOfficialDocument(chosenTitle, normalizedUrl, pdf, cleanedSummary),
    credibility,
    summary: cleanedSummary,
    whyRelevant: pdf
      ? "Documento oficial brasileiro em PDF descoberto e verificado diretamente em fonte institucional, sem depender da Pesquisa Google."
      : "Documento oficial brasileiro descoberto e verificado diretamente em fonte institucional, sem depender da Pesquisa Google.",
    verificationStatus: "verified",
    searchOrigin: "official",
    priority: "complementary",
    score: 0,
    isPdf: pdf,
    documentFormat: pdf ? "PDF" : "HTML",
    officialDocument: true,
    officialKind,
    officialStatus,
    officialContentClass: contentClass,
    authoritySpecialty: societyAuthority?.specialty,
    authorityKey: societyAuthority?.key,
    originPageUrl: originPageUrl && normalizeUrl(originPageUrl) !== normalizedUrl ? normalizeUrl(originPageUrl) : undefined,
  };

  let relevant = attachTopicRelevance(source, topicProfile, 58);
  if (!relevant && semanticBridge?.accepted && contentClass === "strong_clinical") {
    // Ponte semântica controlada: permite descobrir um PCDT/diretriz cujo título usa um
    // conceito clínico relacionado (ex.: trombofilia em uma consulta obstétrica por SAF),
    // mas somente para documento clínico forte e com confiança alta. Não promove notícia.
    const bridgeScore = Math.max(62, Math.min(78, Math.round(58 + (semanticBridge.score * 22))));
    relevant = {
      ...source,
      relevanceScore: bridgeScore,
      relevanceLevel: bridgeScore >= 85 ? "high" : "medium",
      relevanceReasons: [`relação semântica validada via ${clean(semanticBridge.term, 100) || "conceito relacionado"}`],
      semanticRelation: true,
      semanticBridgeTerm: clean(semanticBridge.term, 140),
      semanticBridgeScore: semanticBridge.score,
    };
    relevant.whyRelevant = `${source.whyRelevant} Relação clínica indireta detectada por evidência indexada (${relevant.semanticBridgeTerm}); o documento é mantido como complementar até validação do conteúdo integral.`;
  }
  if (!relevant) return null;
  if (!relevant.semanticRelation) {
    relevant.whyRelevant = `${source.whyRelevant} Relevância temática: ${relevant.relevanceLevel === "high" ? "alta" : "moderada"}.`;
  }
  return applySelectionMetrics(relevant, topicProfile);
}

function officialCandidateRank(anchor, topicProfile, sourceKind = "search") {
  const provisional = {
    title: anchor.text || anchor.titleHint || decodeURIComponent(officialPath(anchor.url).split("/").pop() || ""),
    summary: anchor.context || "",
    whyRelevant: "",
    institution: officialInstitution(anchor.url),
    url: anchor.url,
  };
  const relevance = assessTopicRelevance(provisional, topicProfile);
  let score = relevance.score || 0;
  const value = normalizeMedicalText(`${anchor.text} ${anchor.titleHint} ${anchor.url}`);
  if (sourceKind === "pcdt_catalog") score += 100;
  if (/\bpcdt\b|protocolo clinico|diretrizes terapeuticas/.test(value)) score += 45;
  if (isPdfUrl(anchor.url) || /\bpdf\b/.test(value)) score += 20;
  if (officialUrlDisposition(anchor.url) === "discovery") score -= 25;
  if (officialUrlDisposition(anchor.url) === "reject") score -= 200;
  return { relevance, score };
}

function officialAnchorCandidates(html, baseUrl, topicProfile, sourceKind = "search") {
  const anchors = extractHtmlAnchors(html, baseUrl);
  const seen = new Set();
  const candidates = [];
  for (const anchor of anchors) {
    if (!isOfficialBrazilianHost(anchor.url)) continue;
    if (officialUrlDisposition(anchor.url) === "reject") continue;
    const normalizedText = normalizeMedicalText(anchor.text);
    if (/entrar com gov|acessibilidade|compartilhe|facebook|instagram|linkedin|youtube|cookie|menu|pagina inicial|voltar ao topo/.test(normalizedText)) continue;
    const ranked = officialCandidateRank(anchor, topicProfile, sourceKind);
    if (!ranked.relevance.accepted && !isPdfUrl(anchor.url)) continue;
    const key = normalizeUrl(anchor.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ ...anchor, relevanceScore: ranked.relevance.score || 0, candidateRank: ranked.score, sourceKind });
  }
  return candidates.sort((a, b) => (b.candidateRank || 0) - (a.candidateRank || 0));
}

function extractPcDtCatalogCandidates(html, baseUrl, topicProfile, semanticContext) {
  const rows = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(String(html || "")))) rows.push(match[1]);

  const candidates = [];
  for (const rowHtml of rows) {
    const rowText = stripHtml(rowHtml);
    const rowRelevance = assessTopicRelevance({ title: rowText, summary: rowText, institution: "Ministério da Saúde · CONITEC" }, topicProfile);
    const rowBridge = semanticBridgeScore(rowText, semanticContext, topicProfile);
    if (!rowRelevance.accepted && !rowBridge.accepted) continue;
    const anchors = extractHtmlAnchors(rowHtml, baseUrl).filter((anchor) => isOfficialBrazilianHost(anchor.url));
    if (!anchors.length) continue;

    const topicAnchors = anchors
      .map((anchor) => ({ anchor, coverage: tokenCoverage(anchor.text, topicProfile.coreTokens) }))
      .sort((a, b) => b.coverage - a.coverage);
    const diseaseTitle = clean(topicAnchors[0]?.anchor?.text || rowText.split(/portaria/i)[0], 500);

    for (const anchor of anchors) {
      if (officialUrlDisposition(anchor.url) === "reject") continue;
      const genericLabel = /pcdt|resumido|publicacao|pdf|protocolo/i.test(normalizeMedicalText(anchor.text));
      const text = genericLabel ? `${diseaseTitle} — ${anchor.text}` : (anchor.text || diseaseTitle);
      const ranked = officialCandidateRank({ ...anchor, text, context: rowText, titleHint: diseaseTitle }, topicProfile, "pcdt_catalog");
      const anchorBridge = semanticBridgeScore(`${text} ${rowText}`, semanticContext, topicProfile);
      const bestBridge = anchorBridge.score >= rowBridge.score ? anchorBridge : rowBridge;
      if (!ranked.relevance.accepted && !bestBridge.accepted && !isPdfUrl(anchor.url)) continue;
      candidates.push({
        ...anchor,
        text,
        titleHint: diseaseTitle,
        context: rowText,
        relevanceScore: Math.max(rowRelevance.score || 0, ranked.relevance.score || 0, bestBridge.accepted ? Math.round(58 + bestBridge.score * 22) : 0),
        candidateRank: ranked.score + (genericLabel ? 15 : 25) + (bestBridge.accepted ? Math.round(bestBridge.score * 35) : 0),
        sourceKind: "pcdt_catalog",
        semanticBridge: bestBridge.accepted ? bestBridge : undefined,
      });
    }
  }

  // Se a estrutura da tabela mudar, ainda aproveita os links normais do catálogo.
  if (!candidates.length) return officialAnchorCandidates(html, baseUrl, topicProfile, "pcdt_catalog");
  return candidates.sort((a, b) => (b.candidateRank || 0) - (a.candidateRank || 0));
}

async function searchPcDtCatalog(topicProfile, semanticContext) {
  try {
    const fetched = await fetchOfficialHtml(GOVBR_PCDT_CATALOG_URL, OFFICIAL_FETCH_TIMEOUT_MS + 2_000);
    if (fetched.isPdf) return [];
    return extractPcDtCatalogCandidates(fetched.html, fetched.finalUrl || GOVBR_PCDT_CATALOG_URL, topicProfile, semanticContext);
  } catch (error) {
    console.warn("Catálogo PCDT indisponível", error?.message || error);
    return [];
  }
}

async function officialSearchPage(url, topicProfile, sourceKind = "search") {
  try {
    const fetched = await fetchOfficialHtml(url);
    if (fetched.isPdf) return [{ url: fetched.finalUrl, text: "Documento oficial em PDF", relevanceScore: 70, candidateRank: 90, sourceKind }];
    return officialAnchorCandidates(fetched.html, fetched.finalUrl || url, topicProfile, sourceKind);
  } catch (error) {
    console.warn("Fonte oficial indisponível", url, error?.message || error);
    return [];
  }
}

async function hydrateOfficialCandidate(candidate, topicProfile, depth = 0) {
  if (!candidate?.url || officialUrlDisposition(candidate.url) === "reject") return [];

  if (isPdfUrl(candidate.url)) {
    return [buildOfficialSource({
      title: candidate.text || candidate.titleHint || "Documento oficial em PDF",
      url: candidate.url,
      summary: candidate.context || "Documento oficial brasileiro em PDF localizado diretamente em fonte institucional.",
      year: extractYearFromOfficialText(candidate.context, candidate.text, candidate.url),
      topicProfile,
      forcePdf: true,
      titleHint: candidate.titleHint,
      semanticBridge: candidate.semanticBridge,
    })].filter(Boolean);
  }

  try {
    const fetched = await fetchOfficialHtml(candidate.url);
    if (fetched.isPdf) {
      return [buildOfficialSource({
        title: candidate.text || candidate.titleHint || "Documento oficial em PDF",
        url: fetched.finalUrl || candidate.url,
        summary: candidate.context || "Documento oficial brasileiro em PDF localizado diretamente em fonte institucional.",
        year: extractYearFromOfficialText(candidate.context, candidate.text, fetched.finalUrl),
        topicProfile,
        forcePdf: true,
        titleHint: candidate.titleHint,
        semanticBridge: candidate.semanticBridge,
      })].filter(Boolean);
    }

    const canonical = extractCanonicalUrl(fetched.html, fetched.finalUrl || candidate.url);
    const finalUrl = canonical && isOfficialBrazilianHost(canonical) ? canonical : (fetched.finalUrl || candidate.url);
    if (officialUrlDisposition(finalUrl) === "reject") return [];

    const pageTitle = extractHtmlTitle(fetched.html) || candidate.text || candidate.titleHint;
    const heading = extractHtmlHeading(fetched.html);
    const description = extractMetaDescription(fetched.html);
    const mainText = extractMainTextSample(fetched.html);
    const pageSummary = clean([description, mainText].filter(Boolean).join(" "), 900);
    const pageYear = extractYearFromOfficialText(candidate.context, pageTitle, heading, description, finalUrl, mainText);
    const pageContentClass = officialContentClass(heading || pageTitle, finalUrl, pageSummary, false);

    // Evento/notícia/campanha pode ser ponte para um PDF/diretriz, mas nunca vira fonte final.
    // Ainda permitimos um único salto para descobrir um documento clínico real.
    if (pageContentClass === "non_document" && depth < 1) {
      const children = officialAnchorCandidates(fetched.html, finalUrl, topicProfile, "official_non_document_discovery")
        .filter((child) => officialUrlDisposition(child.url) === "final" || isPdfUrl(child.url))
        .slice(0, 8);
      const nested = await Promise.allSettled(children.map((child) => hydrateOfficialCandidate(child, topicProfile, depth + 1)));
      return nested.flatMap((item) => item.status === "fulfilled" ? item.value : []);
    }
    if (pageContentClass === "non_document") return [];

    // PDFs linkados por uma página oficial relevante têm preferência sobre a própria página.
    const pdfAnchors = extractHtmlAnchors(fetched.html, finalUrl)
      .filter((anchor) => isOfficialBrazilianHost(anchor.url) && (isPdfUrl(anchor.url) || /\bpdf\b/i.test(anchor.text)))
      .map((anchor) => {
        const title = anchor.text && anchor.text.length > 5 ? anchor.text : (candidate.titleHint || heading || pageTitle);
        const relevance = assessTopicRelevance({
          title: `${candidate.titleHint || ""} ${title}`,
          summary: `${heading} ${description} ${candidate.context || ""}`,
          institution: officialInstitution(anchor.url),
        }, topicProfile);
        return { ...anchor, title, relevance };
      })
      .filter((anchor) => anchor.relevance.accepted || candidate.semanticBridge?.accepted)
      .sort((a, b) => (b.relevance.score || 0) - (a.relevance.score || 0));

    if (pdfAnchors.length) {
      return pdfAnchors.slice(0, 3).map((anchor) => buildOfficialSource({
        title: anchor.title,
        url: anchor.url,
        summary: pageSummary || candidate.context || `Documento oficial relacionado a ${heading || pageTitle}.`,
        year: extractYearFromOfficialText(candidate.context, anchor.text, anchor.url, pageYear),
        topicProfile,
        originPageUrl: finalUrl,
        forcePdf: true,
        titleHint: candidate.titleHint || heading || pageTitle,
        semanticBridge: candidate.semanticBridge,
      })).filter(Boolean);
    }

    // Páginas de busca/categoria/notícia/campanha servem somente como ponte. Um único
    // salto adicional permite encontrar a página clínica real sem promover a página navegacional.
    if (officialUrlDisposition(finalUrl) === "discovery") {
      if (depth >= 1) return [];
      const children = officialAnchorCandidates(fetched.html, finalUrl, topicProfile, "official_discovery")
        .filter((child) => officialUrlDisposition(child.url) === "final" || isPdfUrl(child.url))
        .slice(0, 6);
      const nested = await Promise.allSettled(children.map((child) => hydrateOfficialCandidate(child, topicProfile, depth + 1)));
      return nested.flatMap((item) => item.status === "fulfilled" ? item.value : []);
    }

    if (!isCentralOfficialPage({ title: pageTitle, heading, url: finalUrl, topicProfile })) {
      if (candidate.sourcePdfUrl && candidate.genericDiscovery && depth < 1) {
        const evidence = await probePdfForTopic(candidate.sourcePdfUrl, topicProfile.original, topicProfile);
        if (evidence) {
          return [buildOfficialSource({
            title: evidence.titleHint || candidate.titleHint || topicProfile.original || "Documento clínico oficial",
            url: evidence.url || candidate.sourcePdfUrl,
            summary: evidence.evidenceText || candidate.context || "Documento clínico oficial validado por metadados do próprio PDF.",
            year: extractYearFromOfficialText(candidate.context, candidate.sourcePdfUrl, pageYear),
            topicProfile,
            forcePdf: true,
            titleHint: evidence.titleHint || candidate.titleHint || topicProfile.original,
            semanticBridge: candidate.semanticBridge,
          })].filter(Boolean);
        }
      }
      return [];
    }

    return [buildOfficialSource({
      title: heading || pageTitle,
      url: finalUrl,
      summary: pageSummary,
      year: pageYear,
      topicProfile,
      titleHint: candidate.titleHint,
      semanticBridge: candidate.semanticBridge,
    })].filter(Boolean);
  } catch (error) {
    // Falha ao abrir não é mais suficiente para transformar um link em evidência. A partir
    // desta versão, "verificável" significa que a URL final foi realmente aberta/validada.
    console.warn("Não foi possível validar candidato oficial", candidate.url, error?.message || error);
    return [];
  }
}

function extractAnchorsWithNearbyContext(html, baseUrl, radius = 900) {
  const source = String(html || "");
  const anchors = [];
  const regex = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(source))) {
    const rawHref = decodeHtmlEntities(match[2]).trim();
    if (!rawHref || rawHref.startsWith("#") || /^javascript:|^mailto:/i.test(rawHref)) continue;
    let url;
    try {
      url = normalizeUrl(new URL(rawHref, baseUrl).toString());
    } catch {
      continue;
    }
    if (!url) continue;
    const start = Math.max(0, match.index - radius);
    const end = Math.min(source.length, regex.lastIndex + radius);
    anchors.push({
      url,
      text: stripHtml(match[3]),
      context: stripHtml(source.slice(start, end)),
    });
  }
  return anchors;
}

function authorityDirectoryMatchScore(authority, anchor) {
  const host = hostnameOf(anchor?.url);
  if (!host || host.endsWith("amb.org.br") || /instagram|facebook|linkedin|youtube|twitter|x\.com/.test(host)) return -100;
  const context = normalizeMedicalText(`${anchor?.context || ""} ${anchor?.text || ""}`);
  const specialtyTokens = uniqueWords(normalizeMedicalText(authority.specialty).split(" ").filter((token) => token.length >= 4));
  if (!specialtyTokens.length) return 0;
  const coverage = tokenCoverage(context, specialtyTokens);
  let score = coverage * 100;
  const currentDomain = String(authority.domain || "").toLowerCase();
  if (host === currentDomain || host.endsWith(`.${currentDomain}`)) score += 35;
  if (/\.[a-z]{2,}(?:\.br)?$/i.test(host)) score += 5;
  return score;
}

async function refreshAuthoritiesFromAmbDirectory(authorities) {
  if (!Array.isArray(authorities) || !authorities.length) return [];
  try {
    const fetched = await fetchOfficialHtml(AMB_SOCIETY_DIRECTORY_URL, 4_500);
    if (fetched.isPdf || !fetched.html) return authorities;
    const anchors = extractAnchorsWithNearbyContext(fetched.html, fetched.finalUrl || AMB_SOCIETY_DIRECTORY_URL, 700);
    return authorities.map((authority) => {
      const best = anchors
        .map((anchor) => ({ anchor, score: authorityDirectoryMatchScore(authority, anchor) }))
        .filter((item) => item.score >= 72)
        .sort((a, b) => b.score - a.score)[0];
      if (!best) return authority;
      const host = hostnameOf(best.anchor.url).replace(/^www\./, "");
      if (!host) return authority;
      let baseUrl = best.anchor.url;
      try {
        const parsed = new URL(best.anchor.url);
        baseUrl = `${parsed.protocol}//${parsed.host}/`;
      } catch {
        // mantém URL completa como fallback
      }
      const refreshed = { ...authority, domain: host, baseUrl, directoryVerified: true };
      MEDICAL_SPECIALTY_BY_KEY.set(authority.key, refreshed);
      return refreshed;
    });
  } catch (error) {
    console.warn("Diretório de sociedades da AMB indisponível; usando registro local", error?.message || error);
    return authorities;
  }
}

function specialtyMatchScore(topic, authority) {
  const normalized = normalizeMedicalText(topic);
  const specialty = normalizeMedicalText(authority.specialty);
  let score = 0;
  if (normalized.includes(specialty) || specialty.split(" ").filter((t) => t.length >= 5).some((token) => normalized.includes(token))) score += 55;
  for (const rawSignal of authority.signals || []) {
    const signal = normalizeMedicalText(rawSignal);
    if (!signal) continue;
    if (normalized.includes(signal)) score += signal.includes(" ") ? 34 : Math.min(32, 10 + (signal.length * 2));
  }
  return score;
}

function authorityRoutingText(topic, semanticContext) {
  const trustedSemanticTerms = (semanticContext?.internationalTerms || [])
    .filter((item) => item?.meshValidated || item?.consensusAnchor || item?.bridgeEligible)
    .map((item) => item.term)
    .filter(Boolean)
    .slice(0, 6);
  const values = [
    topic,
    semanticContext?.nuclearMeshDescriptor,
    semanticContext?.nuclearSearchPhrase,
    semanticContext?.internationalQuery,
    ...(semanticContext?.trustedModifierTerms || []),
    ...trustedSemanticTerms,
  ].filter(Boolean);
  return clean(values.join(" "), 1400);
}

function inferRelevantMedicalAuthorities(topic, limit = 3, semanticContext = null) {
  // 13A.2.13: a sociedade pertinente não é mais inferida só pelas palavras literais do
  // português digitado. O roteador combina a consulta ORIGINAL com os conceitos clínicos
  // confiáveis já obtidos (MeSH/âncora internacional/modificadores). Isso evita "0 sociedades"
  // em temas como IVAS, sem criar uma regra doença->sociedade.
  const routingText = authorityRoutingText(topic, semanticContext) || topic;
  const scored = registeredMedicalAuthorities()
    .map((authority) => ({ authority, score: specialtyMatchScore(routingText, authority) }))
    .filter((item) => item.score >= 16)
    .sort((a, b) => b.score - a.score || a.authority.specialty.localeCompare(b.authority.specialty, "pt-BR"));

  const selected = [];
  const domains = new Set();
  for (const item of scored) {
    if (domains.has(item.authority.domain)) continue;
    selected.push(item.authority);
    domains.add(item.authority.domain);
    if (selected.length >= limit) break;
  }
  return selected;
}

function medicalTopicAcronym(topic) {
  const words = normalizeMedicalText(topic).split(" ").filter((word) =>
    word.length >= 3
    && !TOPIC_STOPWORDS.has(word)
    && !ALL_POPULATION_WORDS.has(word)
    && !GENERIC_TOPIC_WORDS.has(word)
    && !/^[0-9]+$/.test(word));
  if (words.length < 2 || words.length > 7) return "";
  const acronym = words.map((word) => word[0]).join("").toUpperCase();
  return acronym.length >= 2 && acronym.length <= 7 ? acronym : "";
}

function medicalSocietyQueryVariants(topic, semanticContext) {
  const broadTopic = broadenPortugueseTopic(topic) || topic;
  const acronym = medicalTopicAcronym(topic);
  return uniqueQueryVariants([
    broadTopic,
    acronym,
    clean(semanticContext?.nuclearSearchPhrase, 160),
    clean(semanticContext?.nuclearMeshDescriptor, 160),
  ], 3, 180);
}

function buildMedicalSocietySearchUrl(authority, topic) {
  try {
    const url = new URL(authority.baseUrl);
    url.searchParams.set("s", topic);
    return url.toString();
  } catch {
    return "";
  }
}

function wpRenderedText(value) {
  if (typeof value === "string") return stripHtml(value);
  return stripHtml(value?.rendered || value?.raw || "");
}

function looksGenericMediaTitle(title) {
  const normalized = normalizeMedicalText(title);
  return !normalized
    || /^(?:documento|arquivo|download|pdf|media|untitled)$/.test(normalized)
    || /^(?:guidelines?|diretrizes?)[ _-]?(?:completo|completa)?[ _-]?\d+$/.test(normalized)
    || /^[a-z_-]*\d{2,}[a-z0-9_-]*$/.test(normalized);
}

function decodePdfLiteral(value) {
  return String(value || "")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\[0-7]{1,3}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfTitleFromPrefix(buffer) {
  if (!buffer?.length) return "";
  const raw = buffer.toString("latin1");
  const literal = raw.match(/\/Title\s*\(([^)]{2,700})\)/i);
  if (literal?.[1]) return clean(decodePdfLiteral(literal[1]), 360);
  const xmp = raw.match(/<dc:title[^>]*>[\s\S]{0,2000}?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
  if (xmp?.[1]) return clean(stripHtml(decodeHtmlEntities(xmp[1])), 360);
  return "";
}

function pdfDiscoveryTextFromPrefix(buffer) {
  if (!buffer?.length) return "";
  const raw = buffer.toString("latin1");
  const pieces = [];
  const literalFields = /\/(?:Title|Subject|Keywords)\s*\(([^)]{2,700})\)/gi;
  let match;
  while ((match = literalFields.exec(raw))) pieces.push(decodePdfLiteral(match[1]));

  const xmpTags = [
    /<dc:title[^>]*>[\s\S]{0,2000}?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi,
    /<dc:description[^>]*>[\s\S]{0,2000}?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi,
    /<pdf:Keywords[^>]*>([\s\S]*?)<\/pdf:Keywords>/gi,
    /<dc:subject[^>]*>[\s\S]{0,3000}?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi,
  ];
  for (const regex of xmpTags) {
    while ((match = regex.exec(raw))) pieces.push(stripHtml(decodeHtmlEntities(match[1])));
  }

  // Alguns PDFs mantêm o título/assunto como texto legível no cabeçalho mesmo quando o
  // conteúdo das páginas está comprimido. Mantemos apenas sequências plausíveis e curtas.
  const printable = raw.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 _.,;:()\/\-]{18,220}/g) || [];
  for (const item of printable.slice(0, 80)) pieces.push(item);
  return clean(uniqueWords(pieces.map((item) => clean(item, 260))).join(" "), 3200);
}

async function fetchBinaryPrefix(url, maxBytes = 640_000, timeoutMs = 7_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "application/pdf,*/*;q=0.5",
        range: `bytes=0-${Math.max(1023, maxBytes - 1)}`,
        "user-agent": "FicharioMed/1.0 (medical-source-discovery)",
      },
    });
    if (!response.ok && response.status !== 206) throw new Error(`pdf_probe_${response.status}`);
    const reader = response.body?.getReader?.();
    if (!reader) {
      const array = new Uint8Array(await response.arrayBuffer());
      return { buffer: Buffer.from(array.slice(0, maxBytes)), finalUrl: response.url || url, contentType: response.headers.get("content-type") || "" };
    }
    const chunks = [];
    let total = 0;
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      const remaining = maxBytes - total;
      const piece = value.length > remaining ? value.slice(0, remaining) : value;
      chunks.push(Buffer.from(piece));
      total += piece.length;
      if (total >= maxBytes) break;
    }
    try { await reader.cancel(); } catch {}
    return { buffer: Buffer.concat(chunks), finalUrl: response.url || url, contentType: response.headers.get("content-type") || "" };
  } finally {
    clearTimeout(timer);
  }
}

async function probePdfForTopic(url, topic, topicProfile) {
  try {
    const fetched = await fetchBinaryPrefix(url);
    const text = pdfDiscoveryTextFromPrefix(fetched.buffer);
    const pdfTitle = pdfTitleFromPrefix(fetched.buffer);
    const acronym = medicalTopicAcronym(topic);
    const normalizedEvidence = normalizeMedicalText(`${url} ${text}`);
    const acronymHit = acronym && new RegExp(`(?:^|[^a-z0-9])${acronym.toLowerCase()}(?:[^a-z0-9]|$)`, "i").test(normalizedEvidence);
    const relevance = assessTopicRelevance({ title: text, summary: text, institution: officialInstitution(url) }, topicProfile);
    if (!relevance.accepted && !acronymHit) return null;
    const titleRelevance = pdfTitle ? assessTopicRelevance({ title: pdfTitle, summary: text, institution: officialInstitution(url) }, topicProfile) : null;
    return {
      url: normalizeUrl(fetched.finalUrl || url),
      evidenceText: clean(text, 1200),
      relevanceScore: acronymHit ? Math.max(82, relevance.score || 0) : (relevance.score || 0),
      // Só usamos o título bruto do PDF se ele próprio representa o tema. Metadado com
      // encoding ruim ou nome técnico do arquivo não pode prejudicar a validação final.
      titleHint: titleRelevance?.accepted ? pdfTitle : clean(topic, 300),
    };
  } catch {
    return null;
  }
}

function wpMedicalSocietyCandidates(items, authority, query, topic, topicProfile, sourceKind, options = {}) {
  const candidates = [];
  const genericDiscovery = options.genericDiscovery === true;
  for (const item of Array.isArray(items) ? items : []) {
    const rawTitle = clean(wpRenderedText(item?.title) || item?.slug, 500);
    const rawSummary = clean([
      wpRenderedText(item?.caption),
      wpRenderedText(item?.description),
      wpRenderedText(item?.excerpt),
      clean(item?.alt_text, 300),
    ].filter(Boolean).join(" "), 900);
    const sourceUrl = normalizeUrl(item?.source_url || item?.guid?.rendered || item?.guid);
    const attachmentUrl = normalizeUrl(item?.url || item?.link);
    const genericTitle = looksGenericMediaTitle(rawTitle);

    // Em busca documental genérica, um PDF com nome opaco não ganha relevância porque nós
    // mesmos pesquisamos "guideline". Primeiro tentamos a página de attachment, que será
    // hidratada e validada pelo conteúdo real. O PDF direto só será aceito via probe abaixo.
    const candidateUrl = genericDiscovery && genericTitle && attachmentUrl ? attachmentUrl : (sourceUrl || attachmentUrl);
    if (!candidateUrl || !isOfficialBrazilianHost(candidateUrl) || officialUrlDisposition(candidateUrl) === "reject") continue;

    const metadataLooksClinical = /\b(?:guideline|diretriz|consenso|protocolo|recomendacao|posicionamento)\b/i.test(`${rawTitle} ${rawSummary}`);
    const metadataTitle = metadataLooksClinical ? clean(rawSummary.split(/[.!?](?:\s|$)/)[0], 260) : "";
    const titleHint = genericTitle ? (genericDiscovery ? metadataTitle : (metadataTitle || clean(topic, 300))) : rawTitle;
    const contextParts = genericDiscovery
      ? [rawSummary, rawTitle, authority.name]
      : [query, rawSummary, rawTitle, authority.name];
    const context = clean(contextParts.filter(Boolean).join(" "), 1000);
    const ranked = officialCandidateRank({
      url: candidateUrl,
      text: genericTitle ? "" : rawTitle,
      titleHint,
      context,
    }, topicProfile, sourceKind);

    // Para descoberta genérica, mantemos attachment pages de documentos clínicos como ponte,
    // mesmo antes da relevância temática; hydrateOfficialCandidate fará a validação final.
    if (!ranked.relevance.accepted && !(genericDiscovery && (metadataLooksClinical || genericTitle))) continue;
    candidates.push({
      url: candidateUrl,
      text: genericTitle ? "" : rawTitle,
      titleHint,
      context,
      sourcePdfUrl: sourceUrl && isPdfUrl(sourceUrl) ? sourceUrl : "",
      genericDiscovery,
      relevanceScore: ranked.relevance.score || 0,
      candidateRank: ranked.score + (isPdfUrl(candidateUrl) ? 28 : (genericDiscovery ? 4 : 10)),
      sourceKind,
    });
  }
  return candidates;
}

async function fetchSocietyJsonWithTimeout(url, timeoutMs = 6_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "FicharioMed/1.0 (medical-source-discovery)" },
    });
    if (!response.ok) throw new Error(`json_fetch_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function medicalSocietyWordPressSearch(authority, query, topic, topicProfile, options = {}) {
  let base;
  try {
    base = new URL(authority.baseUrl);
  } catch {
    return [];
  }
  const genericDiscovery = options.genericDiscovery === true;
  const params = new URLSearchParams({ search: query, per_page: genericDiscovery ? "30" : "20" });
  const endpoints = [
    { path: "/wp-json/wp/v2/search", fields: "id,title,url,subtype", kind: `medical_society_wp_search:${authority.key}` },
    { path: "/wp-json/wp/v2/media", fields: "id,date,slug,link,title,source_url,mime_type,caption,description,alt_text,post,guid", kind: `medical_society_wp_media:${authority.key}` },
  ];
  const tasks = endpoints.map(async (endpoint) => {
    const url = new URL(endpoint.path, `${base.protocol}//${base.host}/`);
    for (const [key, value] of params.entries()) url.searchParams.set(key, value);
    url.searchParams.set("_fields", endpoint.fields);
    try {
      const data = await fetchSocietyJsonWithTimeout(url.toString());
      const candidates = wpMedicalSocietyCandidates(data, authority, query, topic, topicProfile, endpoint.kind, { genericDiscovery });

      // Quando uma busca por "guideline/diretriz" encontra um PDF com nome opaco, fazemos
      // uma leitura MINIMAL do prefixo/metadados do próprio PDF apenas para provar a relação
      // com o tema. Isto não substitui a futura leitura integral usada para gerar flashcards.
      if (genericDiscovery && endpoint.path.endsWith("/media")) {
        const probeItems = (Array.isArray(data) ? data : [])
          .filter((item) => {
            const rawTitle = clean(wpRenderedText(item?.title) || item?.slug, 500);
            const sourceUrl = normalizeUrl(item?.source_url || item?.guid?.rendered || item?.guid);
            return looksGenericMediaTitle(rawTitle) && sourceUrl && isPdfUrl(sourceUrl) && isOfficialBrazilianHost(sourceUrl);
          })
          .slice(0, 10);
        const probed = await Promise.allSettled(probeItems.map(async (item) => {
          const sourceUrl = normalizeUrl(item?.source_url || item?.guid?.rendered || item?.guid);
          const evidence = await probePdfForTopic(sourceUrl, topic, topicProfile);
          if (!evidence) return null;
          return {
            url: evidence.url || sourceUrl,
            text: "",
            titleHint: evidence.titleHint,
            context: clean(`${evidence.evidenceText} ${authority.name}`, 1200),
            relevanceScore: evidence.relevanceScore,
            candidateRank: 116 + Math.min(20, Math.round((evidence.relevanceScore || 0) / 5)),
            sourceKind: `${endpoint.kind}:pdf_probe`,
          };
        }));
        for (const item of probed) {
          if (item.status === "fulfilled" && item.value) candidates.push(item.value);
        }
      }
      return candidates;
    } catch {
      return [];
    }
  });
  const settled = await Promise.allSettled(tasks);
  return settled.flatMap((item) => item.status === "fulfilled" ? item.value : []);
}

function medicalSocietyDocumentDiscoveryQueries(topic, semanticContext) {
  const acronym = medicalTopicAcronym(topic);
  return uniqueQueryVariants([
    acronym ? `guideline ${acronym}` : "",
    acronym ? `diretriz ${acronym}` : "",
    "guideline",
    "diretriz",
    "consenso",
    "protocolo",
  ], 4, 120);
}

async function searchMedicalSocietyAuthority(authority, topic, topicProfile, semanticContext) {
  const variants = medicalSocietyQueryVariants(topic, semanticContext);
  if (!variants.length) return [];
  const specificTasks = [];

  // Busca HTML principal com o tema mais informativo.
  const htmlSearchUrl = buildMedicalSocietySearchUrl(authority, variants[0]);
  if (htmlSearchUrl) specificTasks.push(officialSearchPage(htmlSearchUrl, topicProfile, `medical_society:${authority.key}`));

  for (const query of variants.slice(0, 2)) {
    specificTasks.push(medicalSocietyWordPressSearch(authority, query, topic, topicProfile));
  }

  const specificSettled = await Promise.allSettled(specificTasks);
  let candidates = specificSettled.flatMap((item) => item.status === "fulfilled" ? item.value : []);

  // 13A.2.14: se a pesquisa temática do portal não expõe a diretriz (muito comum em PDFs
  // antigos/attachments), entramos na biblioteca documental da sociedade por TIPO de
  // documento. A relação com o tema continua sendo validada depois; "guideline" sozinho
  // nunca torna um PDF relevante.
  if (candidates.length < 3) {
    const fallbackQueries = medicalSocietyDocumentDiscoveryQueries(topic, semanticContext);
    const fallbackTasks = [];
    for (const query of fallbackQueries) {
      const fallbackHtml = buildMedicalSocietySearchUrl(authority, query);
      if (fallbackHtml) fallbackTasks.push(officialSearchPage(fallbackHtml, topicProfile, `medical_society_document_search:${authority.key}`));
      fallbackTasks.push(medicalSocietyWordPressSearch(authority, query, topic, topicProfile, { genericDiscovery: true }));
    }
    const fallbackSettled = await Promise.allSettled(fallbackTasks);
    candidates = candidates.concat(fallbackSettled.flatMap((item) => item.status === "fulfilled" ? item.value : []));
  }

  const seen = new Set();
  return candidates
    .sort((a, b) => (b.candidateRank || 0) - (a.candidateRank || 0))
    .filter((candidate) => {
      const key = normalizeUrl(candidate.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24);
}

function semanticTermFromOpenAlexItem(item, source = "openalex", work = null) {
  const term = clean(item?.display_name || item?.name, 180);
  if (!term) return null;
  const tokens = canonicalTopicTokens(term, { keepPopulation: true });
  if (!tokens.length || tokens.every((token) => SEMANTIC_GENERIC_WORDS.has(token))) return null;
  const score = Number(item?.score);
  return {
    term,
    source,
    confidence: Number.isFinite(score) ? Math.max(0.35, Math.min(1, score)) : 0.62,
    supportCount: 1,
    workRelevance: Number(work?.relevance_score) || 0,
  };
}

function openAlexWorkSemanticTerms(work) {
  const terms = [];
  for (const item of Array.isArray(work?.keywords) ? work.keywords : []) {
    const parsed = semanticTermFromOpenAlexItem(item, "openalex_keyword", work);
    if (parsed) terms.push(parsed);
  }
  for (const item of Array.isArray(work?.topics) ? work.topics : []) {
    const parsed = semanticTermFromOpenAlexItem(item, "openalex_topic", work);
    if (parsed) terms.push(parsed);
  }
  return terms;
}


const ENGLISH_SEED_PHRASE_EDGE_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with", "without", "from", "by", "among", "versus", "vs",
]);

const ENGLISH_SEED_PHRASE_BLOCKED_WORDS = new Set([
  "review", "systematic", "meta", "analysis", "study", "studies", "guideline", "guidelines", "consensus",
  "management", "treatment", "therapy", "therapies", "diagnosis", "diagnostic", "clinical", "practice", "update",
  "updates", "current", "new", "novel", "overview", "approach", "evidence", "recommendation", "recommendations",
  "association", "associations", "outcomes", "outcome", "cohort", "trial", "randomized", "randomised", "patients",
  "patient", "adults", "adult", "children", "child", "pregnancy", "pregnant", "older", "young",
]);

function titlePhraseDisplay(words) {
  return words.map((word, index) => {
    if (index > 0 && ENGLISH_SEED_PHRASE_EDGE_STOPWORDS.has(word)) return word;
    return word ? `${word[0].toUpperCase()}${word.slice(1)}` : word;
  }).join(" ");
}

// 13A.2.10: os títulos dos próprios trabalhos recuperados servem apenas como ponte
// bilíngue ancorada NA CONSULTA ORIGINAL. Isso é diferente de usar um Topic amplo como
// "tradução". Extraímos frases recorrentes/altamente posicionadas e depois exigimos
// validação MeSH antes de qualquer frase ganhar poder de consulta.
function seedTitleSemanticPhrases(works) {
  const phrases = new Map();
  (works || []).slice(0, 14).forEach((work, workIndex) => {
    const language = String(work?.language || "").toLowerCase();
    if (language === "pt" || language.startsWith("pt-")) return;
    const words = normalizeMedicalText(work?.display_name || "").split(" ").filter(Boolean).slice(0, 30);
    if (words.length < 2) return;
    const workKey = String(work?.id || work?.display_name || workIndex);
    for (let size = 2; size <= Math.min(7, words.length); size += 1) {
      for (let start = 0; start + size <= words.length; start += 1) {
        const chunk = words.slice(start, start + size);
        if (ENGLISH_SEED_PHRASE_EDGE_STOPWORDS.has(chunk[0]) || ENGLISH_SEED_PHRASE_EDGE_STOPWORDS.has(chunk[chunk.length - 1])) continue;
        const meaningful = chunk.filter((word) => !ENGLISH_SEED_PHRASE_EDGE_STOPWORDS.has(word) && !ENGLISH_SEED_PHRASE_BLOCKED_WORDS.has(word));
        if (meaningful.length < 2) continue;
        if (meaningful.every((word) => SEMANTIC_GENERIC_WORDS.has(word))) continue;
        // Evita frases puramente metodológicas mesmo quando contêm 2+ palavras.
        if (meaningful.filter((word) => ENGLISH_SEED_PHRASE_BLOCKED_WORDS.has(word)).length >= Math.max(1, meaningful.length - 1)) continue;
        const key = chunk.join(" ");
        const current = phrases.get(key) || {
          term: titlePhraseDisplay(chunk),
          source: "seed_title_phrase",
          sources: new Set(["seed_title_phrase"]),
          supportCount: 0,
          confidence: 0.68,
          bestPosition: 999,
          workIds: new Set(),
          workRelevance: 0,
        };
        if (!current.workIds.has(workKey)) {
          current.workIds.add(workKey);
          current.supportCount += 1;
        }
        current.bestPosition = Math.min(current.bestPosition, workIndex);
        current.workRelevance = Math.max(current.workRelevance || 0, Number(work?.relevance_score) || 0);
        current.confidence = Math.min(0.96, 0.68 + Math.min(0.18, current.supportCount * 0.05) + (workIndex < 3 ? 0.06 : 0));
        phrases.set(key, current);
      }
    }
  });

  return Array.from(phrases.values())
    .filter((item) => item.supportCount >= 2 || item.bestPosition <= 2)
    .sort((a, b) =>
      (b.supportCount || 0) - (a.supportCount || 0)
      || (a.bestPosition || 999) - (b.bestPosition || 999)
      || semanticPhraseTokens(b.term).length - semanticPhraseTokens(a.term).length)
    .slice(0, 16)
    .map((item) => ({
      ...item,
      sources: Array.from(item.sources || []),
      workIds: undefined,
    }));
}

function aggregateSemanticTerms(terms) {
  const map = new Map();
  for (const item of terms) {
    const key = normalizeMedicalText(item?.term);
    if (!key) continue;
    const current = map.get(key) || { ...item, supportCount: 0, maxConfidence: 0, sources: new Set() };
    current.supportCount += Number(item?.supportCount) || 1;
    current.maxConfidence = Math.max(current.maxConfidence || 0, Number(item?.confidence) || 0);
    current.confidence = Math.max(Number(current.confidence) || 0, Number(item?.confidence) || 0);
    current.workRelevance = Math.max(Number(current.workRelevance) || 0, Number(item?.workRelevance) || 0);
    current.sources.add(item?.source || "openalex");
    map.set(key, current);
  }
  return Array.from(map.values()).map((item) => {
    const sourcePriority = ["query_phrase", "seed_title_phrase", "openalex_keyword", "openalex_topic", "portuguese_seed"];
    const source = sourcePriority.find((value) => item.sources.has(value)) || item.source || "openalex";
    return {
      ...item,
      source,
      sources: Array.from(item.sources),
    };
  });
}

async function openAlexSemanticSeedRequest(query, perPage = 12, portugueseOnly = true) {
  const params = new URLSearchParams({
    search: clean(query, 220),
    per_page: String(Math.max(6, Math.min(20, perPage))),
    select: [
      "id", "display_name", "publication_year", "language", "relevance_score",
      "abstract_inverted_index", "topics", "keywords",
    ].join(","),
  });
  if (portugueseOnly) params.set("filter", "language:pt");
  const response = await fetch(`${OPENALEX_BASE}/works?${params.toString()}`, {
    headers: { accept: "application/json", "user-agent": "FicharioMed/1.0" },
  });
  if (!response.ok) throw new Error(`openalex_semantic_seed_${response.status}`);
  const data = await response.json();
  return Array.isArray(data?.results) ? data.results : [];
}

async function openAlexSemanticSeedWorks(query, perPage = 12, includeUnrestricted = true) {
  let portuguese = [];
  let unrestricted = [];
  try {
    portuguese = await openAlexSemanticSeedRequest(query, perPage, true);
  } catch (error) {
    console.warn("Semente OpenAlex em português indisponível", error?.message || error);
  }

  // 13A.2.10: um pequeno conjunto sem filtro de idioma fornece âncoras bilíngues, mas só
  // para a primeira forma da consulta. Isso reduz chamadas e impede que o broadening gere
  // vários grupos de Topics concorrendo com a query original. Nada daqui vira conceito
  // obrigatório sem validação MeSH + alinhamento com a consulta.
  if (includeUnrestricted) {
    try {
      unrestricted = await openAlexSemanticSeedRequest(query, Math.min(10, perPage), false);
    } catch (error) {
      console.warn("Âncoras internacionais OpenAlex indisponíveis", error?.message || error);
    }
  }

  const bestById = new Map();
  for (const work of [...portuguese, ...unrestricted]) {
    const key = clean(String(work?.id || work?.display_name || ""), 220);
    if (!key || bestById.has(key)) continue;
    bestById.set(key, work);
  }
  return {
    works: Array.from(bestById.values()).slice(0, 20),
    portugueseCount: portuguese.length,
    unrestrictedCount: unrestricted.length,
    languageFallbackUsed: portuguese.length < 4 && unrestricted.length > 0,
  };
}

function semanticPortugueseCandidates(works, profile) {
  const counts = new Map();
  const workHits = new Map();
  const core = new Set(profile.coreTokens);
  works.slice(0, 18).forEach((work, workIndex) => {
    const title = normalizeMedicalText(work?.display_name || "");
    const abstract = normalizeMedicalText(reconstructOpenAlexAbstract(work?.abstract_inverted_index));
    const titleWords = title.split(" ").filter(Boolean);
    const bodyWords = abstract.split(" ").filter(Boolean);
    const seenInWork = new Set();
    const add = (word, weight) => {
      if (!word || word.length < 5 || /^[0-9]+$/.test(word)) return;
      if (TOPIC_STOPWORDS.has(word) || SEMANTIC_GENERIC_WORDS.has(word) || ALL_POPULATION_WORDS.has(word) || core.has(word)) return;
      counts.set(word, (counts.get(word) || 0) + weight + (workIndex < 4 ? 1 : 0));
      if (!seenInWork.has(word)) {
        workHits.set(word, (workHits.get(word) || 0) + 1);
        seenInWork.add(word);
      }
    };
    titleWords.forEach((word) => add(word, 3));
    bodyWords.forEach((word) => add(word, 1));
  });
  return Array.from(counts.entries())
    .filter(([, score]) => score >= 4)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 14)
    .map(([term, score]) => ({
      term,
      source: "portuguese_seed",
      confidence: Math.min(0.9, 0.46 + (score / 24)),
      supportCount: workHits.get(term) || 1,
    }));
}

const MESH_CANONICAL_CACHE = new Map();
const MESH_TREE_CACHE = new Map();
const MESH_DETAILS_CACHE = new Map();

function boundedCacheSet(cache, key, value, max = 300) {
  if (cache.size >= max) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = MESH_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "FicharioMed/1.0", ...(options.headers || {}) },
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function meshResourceId(resource) {
  const match = String(resource || "").match(/\/mesh\/([A-Z]\d+)$/i);
  return match?.[1] || "";
}

function escapeSparqlString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
}

async function meshSparql(query) {
  const params = new URLSearchParams({ query, format: "JSON", inference: "true", limit: "50" });
  const data = await fetchJsonWithTimeout(`${MESH_SPARQL_URL}?${params.toString()}`, {}, MESH_FETCH_TIMEOUT_MS + 2_000);
  return Array.isArray(data?.results?.bindings) ? data.results.bindings : [];
}

async function meshDescriptorTreeNumbers(descriptorId) {
  const id = String(descriptorId || "").trim();
  if (!/^D\d+$/i.test(id)) return [];
  if (MESH_TREE_CACHE.has(id)) return MESH_TREE_CACHE.get(id);
  try {
    const query = `PREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#>\nPREFIX mesh: <http://id.nlm.nih.gov/mesh/>\nSELECT DISTINCT ?tree WHERE { mesh:${id} meshv:treeNumber ?tree . }`;
    const rows = await meshSparql(query);
    const trees = uniqueWords(rows.map((row) => String(row?.tree?.value || "").split("/mesh/").pop()).filter(Boolean));
    boundedCacheSet(MESH_TREE_CACHE, id, trees);
    return trees;
  } catch (error) {
    console.warn("Árvore MeSH indisponível", id, error?.message || error);
    boundedCacheSet(MESH_TREE_CACHE, id, []);
    return [];
  }
}

async function meshDescriptorDetails(descriptorId) {
  const id = String(descriptorId || "").trim();
  if (!/^D\d+$/i.test(id)) return { seealso: [], terms: [] };
  if (MESH_DETAILS_CACHE.has(id)) return MESH_DETAILS_CACHE.get(id);
  try {
    const params = new URLSearchParams({ descriptor: id, includes: "seealso,terms" });
    const data = await fetchJsonWithTimeout(`${MESH_LOOKUP_BASE}/details?${params.toString()}`);
    const details = {
      seealso: (Array.isArray(data?.seealso) ? data.seealso : []).map((item) => ({
        id: meshResourceId(item?.resource),
        label: clean(item?.label, 180),
      })).filter((item) => item.id),
      terms: (Array.isArray(data?.terms) ? data.terms : []).map((item) => clean(item?.label, 180)).filter(Boolean),
    };
    boundedCacheSet(MESH_DETAILS_CACHE, id, details);
    return details;
  } catch (error) {
    console.warn("Detalhes MeSH indisponíveis", id, error?.message || error);
    const empty = { seealso: [], terms: [] };
    boundedCacheSet(MESH_DETAILS_CACHE, id, empty);
    return empty;
  }
}

async function meshDescriptorTreesBatch(descriptorIds) {
  const ids = uniqueWords((descriptorIds || []).filter((id) => /^D\d+$/i.test(String(id))));
  if (!ids.length) return new Map();
  const result = new Map(ids.map((id) => [id, MESH_TREE_CACHE.get(id) || []]));
  const missing = ids.filter((id) => !MESH_TREE_CACHE.has(id));
  if (!missing.length) return result;
  try {
    const values = missing.map((id) => `mesh:${id}`).join(" ");
    const query = `PREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#>\nPREFIX mesh: <http://id.nlm.nih.gov/mesh/>\nSELECT DISTINCT ?d ?tree WHERE { VALUES ?d { ${values} } ?d meshv:treeNumber ?tree . }`;
    const rows = await meshSparql(query);
    const grouped = new Map(missing.map((id) => [id, []]));
    for (const row of rows) {
      const id = meshResourceId(row?.d?.value);
      const tree = String(row?.tree?.value || "").split("/mesh/").pop();
      if (id && tree && grouped.has(id)) grouped.get(id).push(tree);
    }
    for (const id of missing) {
      const trees = uniqueWords(grouped.get(id) || []);
      boundedCacheSet(MESH_TREE_CACHE, id, trees);
      result.set(id, trees);
    }
  } catch (error) {
    console.warn("Árvores MeSH em lote indisponíveis", error?.message || error);
  }
  return result;
}

async function meshDescriptorFromEntryTerm(termResource) {
  const termId = meshResourceId(termResource);
  if (!/^T\d+$/i.test(termId)) return null;
  try {
    const query = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nPREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#>\nPREFIX mesh: <http://id.nlm.nih.gov/mesh/>\nSELECT DISTINCT ?d ?dLabel ?tree WHERE { ?d meshv:concept ?c . ?c meshv:term mesh:${termId} . ?d rdfs:label ?dLabel . OPTIONAL { ?d meshv:treeNumber ?tree . } }`;
    const rows = await meshSparql(query);
    if (!rows.length) return null;
    const descriptorId = meshResourceId(rows[0]?.d?.value);
    const label = clean(rows[0]?.dLabel?.value, 180);
    const treeNumbers = uniqueWords(rows.map((row) => String(row?.tree?.value || "").split("/mesh/").pop()).filter(Boolean));
    if (!descriptorId || !label) return null;
    return { descriptorId, label, treeNumbers, matchType: "entry_term" };
  } catch {
    return null;
  }
}

function meshLabelSimilarity(input, candidate) {
  const left = new Set(semanticPhraseTokens(input));
  const right = new Set(semanticPhraseTokens(candidate));
  if (!left.size || !right.size) return 0;
  const intersection = Array.from(left).filter((token) => right.has(token)).length;
  return Math.max(intersection / left.size, intersection / right.size);
}

function meshLabelBalancedSimilarity(input, candidate) {
  const left = new Set(semanticPhraseTokens(input));
  const right = new Set(semanticPhraseTokens(candidate));
  if (!left.size || !right.size) return 0;
  const intersection = Array.from(left).filter((token) => right.has(token)).length;
  // Para "contains" não basta o descritor curto estar contido no título longo; exigimos
  // que a maior parte dos DOIS lados represente o mesmo conceito clínico.
  return intersection / Math.max(left.size, right.size);
}

async function meshCanonicalizeLabel(label) {
  const cleaned = clean(label, 180);
  const cacheKey = normalizeMedicalText(cleaned);
  if (!cacheKey) return null;
  if (MESH_CANONICAL_CACHE.has(cacheKey)) return MESH_CANONICAL_CACHE.get(cacheKey);

  let result = null;
  try {
    const exactParams = new URLSearchParams({ label: cleaned, match: "exact", limit: "5", year: "current" });
    const exact = await fetchJsonWithTimeout(`${MESH_LOOKUP_BASE}/descriptor?${exactParams.toString()}`);
    if (Array.isArray(exact) && exact.length) {
      const descriptorId = meshResourceId(exact[0]?.resource);
      if (descriptorId) result = {
        descriptorId,
        label: clean(exact[0]?.label, 180) || cleaned,
        treeNumbers: [],
        matchType: "descriptor_exact",
      };
    }

    if (!result) {
      const termParams = new URLSearchParams({ label: cleaned, match: "exact", limit: "5" });
      const terms = await fetchJsonWithTimeout(`${MESH_LOOKUP_BASE}/term?${termParams.toString()}`);
      if (Array.isArray(terms) && terms.length) result = await meshDescriptorFromEntryTerm(terms[0]?.resource);
    }

    // Entry terms são essenciais para subtipos: por exemplo, uma frase clínica usada no
    // título pode ser sinônimo de um descritor MeSH mais específico. O "contains" só é
    // aceito com similaridade alta e continua sendo resolvido para o descriptor oficial.
    if (!result && cleaned.length >= 6) {
      const termContainsParams = new URLSearchParams({ label: cleaned, match: "contains", limit: "12" });
      const termCandidates = await fetchJsonWithTimeout(`${MESH_LOOKUP_BASE}/term?${termContainsParams.toString()}`);
      const rankedTerms = (Array.isArray(termCandidates) ? termCandidates : [])
        .map((item) => ({ item, similarity: meshLabelBalancedSimilarity(cleaned, item?.label) }))
        .sort((a, b) => b.similarity - a.similarity);
      if (rankedTerms[0]?.similarity >= 0.78) {
        const mapped = await meshDescriptorFromEntryTerm(rankedTerms[0].item?.resource);
        if (mapped) result = { ...mapped, matchType: "entry_term_contains" };
      }
    }

    if (!result && cleaned.length >= 6) {
      const containsParams = new URLSearchParams({ label: cleaned, match: "contains", limit: "8", year: "current" });
      const candidates = await fetchJsonWithTimeout(`${MESH_LOOKUP_BASE}/descriptor?${containsParams.toString()}`);
      const ranked = (Array.isArray(candidates) ? candidates : [])
        .map((item) => ({ item, similarity: meshLabelBalancedSimilarity(cleaned, item?.label) }))
        .sort((a, b) => b.similarity - a.similarity);
      if (ranked[0]?.similarity >= 0.72) {
        const descriptorId = meshResourceId(ranked[0].item?.resource);
        if (descriptorId) result = {
          descriptorId,
          label: clean(ranked[0].item?.label, 180),
          treeNumbers: [],
          matchType: "descriptor_contains",
        };
      }
    }
  } catch (error) {
    console.warn("MeSH lookup indisponível", cleaned, error?.message || error);
  }

  boundedCacheSet(MESH_CANONICAL_CACHE, cacheKey, result);
  return result;
}

function meshTreeCommonPrefixDepth(leftTrees = [], rightTrees = []) {
  let best = 0;
  for (const left of leftTrees || []) {
    const a = String(left).split(".").filter(Boolean);
    for (const right of rightTrees || []) {
      const b = String(right).split(".").filter(Boolean);
      let depth = 0;
      while (depth < a.length && depth < b.length && a[depth] === b[depth]) depth += 1;
      best = Math.max(best, depth);
    }
  }
  return best;
}

function preliminarySemanticRank(item, topicProfile) {
  const termTokens = semanticPhraseTokens(item.term);
  const topicCognates = new Set(topicProfile.coreTokens.map((token) => normalizeMedicalCognate(token)));
  const termCognates = termTokens.map((token) => normalizeMedicalCognate(token));
  const directOverlap = termCognates.filter((token) => topicCognates.has(token)).length;

  // 13A.2.11: a fórmula antiga dividia pelo MENOR conjunto. Isso fazia um fragmento curto
  // da pergunta (ex.: "ejection fraction") atingir alinhamento 1.0 mesmo cobrindo apenas
  // uma parte da consulta "heart failure with reduced ejection fraction". Agora medimos
  // precisão do candidato E cobertura da consulta e usamos a média harmônica (F1).
  // Assim um fragmento genérico não pode vencer uma expressão clínica mais completa.
  const candidatePrecision = directOverlap / Math.max(1, termCognates.length || 1);
  const queryCoverage = directOverlap / Math.max(1, topicCognates.size || 1);
  const coreAlignment = (candidatePrecision + queryCoverage) > 0
    ? (2 * candidatePrecision * queryCoverage) / (candidatePrecision + queryCoverage)
    : 0;
  const populationBonus = Array.from(topicProfile.populations).some((population) => {
    const termsForPopulation = POPULATION_TERMS[population] || [];
    return termsForPopulation.some((term) => normalizeMedicalText(item.term).includes(normalizeMedicalText(term)));
  }) ? 0.22 : 0;
  const itemSources = item.sources || [item.source];
  const sourceBonus = itemSources.includes("query_phrase") ? 0.72
    : itemSources.includes("seed_title_phrase") ? 0.58
      : itemSources.includes("openalex_keyword") ? 0.28 : 0.06;
  const supportBonus = Math.min(0.32, Math.max(0, (Number(item.supportCount) || 1) - 1) * 0.08);
  const specificityBonus = Math.min(0.18, Math.max(0, termTokens.length - 1) * 0.05);
  return {
    ...item,
    directOverlap,
    candidatePrecision,
    queryCoverage,
    coreAlignment,
    preliminaryRank: (Number(item.confidence) || 0.5)
      + (coreAlignment * 0.9)
      + (queryCoverage * 0.7)
      + sourceBonus + supportBonus + specificityBonus + populationBonus,
  };
}

async function enrichSemanticTermsWithMesh(terms, topicProfile) {
  const ranked = terms.map((item) => preliminarySemanticRank(item, topicProfile))
    .sort((a, b) => b.preliminaryRank - a.preliminaryRank);

  // A consulta original precisa sempre estar presente. Depois reservamos espaços para
  // títulos-semente, keywords e Topics em proporções pequenas. Isso evita que dezenas de
  // n-gramas de títulos ocupem toda a canonicalização e também reduz chamadas ao MeSH.
  const selected = [];
  const seenKeys = new Set();
  const add = (item) => {
    if (!item || selected.length >= 10) return false;
    const key = normalizeMedicalText(item.term || "");
    if (!key || seenKeys.has(key)) return false;
    selected.push(item);
    seenKeys.add(key);
    return true;
  };
  const take = (predicate, count) => {
    let added = 0;
    for (const item of ranked) {
      if (added >= count || selected.length >= 10) break;
      if (!predicate(item)) continue;
      if (add(item)) added += 1;
    }
  };

  take((item) => (item.sources || [item.source]).includes("query_phrase"), 1);
  // Primeiro entram títulos/keywords que realmente cobrem a consulta original. Isso evita
  // que um título dermatológico aleatório, embora MeSH-válido, roube o núcleo do tema.
  take((item) => (item.sources || [item.source]).includes("seed_title_phrase") && (item.queryCoverage || 0) >= 0.34, 5);
  take((item) => (item.sources || [item.source]).includes("openalex_keyword") && (item.queryCoverage || 0) >= 0.34, 3);
  // Topic do OpenAlex continua útil para ponte/enriquecimento, mas não recebe prioridade
  // de canonicalização nuclear.
  take((item) => (item.sources || [item.source]).includes("seed_title_phrase"), 1);
  take((item) => (item.sources || [item.source]).includes("openalex_topic"), 1);
  for (const item of ranked) {
    if (selected.length >= 10) break;
    add(item);
  }

  // Concorrência moderada: busca serverless precisa ser previsível e não disparar uma
  // rajada de requests ao MeSH em cada termo pesquisado.
  const enriched = [];
  for (let offset = 0; offset < selected.length; offset += 5) {
    const batch = selected.slice(offset, offset + 5);
    const settled = await Promise.allSettled(batch.map((item) => meshCanonicalizeLabel(item.term)));
    settled.forEach((result, index) => {
      const item = batch[index];
      const mesh = result.status === "fulfilled" ? result.value : null;
      enriched.push({
        ...item,
        meshValidated: Boolean(mesh?.descriptorId),
        meshDescriptorId: mesh?.descriptorId || "",
        meshLabel: mesh?.label || "",
        meshTreeNumbers: mesh?.treeNumbers || [],
        meshMatchType: mesh?.matchType || "",
        rank: item.preliminaryRank + (mesh?.descriptorId ? 0.48 : 0) + (mesh?.matchType === "descriptor_exact" ? 0.12 : 0),
      });
    });
  }

  const treeMap = await meshDescriptorTreesBatch(enriched.filter((item) => item.meshValidated).map((item) => item.meshDescriptorId));
  for (const item of enriched) {
    if (item.meshValidated) item.meshTreeNumbers = treeMap.get(item.meshDescriptorId) || item.meshTreeNumbers || [];
  }
  return enriched.sort((a, b) => b.rank - a.rank);
}

function meshTreeDepth(treeNumbers = []) {
  return Math.max(0, ...(treeNumbers || []).map((tree) => String(tree).split(".").filter(Boolean).length));
}

function meshClinicalCategoryScore(treeNumbers = []) {
  let positive = 0;
  let disciplineOnly = false;
  for (const tree of treeNumbers || []) {
    const value = String(tree || "").toUpperCase();
    if (/^C\d/.test(value)) positive = Math.max(positive, 1.0);               // Diseases
    else if (/^F03(?:\.|$)/.test(value)) positive = Math.max(positive, 0.96); // Mental disorders
    else if (/^G\d/.test(value)) positive = Math.max(positive, 0.28);          // phenomena/processes
    else if (/^N\d/.test(value)) positive = Math.max(positive, 0.16);          // health care
    else if (/^H\d/.test(value)) disciplineOnly = true;                       // disciplines/occupations
  }
  // Um descriptor que também está em árvore clínica não é penalizado só por possuir
  // classificação adicional. A penalidade vale para conceitos puramente disciplinares.
  return positive > 0 ? positive : (disciplineOnly ? -0.85 : 0);
}

function sourceEvidenceWeight(item) {
  const sources = item?.sources || [item?.source];
  if (sources.includes("query_phrase")) return 0.9;
  if (sources.includes("seed_title_phrase")) return 0.72;
  if (sources.includes("openalex_keyword")) return 0.36;
  if (sources.includes("openalex_topic")) return 0.08;
  return 0;
}

function queryFirstNuclearScore(item, topicProfile) {
  if (!item?.meshValidated) return -999;
  const sources = item.sources || [item.source];
  const isDirectQuery = sources.includes("query_phrase");
  const isSeedTitle = sources.includes("seed_title_phrase");
  const isKeyword = sources.includes("openalex_keyword");
  const isTopicOnly = sources.includes("openalex_topic") && !isDirectQuery && !isSeedTitle && !isKeyword;
  if (isTopicOnly) return -999;

  // Um candidato vindo do corpus só pode virar o conceito nuclear se continuar ancorado
  // à consulta original. Isso é o bloqueio que impede Dermatite Atópica -> Molluscum.
  if (!isDirectQuery) {
    const strongRepeatedSeed = isSeedTitle
      && (Number(item.supportCount) || 0) >= 2
      && semanticPhraseTokens(item.term).length >= 2;
    // Em PT→EN alguns conceitos não são cognatos (ex.: insuficiência→failure). Nesses casos,
    // uma expressão clínica MeSH-válida repetida em VÁRIOS dos primeiros trabalhos pode
    // servir de âncora. Um achado isolado nunca recebe esse privilégio — foi justamente isso
    // que permitiu Molluscum em 13A.2.10.
    if (!strongRepeatedSeed) {
      const minCoverage = isSeedTitle ? 0.30 : 0.42;
      const minAlignment = isSeedTitle ? 0.34 : 0.46;
      if ((item.queryCoverage || 0) < minCoverage || (item.coreAlignment || 0) < minAlignment) return -999;
      if ((item.candidatePrecision || 0) < 0.28) return -999;
    }
  }
  const clinicalCategory = meshClinicalCategoryScore(item.meshTreeNumbers || []);
  const depth = meshTreeDepth(item.meshTreeNumbers || []);
  const sourceWeight = sourceEvidenceWeight(item);
  const support = Math.min(0.5, Math.max(0, (Number(item.supportCount) || 1) - 1) * 0.1);
  const direct = Math.min(1, Number(item.coreAlignment) || 0);
  const queryCoverage = Math.min(1, Number(item.queryCoverage) || 0);
  const candidatePrecision = Math.min(1, Number(item.candidatePrecision) || 0);
  const overlap = Math.min(3, Number(item.directOverlap) || 0) * 0.22;
  const exactEntryBonus = ["descriptor_exact", "entry_term", "entry_term_contains"].includes(item.meshMatchType) ? 0.18 : 0;
  // Uma entry term específica só recebe bônus forte quando sua granularidade combina com
  // a GRANULARIDADE DA CONSULTA ORIGINAL. Isso impede que uma busca ampla como
  // "insuficiência cardíaca" seja estreitada para HFrEF apenas porque os primeiros artigos
  // encontrados falam de fração de ejeção reduzida. Em contrapartida, quando o usuário
  // realmente escreveu o subtipo, o número de conceitos da query e da entry term tende a
  // ficar próximo e o bônus é preservado.
  const queryTokenCount = Math.max(1, (topicProfile?.coreTokens || []).length);
  const candidateTokenCount = Math.max(1, semanticPhraseTokens(item.term).length);
  const granularityFit = Math.max(0, 1 - (Math.abs(queryTokenCount - candidateTokenCount) / Math.max(queryTokenCount, candidateTokenCount)));
  const specificEntryBonus = item.source === "seed_title_phrase"
    ? (item.meshMatchType === "entry_term" ? 0.55 * granularityFit
      : item.meshMatchType === "entry_term_contains" ? 0.18 * granularityFit
        : 0)
    : 0;
  const disciplinePenalty = clinicalCategory < 0 ? -1.25 : 0;
  return (clinicalCategory * 1.15) + (depth * 0.05) + sourceWeight + support
    + (direct * 1.0) + (queryCoverage * 1.15) + (candidatePrecision * 0.35)
    + overlap + exactEntryBonus + specificEntryBonus + disciplinePenalty;
}

function selectQueryFirstNuclear(terms, topicProfile) {
  const validated = (terms || []).filter((item) => item?.meshValidated && queryFirstNuclearScore(item, topicProfile) > -900);
  if (!validated.length) return null;
  const clinical = validated.filter((item) => meshClinicalCategoryScore(item.meshTreeNumbers || []) >= 0.75);
  const pool = clinical.length ? clinical : validated.filter((item) => meshClinicalCategoryScore(item.meshTreeNumbers || []) >= 0);
  const candidates = pool.length ? pool : validated;
  return candidates
    .map((item) => ({ ...item, queryFirstNuclearScore: queryFirstNuclearScore(item, topicProfile) }))
    .sort((a, b) =>
      (b.queryFirstNuclearScore || -999) - (a.queryFirstNuclearScore || -999)
      || (b.rank || 0) - (a.rank || 0)
    )[0] || null;
}

function isTrustedSpecificEntry(item) {
  if (!item?.meshValidated || !item?.term || !item?.meshLabel) return false;
  const sources = item.sources || [item.source];
  if (!sources.includes("seed_title_phrase") && !sources.includes("query_phrase")) return false;
  if (!["entry_term", "entry_term_contains", "descriptor_exact"].includes(item.meshMatchType)) return false;
  const termTokens = semanticPhraseTokens(item.term);
  const labelTokens = semanticPhraseTokens(item.meshLabel);
  return termTokens.length >= 2 && (
    normalizeMedicalText(item.term) !== normalizeMedicalText(item.meshLabel)
    || termTokens.length >= labelTokens.length
  );
}

function nuclearSearchPhrase(nuclear) {
  if (!nuclear) return "";
  if (isTrustedSpecificEntry(nuclear)) return clean(nuclear.term, 180);
  return clean(nuclear.meshLabel || nuclear.term, 180);
}

function nuclearAliasScore(item, topicProfile) {
  const sources = item?.sources || [item?.source];
  if (!item?.term) return -999;
  if (sources.includes("openalex_topic") && !sources.includes("seed_title_phrase") && !sources.includes("openalex_keyword") && !sources.includes("query_phrase")) return -999;
  const sourceBonus = sources.includes("query_phrase") ? 1.0
    : sources.includes("seed_title_phrase") ? 0.75
      : sources.includes("openalex_keyword") ? 0.5 : 0;
  const phraseLength = semanticPhraseTokens(item.term).length;
  return ((item.queryCoverage || 0) * 1.4)
    + ((item.coreAlignment || 0) * 1.1)
    + ((item.candidatePrecision || 0) * 0.4)
    + sourceBonus
    + Math.min(0.35, Math.max(0, (Number(item.supportCount) || 1) - 1) * 0.08)
    + Math.min(0.18, Math.max(0, phraseLength - 1) * 0.03);
}

function selectNuclearAliases(meshEnriched, nuclear, topicProfile) {
  if (!nuclear) return [];
  const descriptorId = nuclear.meshDescriptorId || "";
  const candidates = (meshEnriched || []).filter((item) => {
    if (!item?.term) return false;
    if (descriptorId && item.meshDescriptorId !== descriptorId) return false;
    const sources = item.sources || [item.source];
    if (sources.includes("openalex_topic") && !sources.includes("seed_title_phrase") && !sources.includes("openalex_keyword") && !sources.includes("query_phrase")) return false;
    const repeatedSeed = sources.includes("seed_title_phrase") && (Number(item.supportCount) || 0) >= 2;
    if (!sources.includes("query_phrase") && !repeatedSeed && (item.queryCoverage || 0) < 0.28) return false;
    return true;
  }).map((item) => ({ ...item, aliasScore: nuclearAliasScore(item, topicProfile) }))
    .sort((a, b) => (b.aliasScore || -999) - (a.aliasScore || -999));

  const seen = new Set();
  const aliases = [];
  for (const item of candidates) {
    const key = normalizeMedicalText(item.term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(item);
    if (aliases.length >= 4) break;
  }
  return aliases;
}

// 13A.2.12: fallback multilíngue independente do MeSH em tempo de execução.
// O OpenAlex frequentemente devolve Keywords clínicas em inglês mesmo quando os trabalhos
// encontrados pela consulta original estão em português. Uma keyword RECORRENTE entre
// trabalhos diferentes é um sinal muito mais seguro que um Topic amplo ou um n-grama isolado.
// Ela nunca substitui um descritor MeSH válido; só entra quando a canonicalização MeSH falha.
function consensusKeywordAnchor(openAlexTerms, topicProfile) {
  const ranked = (openAlexTerms || [])
    .map((item) => preliminarySemanticRank(item, topicProfile))
    .filter((item) => {
      const sources = item.sources || [item.source];
      if (!sources.includes("openalex_keyword")) return false;
      const tokens = semanticPhraseTokens(item.term);
      if (tokens.length < 2 || tokens.length > 7) return false;
      if ((Number(item.supportCount) || 0) < 2) return false;
      const normalized = normalizeMedicalText(item.term);
      if (!normalized || /\b(?:management|treatment|therapy|diagnosis|review|guideline|consensus|study|outcomes?)\b/.test(normalized)) return false;
      return true;
    })
    .map((item) => {
      const support = Math.min(6, Number(item.supportCount) || 0);
      const overlapBonus = ((item.queryCoverage || 0) * 1.2) + ((item.coreAlignment || 0) * 0.8);
      const score = (support * 0.55) + (Number(item.confidence) || 0.5) + overlapBonus
        + Math.min(0.22, Math.max(0, semanticPhraseTokens(item.term).length - 1) * 0.05);
      return { ...item, consensusAnchorScore: score, consensusAnchor: true };
    })
    .sort((a, b) =>
      (b.consensusAnchorScore || 0) - (a.consensusAnchorScore || 0)
      || (b.supportCount || 0) - (a.supportCount || 0)
      || (b.confidence || 0) - (a.confidence || 0));
  return ranked[0] || null;
}

function consensusTitleAnchor(titlePhrases, topicProfile) {
  const ranked = (titlePhrases || [])
    .map((item) => preliminarySemanticRank(item, topicProfile))
    .filter((item) => {
      const tokens = semanticPhraseTokens(item.term);
      if (tokens.length < 2 || tokens.length > 8) return false;
      // Título só vira fallback quando a frase reaparece em pelo menos três trabalhos.
      // Isso impede um distrator isolado (caso Molluscum) de comandar a busca.
      if ((Number(item.supportCount) || 0) < 3) return false;
      return true;
    })
    .map((item) => ({
      ...item,
      consensusAnchor: true,
      consensusAnchorScore: (Number(item.supportCount) || 0) * 0.42
        + (Number(item.confidence) || 0.5)
        + ((item.queryCoverage || 0) * 0.8),
    }))
    .sort((a, b) => (b.consensusAnchorScore || 0) - (a.consensusAnchorScore || 0));
  return ranked[0] || null;
}

function consensusNonMeshNuclear(openAlexTerms, titlePhrases, topicProfile) {
  return consensusKeywordAnchor(openAlexTerms, topicProfile)
    || consensusTitleAnchor(titlePhrases, topicProfile)
    || null;
}

function removeAlreadyRepresentedModifiers(anchor, modifiers) {
  const normalizedAnchor = ` ${normalizeMedicalText(anchor)} `;
  return uniqueWords((modifiers || []).filter((term) => {
    const normalized = normalizeMedicalText(term);
    return normalized && !normalizedAnchor.includes(` ${normalized} `);
  }));
}

function bestAlignedNonMeshFallback(meshEnriched) {
  const candidates = (meshEnriched || []).filter((item) => {
    const sources = item.sources || [item.source];
    if (!sources.includes("seed_title_phrase") && !sources.includes("openalex_keyword")) return false;
    if (sources.includes("openalex_topic") && !sources.includes("seed_title_phrase") && !sources.includes("openalex_keyword")) return false;
    const repeatedSeed = sources.includes("seed_title_phrase") && (Number(item.supportCount) || 0) >= 2;
    return repeatedSeed || ((item.queryCoverage || 0) >= 0.34 && (item.coreAlignment || 0) >= 0.36 && (item.candidatePrecision || 0) >= 0.30);
  }).sort((a, b) =>
    (b.queryCoverage || 0) - (a.queryCoverage || 0)
    || (b.coreAlignment || 0) - (a.coreAlignment || 0)
    || (b.rank || 0) - (a.rank || 0));
  return candidates[0] || null;
}

function uniqueQueryVariants(values, max = 4, length = 420) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const cleaned = clean(value, length);
    const key = normalizeMedicalText(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= max) break;
  }
  return result;
}

function selectInternationalSemanticTerms(terms, topicProfile) {
  const seen = new Set();
  return terms
    .filter((item) => {
      const key = normalizeMedicalCognate(item.term);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.rank || 0) - (a.rank || 0))
    .slice(0, 6);
}

function populationEnglishPhrase(profile) {
  const mapping = {
    adult: "adults",
    child: "children",
    adolescent: "adolescents",
    elderly: "older adults",
    pregnant: "pregnancy",
  };
  return Array.from(profile.populations).map((key) => mapping[key]).filter(Boolean).join(" ");
}

function populationPubMedClause(profile) {
  const mapping = {
    adult: '"Adult"[MeSH Terms]',
    child: '"Child"[MeSH Terms]',
    adolescent: '"Adolescent"[MeSH Terms]',
    elderly: '"Aged"[MeSH Terms]',
    pregnant: '"Pregnancy"[MeSH Terms]',
  };
  return Array.from(profile.populations).map((key) => mapping[key]).filter(Boolean).join(" AND ");
}

function semanticPopulationBridgeWeight(topicProfile) {
  const weights = { adult: 0.35, child: 0.8, adolescent: 0.8, elderly: 0.78, pregnant: 1 };
  return Math.max(0, ...Array.from(topicProfile?.populations || []).map((key) => weights[key] || 0));
}

function semanticBridgeHasStrongCorpusSupport(item) {
  const sources = item?.sources || [item?.source];
  const sourceSupported = sources.some((source) => source === "openalex_keyword" || source === "portuguese_seed");
  return sourceSupported && (Number(item?.supportCount) || 0) >= 2;
}

function semanticBridgeScore(text, semanticContext, topicProfile) {
  if (!semanticContext) return { accepted: false, score: 0, term: "" };
  let best = { accepted: false, score: 0, term: "" };
  const targetPopulations = topicProfile?.populations || new Set();
  const textPopulations = detectPopulations(text);

  for (const item of semanticContext.bridgeTerms || []) {
    if (!item?.bridgeEligible) continue;
    const details = cognateTokenCoverageDetails(text, item.term);
    if (!details.tokenCount || details.coverage <= 0) continue;

    const itemPopulations = detectPopulations(item.term);
    const populationMatch = !targetPopulations.size || Array.from(targetPopulations).some((population) =>
      textPopulations.has(population) || itemPopulations.has(population));
    if (!populationMatch) continue;

    // BUG 13A.2.8 corrigido: 1 token lexical não pode valer como "prova perfeita".
    // Um conceito MeSH de uma palavra pode ser legítimo (asma, sepse, trombofilia), então
    // não o banimos globalmente. Ele só pode autorizar relação indireta se:
    //   A) estiver próximo do conceito nuclear na árvore MeSH; OU
    //   B) tiver suporte recorrente em keywords/sementes específicas da consulta E a
    //      pergunta trouxer um contexto populacional forte que também apareça no documento.
    // Isso permite, por exemplo, uma ponte clínica obstétrica bem sustentada sem reabrir
    // colisões genéricas como "anticorpos"/"células" ou comorbidades soltas em temas gerais.
    if (details.tokenCount === 1) {
      const treeSupported = (item.meshTreeProximity || 0) >= 2;
      const controlledVocabularyRelation = item.meshSeeAlsoRelated === true;
      const contextualSupport = semanticPopulationBridgeWeight(topicProfile) >= 0.75
        && populationMatch
        && semanticBridgeHasStrongCorpusSupport(item);
      if (!item.meshValidated || details.coverage < 1
        || (!treeSupported && !controlledVocabularyRelation && !contextualSupport)) continue;
    } else if (details.coverage < 0.66) {
      continue;
    }

    let score = 0.48 + (details.coverage * 0.22);
    if (item.meshValidated) score += 0.12;
    if (item.meshSeeAlsoRelated) score += 0.08;
    score += Math.min(0.12, (item.meshTreeProximity || 0) * 0.04);
    score += Math.min(0.08, Math.max(0, (Number(item.supportCount) || 1) - 1) * 0.02);
    if ((item.source || "").includes("portuguese")) score += 0.06;
    score = Math.min(1, score);
    const accepted = score >= 0.72;
    if (score > best.score) best = { accepted, score, term: item.term, meshDescriptorId: item.meshDescriptorId || "" };
  }
  return best;
}

async function buildSemanticContext(topic) {
  const profile = buildTopicProfile(topic);
  const broadTopic = broadenPortugueseTopic(topic) || topic;
  const seedQueries = Array.from(new Set([topic, broadTopic].map((value) => clean(value, 220)).filter(Boolean)));
  const works = [];
  let languageFallbackUsed = false;
  let portugueseSeedCount = 0;
  let unrestrictedSeedCount = 0;

  const activeSeedQueries = seedQueries.slice(0, 2);
  for (let queryIndex = 0; queryIndex < activeSeedQueries.length; queryIndex += 1) {
    const query = activeSeedQueries[queryIndex];
    try {
      // A consulta original recebe âncoras sem filtro de idioma; a versão ampliada serve
      // apenas para reforçar evidência em português. Assim o OpenAlex não volta a dirigir
      // a canonicalização por meio de Topics do broadening.
      const seed = await openAlexSemanticSeedWorks(query, 12, queryIndex === 0);
      works.push(...seed.works);
      portugueseSeedCount += seed.portugueseCount;
      unrestrictedSeedCount += seed.unrestrictedCount;
    } catch (error) {
      console.warn("Semente semântica OpenAlex indisponível", error?.message || error);
    }
  }
  languageFallbackUsed = portugueseSeedCount < 4 && unrestrictedSeedCount > 0;

  const bestById = new Map();
  for (const work of works) {
    const key = clean(String(work?.id || work?.display_name || ""), 220);
    if (!key || bestById.has(key)) continue;
    bestById.set(key, work);
  }
  const uniqueWorks = Array.from(bestById.values()).slice(0, 20);

  // QUERY-FIRST: a consulta original é o centro. OpenAlex fornece evidência bilíngue
  // (títulos/keywords/topics), mas nenhum Topic pode virar núcleo só por ser bem ranqueado.
  const titlePhrases = seedTitleSemanticPhrases(uniqueWorks);
  const openAlexTerms = aggregateSemanticTerms(uniqueWorks.flatMap(openAlexWorkSemanticTerms));
  const directQueryCandidate = {
    term: profile.comparablePhrase || broadTopic || topic,
    source: "query_phrase",
    sources: ["query_phrase"],
    confidence: 0.98,
    supportCount: 1,
    workRelevance: 0,
  };
  const rawSemanticTerms = aggregateSemanticTerms([directQueryCandidate, ...titlePhrases, ...openAlexTerms]);
  const meshEnriched = await enrichSemanticTermsWithMesh(rawSemanticTerms, profile);
  const internationalTerms = selectInternationalSemanticTerms(meshEnriched, profile);
  const portugueseTerms = semanticPortugueseCandidates(uniqueWorks, profile);

  const consensusFallback = consensusNonMeshNuclear(openAlexTerms, titlePhrases, profile);
  const nuclear = selectQueryFirstNuclear(meshEnriched, profile)
    || consensusFallback
    || bestAlignedNonMeshFallback(meshEnriched)
    || null;

  const nuclearTrees = nuclear?.meshTreeNumbers || [];
  const nuclearDetails = nuclear?.meshDescriptorId ? await meshDescriptorDetails(nuclear.meshDescriptorId) : { seealso: [] };
  const nuclearSeeAlsoIds = new Set((nuclearDetails?.seealso || []).map((item) => item.id).filter(Boolean));
  const nuclearAliases = nuclear?.meshValidated ? selectNuclearAliases(meshEnriched, nuclear, profile) : [];
  // Para busca, preferimos a expressão clínica que melhor representa a consulta original.
  // Se o MeSH está disponível, aliases ficam restritos ao MESMO descritor. Se o MeSH caiu,
  // a âncora de consenso precisa permanecer exatamente a keyword recorrente escolhida — a
  // query em português não pode voltar a tomar seu lugar por acidente.
  const trustedNuclearPhrase = nuclear?.consensusAnchor
    ? clean(nuclear.term, 180)
    : (clean(nuclearAliases[0]?.term, 180)
      || nuclearSearchPhrase(nuclear)
      || clean(nuclear?.term, 180));
  const populationPhrase = populationEnglishPhrase(profile);
  const populationClause = populationPubMedClause(profile);
  // Modificadores contrastivos vêm EXCLUSIVAMENTE da consulta original e são traduzidos
  // por pares clínicos gerais. Assim "reduzida" preserva "reduced", mas um trabalho
  // recuperado nunca consegue inventar "preserved" ou outro subtipo no lugar do usuário.
  const contrastModifiers = removeAlreadyRepresentedModifiers(
    trustedNuclearPhrase,
    queryEnglishContrastTerms(profile.original),
  );
  const contrastTextClauses = contrastModifiers.map((term) => `"${clean(term, 80).replace(/"/g, "")}"[Title/Abstract]`);
  const contrastPhrase = contrastModifiers.join(" ");

  // NÃO existe mais "pegue qualquer keyword OpenAlex como segundo conceito".
  // O texto específico só é obrigatório quando é uma entry term/título validado que resolve
  // PARA O MESMO descritor MeSH nuclear. População vem exclusivamente da query original.
  const trustedAlias = nuclearAliases.find((item) =>
    normalizeMedicalText(item.term) === normalizeMedicalText(trustedNuclearPhrase));
  const specificText = nuclear?.meshValidated
    && trustedNuclearPhrase
    && normalizeMedicalText(trustedNuclearPhrase) !== normalizeMedicalText(nuclear?.meshLabel || "")
    && ((trustedAlias?.queryCoverage || 0) >= 0.38)
      ? trustedNuclearPhrase
      : "";

  const meshClause = nuclear?.meshValidated && nuclear?.meshLabel
    ? `"${clean(nuclear.meshLabel, 150).replace(/"/g, "")}"[MeSH Terms]`
    : "";
  const specificTextClause = specificText
    ? `"${clean(specificText, 170).replace(/"/g, "")}"[Title/Abstract]`
    : "";

  const anchorTextClause = !meshClause && trustedNuclearPhrase
    ? `"${clean(trustedNuclearPhrase, 170).replace(/"/g, "")}"[Title/Abstract]`
    : "";
  const nuclearClause = meshClause || anchorTextClause;
  const strictPubMed = [nuclearClause, specificTextClause, ...contrastTextClauses, populationClause].filter(Boolean).join(" AND ");
  const essentialPubMed = [nuclearClause, ...contrastTextClauses, populationClause].filter(Boolean).join(" AND ");
  const populationRelaxedPubMed = [nuclearClause, populationClause].filter(Boolean).join(" AND ");
  const nuclearPubMed = nuclearClause || (trustedNuclearPhrase ? clean(trustedNuclearPhrase, 180) : "");
  // Último degrau é sem field tag para permitir Automatic Term Mapping do próprio PubMed.
  const atmPubMed = [trustedNuclearPhrase || nuclear?.meshLabel, contrastPhrase, populationPhrase].filter(Boolean).join(" ");
  const aliasPubMedVariants = nuclearAliases.slice(1, 3).map((item) => {
    const phrase = clean(item.term, 170).replace(/"/g, "");
    return [phrase ? `"${phrase}"[Title/Abstract]` : "", ...contrastTextClauses, populationClause].filter(Boolean).join(" AND ");
  });
  const pubmedQueryVariants = uniqueQueryVariants(
    [strictPubMed, ...aliasPubMedVariants, essentialPubMed, populationRelaxedPubMed, nuclearPubMed, atmPubMed],
    6,
    420,
  );
  const pubmedQuery = pubmedQueryVariants[0] || "";

  const aliasPhrases = nuclearAliases.map((item) => clean(item.term, 180)).filter(Boolean);
  const strictInternational = [trustedNuclearPhrase || nuclear?.meshLabel, contrastPhrase, populationPhrase].filter(Boolean).join(" ");
  const aliasInternational = aliasPhrases.slice(1, 3).map((phrase) => [phrase, contrastPhrase, populationPhrase].filter(Boolean).join(" "));
  const essentialInternational = [trustedNuclearPhrase || nuclear?.meshLabel, contrastPhrase].filter(Boolean).join(" ");
  const populationInternational = [trustedNuclearPhrase || nuclear?.meshLabel, populationPhrase].filter(Boolean).join(" ");
  const nuclearInternational = trustedNuclearPhrase || nuclear?.meshLabel || "";
  const openAlexQueryVariants = uniqueQueryVariants(
    [strictInternational, ...aliasInternational, essentialInternational, populationInternational, nuclearInternational],
    5,
    220,
  );
  const internationalQuery = openAlexQueryVariants[0] || clean(broadTopic || topic, 220);

  // Ponte semântica continua conservadora. Títulos completos não viram ponte: para relações
  // indiretas usamos conceitos/keywords controlados, comparados ao núcleo query-first.
  const bridgeTerms = [];
  for (const item of meshEnriched.filter((candidate) => candidate.source !== "seed_title_phrase" && candidate.source !== "query_phrase").slice(0, 14)) {
    const proximity = meshTreeCommonPrefixDepth(nuclearTrees, item.meshTreeNumbers || []);
    const sameDescriptor = Boolean(nuclear?.meshDescriptorId && item.meshDescriptorId === nuclear.meshDescriptorId);
    const meshSeeAlsoRelated = Boolean(item.meshDescriptorId && nuclearSeeAlsoIds.has(item.meshDescriptorId));
    const tokenCount = semanticPhraseTokens(item.term).length;
    const contextSupportedSingle = tokenCount === 1
      && semanticPopulationBridgeWeight(profile) >= 0.75
      && semanticBridgeHasStrongCorpusSupport(item);
    const bridgeEligible = Boolean(
      (item.meshValidated
        && (sameDescriptor || proximity >= 2 || meshSeeAlsoRelated || contextSupportedSingle)
        && (item.coreAlignment >= 0.2 || item.supportCount >= 2))
      || (!item.meshValidated && tokenCount >= 2 && item.coreAlignment >= 0.58)
    );
    bridgeTerms.push({
      ...item,
      meshTreeProximity: sameDescriptor ? 9 : proximity,
      meshSeeAlsoRelated,
      bridgeEligibilityReason: sameDescriptor ? "same_mesh_descriptor"
        : proximity >= 2 ? "mesh_tree_proximity"
          : meshSeeAlsoRelated ? "mesh_see_also"
            : contextSupportedSingle ? "controlled_single_term_with_context"
              : tokenCount >= 2 ? "multi_token_alignment" : "none",
      bridgeEligible,
    });
  }

  // Termos PT do corpus só herdam poder de ponte se houver um conceito MeSH elegível
  // realmente equivalente/cognato. Isso preserva recall para relações como trombofilia
  // obstétrica sem reabrir ANCA/células/renal como colisões lexicais genéricas.
  for (const pt of portugueseTerms) {
    let best = null;
    for (const meshItem of bridgeTerms.filter((item) => item.meshValidated && item.bridgeEligible)) {
      const coverage = Math.max(
        cognateTokenCoverage(meshItem.meshLabel || meshItem.term, pt.term),
        cognateTokenCoverage(pt.term, meshItem.meshLabel || meshItem.term),
      );
      if (!best || coverage > best.coverage) best = { coverage, meshItem };
    }
    if (!best || best.coverage < 0.95) continue;
    const linked = best.meshItem;
    bridgeTerms.push({
      ...pt,
      meshValidated: true,
      meshDescriptorId: linked.meshDescriptorId,
      meshLabel: linked.meshLabel,
      meshTreeNumbers: linked.meshTreeNumbers,
      meshTreeProximity: linked.meshTreeProximity,
      meshSeeAlsoRelated: linked.meshSeeAlsoRelated === true,
      bridgeEligibilityReason: linked.bridgeEligibilityReason || "linked_mesh_descriptor",
      canonicalEnglish: linked.meshLabel,
      bridgeEligible: true,
    });
  }

  const meshDescriptors = uniqueWords(meshEnriched.filter((item) => item.meshValidated).map((item) => item.meshLabel).filter(Boolean));
  return {
    source: nuclear?.meshValidated
      ? "query_first_mesh_with_openalex_evidence"
      : (nuclear?.consensusAnchor ? "query_first_openalex_keyword_consensus" : (uniqueWorks.length ? "query_first_openalex_fallback" : "none")),
    seedCount: uniqueWorks.length,
    seedQueries,
    languageFallbackUsed,
    portugueseSeedCount,
    unrestrictedSeedCount,
    internationalQuery,
    openAlexQueryVariants,
    pubmedQuery,
    pubmedQueryVariants,
    internationalTerms,
    bridgeTerms: bridgeTerms.sort((a, b) => Number(b.bridgeEligible) - Number(a.bridgeEligible) || (b.rank || b.confidence || 0) - (a.rank || a.confidence || 0)).slice(0, 20),
    meshUsed: Boolean(nuclear?.meshValidated),
    meshDescriptors: meshDescriptors.slice(0, 10),
    nuclearMeshDescriptor: nuclear?.meshLabel || "",
    nuclearMeshDescriptorId: nuclear?.meshDescriptorId || "",
    nuclearSource: nuclear?.source || "",
    nuclearSearchPhrase: trustedNuclearPhrase || "",
    nuclearAliases: nuclearAliases.map((item) => item.term).slice(0, 4),
    trustedModifierTerms: [specificText, ...contrastModifiers, populationPhrase].filter(Boolean),
    consensusAnchorUsed: Boolean(nuclear?.consensusAnchor),
    queryFirstUsed: true,
  };
}


async function searchOfficialBrazilianSources({ topic, sourceGroups, maxResults, semanticContext }) {
  if (!sourceGroups.includes("guidelines")) return { sources: [], queries: [], attempted: false, authorities: [] };

  const topicProfile = buildTopicProfile(topic);
  const broadTopic = broadenPortugueseTopic(topic) || topic;
  const queries = [
    broadTopic,
    `${broadTopic} PCDT`,
    `${broadTopic} PDF`,
  ].map((value) => clean(value, 220));

  // Trilha universal: vale para QUALQUER área médica.
  const searchTasks = [
    searchPcDtCatalog(topicProfile, semanticContext),
    officialSearchPage(`${GOVBR_SEARCH_URL}?${new URLSearchParams({ SearchableText: queries[0], origem: "form" }).toString()}`, topicProfile, "gov_search"),
    officialSearchPage(`${GOVBR_SEARCH_URL}?${new URLSearchParams({ SearchableText: queries[1], origem: "form" }).toString()}`, topicProfile, "gov_search"),
    officialSearchPage(`${GOVBR_SEARCH_URL}?${new URLSearchParams({ SearchableText: queries[2], origem: "form" }).toString()}`, topicProfile, "gov_search"),
  ];

  // Expansão oficial sem doença codificada: termos clínicos recorrentes nas sementes
  // científicas portuguesas podem descobrir PCDTs com nomenclatura diferente da pergunta.
  const populationPt = Array.from(topicProfile.populations).map((population) => ({
    adult: "adultos", child: "crianças", adolescent: "adolescentes", elderly: "idosos", pregnant: "gestantes",
  }[population])).filter(Boolean).join(" ");
  const relatedTerms = (semanticContext?.bridgeTerms || [])
    .filter((item) => item.source === "portuguese_seed" && item.bridgeEligible && (item.confidence || 0) >= 0.58)
    .slice(0, 2);
  for (const item of relatedTerms) {
    const relatedQuery = clean(`${item.term} ${populationPt} PCDT`, 220);
    if (!relatedQuery) continue;
    queries.push(relatedQuery);
    searchTasks.push(officialSearchPage(`${GOVBR_SEARCH_URL}?${new URLSearchParams({ SearchableText: relatedQuery, origem: "form" }).toString()}`, topicProfile, "gov_semantic_search"));
  }

  // Trilha por especialidade: o tema, e não o deck, determina uma ou mais sociedades.
  const inferredAuthorities = inferRelevantMedicalAuthorities(topic, 3, semanticContext);
  const authorities = await refreshAuthoritiesFromAmbDirectory(inferredAuthorities);
  for (const authority of authorities) {
    searchTasks.push(searchMedicalSocietyAuthority(authority, broadTopic, topicProfile, semanticContext));
    const societyVariants = medicalSocietyQueryVariants(topic, semanticContext);
    queries.push(`${societyVariants.join(" / ") || broadTopic} · ${authority.specialty}`);
  }

  const settled = await Promise.allSettled(searchTasks);
  const candidates = settled.flatMap((item) => item.status === "fulfilled" ? item.value : []);
  const bestCandidates = [];
  const seen = new Set();
  const hydrationLimit = Math.min(34, Math.max(16, Math.ceil(maxResults * 0.85)));
  for (const candidate of candidates.sort((a, b) => (b.candidateRank || b.relevanceScore || 0) - (a.candidateRank || a.relevanceScore || 0))) {
    const key = normalizeUrl(candidate.url);
    if (!key || seen.has(key) || officialUrlDisposition(key) === "reject") continue;
    seen.add(key);
    bestCandidates.push(candidate);
    if (bestCandidates.length >= hydrationLimit) break;
  }

  const hydratedSettled = await Promise.allSettled(bestCandidates.map((candidate) => hydrateOfficialCandidate(candidate, topicProfile)));
  const sources = hydratedSettled.flatMap((item) => item.status === "fulfilled" ? item.value : []);
  return {
    sources,
    queries,
    attempted: true,
    authorities: authorities.map((authority) => ({ key: authority.key, specialty: authority.specialty, institution: authority.name, domain: authority.domain })),
    authorityRegistry: "AMB specialty societies + semantic routing + document-library fallback + PDF metadata validation + local fallback",
    authorityDirectoryUrl: AMB_SOCIETY_DIRECTORY_URL,
    semanticBridgeUsed: relatedTerms.length > 0,
  };
}


async function normalizeTopicForPubMed(topic, semanticContext) {
  // 13A.2.10: se o MeSH canonicalizou a consulta, a escada query-first é a primeira escolha.
  // Assim o modo de contingência não usa Topic do OpenAlex como se fosse tradução clínica.
  const meshQuery = clean(semanticContext?.pubmedQuery, 420);
  if (semanticContext?.meshUsed && meshQuery) return meshQuery;

  const semanticFallback = clean(semanticContext?.internationalQuery, 220) || topic;
  // Uma âncora recorrente de Keywords OpenAlex já é um fallback multilíngue independente
  // do Gemini. Quando presente, ela é mais segura que voltar à consulta literal em PT.
  if (semanticContext?.consensusAnchorUsed && semanticFallback) return semanticFallback;
  const { apiKey } = getGeminiApiKey();
  if (!apiKey) return semanticFallback;
  const prompt = `Traduza o tema médico abaixo para uma consulta curta em inglês adequada ao PubMed. Preserve o conceito principal, população, subtipo e contexto. Retorne SOMENTE a consulta, sem explicação.\n\n${topic}`;
  for (const model of NORMALIZATION_MODELS) {
    try {
      const response = await callGemini({ apiKey, model, prompt, thinkingLevel: "minimal", timeoutMs: 8_000 });
      if (!response.ok) continue;
      const data = await response.json();
      const value = clean(extractGeminiText(data), 220).replace(/^['"]|['"]$/g, "");
      if (value && normalizeMedicalText(value) !== normalizeMedicalText(topic)) return value;
    } catch {
      // Continua para o próximo modelo; o fallback nunca deve quebrar a pesquisa.
    }
  }
  return semanticFallback;
}

function buildPubMedTypeClause(groups) {
  const clauses = [];
  if (groups.includes("guidelines")) clauses.push('"Practice Guideline"[Publication Type]', '"Guideline"[Publication Type]');
  if (groups.includes("reviews")) clauses.push('"Systematic Review"[Publication Type]', '"Meta-Analysis"[Publication Type]', '"Review"[Publication Type]');
  if (groups.includes("primary")) clauses.push('"Randomized Controlled Trial"[Publication Type]', '"Clinical Trial"[Publication Type]', '"Observational Study"[Publication Type]');
  return clauses.length ? `(${clauses.join(" OR ")})` : "";
}

function buildPubMedDateClause(recency) {
  const years = recency === "5y" ? 5 : recency === "10y" ? 10 : 0;
  if (!years) return "";
  const year = new Date().getUTCFullYear() - years;
  return `("${year}/01/01"[Date - Publication] : "3000"[Date - Publication])`;
}

async function pubmedSearch(query, maxResults) {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmode: "json",
    retmax: String(maxResults),
    sort: "relevance",
    tool: "FicharioMed",
  });
  const response = await fetch(`${EUTILS_BASE}/esearch.fcgi?${params.toString()}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`pubmed_search_${response.status}`);
  const data = await response.json();
  return Array.isArray(data?.esearchresult?.idlist) ? data.esearchresult.idlist : [];
}

async function pubmedSummary(ids) {
  if (!ids.length) return [];
  const params = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json", version: "2.0", tool: "FicharioMed" });
  const response = await fetch(`${EUTILS_BASE}/esummary.fcgi?${params.toString()}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`pubmed_summary_${response.status}`);
  const data = await response.json();
  const result = data?.result || {};
  const uids = Array.isArray(result.uids) ? result.uids : ids;
  return uids.map((id) => result[id]).filter(Boolean);
}

function articleId(summary, type) {
  const ids = Array.isArray(summary?.articleids) ? summary.articleids : [];
  const found = ids.find((item) => String(item?.idtype || "").toLowerCase() === type);
  return clean(found?.value, 220);
}

function classifyPubMed(pubTypes) {
  const normalized = pubTypes.map((item) => String(item).toLowerCase());
  if (normalized.some((item) => item.includes("practice guideline") || item === "guideline")) return "guideline";
  if (normalized.some((item) => item.includes("consensus"))) return "consensus";
  if (normalized.some((item) => item.includes("systematic review"))) return "systematic_review";
  if (normalized.some((item) => item.includes("meta-analysis"))) return "meta_analysis";
  if (normalized.some((item) => item.includes("review"))) return "review";
  if (normalized.some((item) => item.includes("randomized controlled trial") || item.includes("clinical trial"))) return "clinical_trial";
  if (normalized.some((item) => item.includes("observational"))) return "observational";
  return "other";
}

function parseYear(summary) {
  const raw = clean(summary?.sortpubdate || summary?.pubdate, 40);
  const match = raw.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

function pubmedSummaryToSource(summary, index) {
  const pmid = clean(summary?.uid || articleId(summary, "pubmed"), 40);
  const title = clean(summary?.title, 900);
  if (!pmid || !title) return null;
  const publicationTypes = Array.isArray(summary?.pubtype) ? summary.pubtype.map((item) => clean(item, 120)).filter(Boolean) : [];
  const evidenceLevel = classifyPubMed(publicationTypes);
  const year = parseYear(summary);
  const authors = Array.isArray(summary?.authors) ? summary.authors.map((author) => clean(author?.name, 160)).filter(Boolean).slice(0, 8) : [];
  const doi = articleId(summary, "doi") || undefined;
  const source = {
    id: `pubmed-${pmid}-${index}`,
    pmid,
    doi,
    title,
    url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`,
    institution: clean(summary?.fulljournalname || summary?.source, 260) || "PubMed",
    journal: clean(summary?.fulljournalname || summary?.source, 260) || "PubMed",
    authors,
    publicationTypes,
    domain: "pubmed.ncbi.nlm.nih.gov",
    provider: "PubMed",
    language: "Inglês/internacional",
    year,
    publishedAt: clean(summary?.pubdate, 80) || undefined,
    evidenceLevel,
    credibility: "peer_reviewed",
    summary: "Fonte indexada no PubMed. Abra a publicação para conferir o resumo e o texto disponível.",
    whyRelevant: "Fonte internacional indexada no PubMed, considerada junto às fontes brasileiras para comparar qualidade, nível de evidência e abrangência clínica.",
    verificationStatus: "verified",
    searchOrigin: "pubmed",
    priority: "international",
    score: 55,
  };
  return source;
}

function reconstructOpenAlexAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (Number.isInteger(position) && position >= 0 && position < 5000) words[position] = word;
    }
  }
  return clean(words.filter(Boolean).join(" "), 900);
}

function classifyOpenAlex(work) {
  const title = clean(work?.display_name || work?.title, 1000).toLowerCase();
  const type = String(work?.type || "").toLowerCase();
  if (/\bpcdt\b|protocolo clínico|clinical practice guideline|practice guideline|\bguideline\b|\bdiretriz/.test(title)) return "guideline";
  if (/\bconsenso\b|\bconsensus\b/.test(title)) return "consensus";
  if (/documento oficial|official document/.test(title)) return "official_document";
  if (/revis[aã]o sistem[aá]tica|systematic review/.test(title)) return "systematic_review";
  if (/meta[- ]?an[aá]lise|meta[- ]?analysis/.test(title)) return "meta_analysis";
  if (/ensaio cl[ií]nico random|randomi[sz]ed controlled trial|clinical trial/.test(title)) return "clinical_trial";
  if (/estudo observacional|observational study|cohort|coorte|case-control|caso.controle/.test(title)) return "observational";
  if (type === "review" || /\breview\b|\brevis[aã]o\b/.test(title)) return "review";
  return "other";
}

function evidenceMatchesGroups(level, groups) {
  if (["guideline", "consensus", "official_document"].includes(level)) return groups.includes("guidelines");
  if (["systematic_review", "meta_analysis", "review"].includes(level)) return groups.includes("reviews");
  if (["clinical_trial", "observational"].includes(level)) return groups.includes("primary");
  return false;
}

function broadenPortugueseTopic(topic) {
  return clean(String(topic || "")
    .replace(/\b(em|para|nos?|nas?|durante a|durante)\s+(adultos?|adultas?|crian[cç]as?|adolescentes?|idosos?|idosas?|gestantes?|gr[aá]vidas?|gesta[cç][aã]o|gravidez|gestacionais?)\b/gi, " ")
    .replace(/\b(adultos?|adultas?|crian[cç]as?|adolescentes?|idosos?|idosas?|gestantes?|gr[aá]vidas?|gesta[cç][aã]o|gravidez|gestacionais?)\b$/gi, " ")
    .replace(/\s+/g, " "), 220);
}

function openAlexDateFilter(recency) {
  const years = recency === "5y" ? 5 : recency === "10y" ? 10 : 0;
  if (!years) return "";
  const year = new Date().getUTCFullYear() - years;
  return `from_publication_date:${year}-01-01`;
}

function openAlexProvider(work, url) {
  const host = hostnameOf(url);
  const sourceName = clean(work?.primary_location?.source?.display_name, 220);
  if (host.includes("scielo") || /scielo/i.test(sourceName)) return "SciELO / OpenAlex";
  if (host.includes("bvsalud") || /lilacs|bvs/i.test(sourceName)) return "BVS / OpenAlex";
  return "OpenAlex";
}

function openAlexCountry(work, url) {
  const host = hostnameOf(url);
  const sourceName = normalizeMedicalText(work?.primary_location?.source?.display_name || "");
  // País da FONTE, não do autor. Antes, um artigo internacional de autores brasileiros
  // podia receber "Brasil" e ser exibido como português.
  if (host.endsWith(".br") || /\bbrasil\b|\bbrasileir[ao]\b|brazilian/.test(sourceName)) return "Brasil";
  return undefined;
}

function openAlexWorkToSource(work, index, sourceGroups, topicProfile) {
  const title = clean(work?.display_name || work?.title, 900);
  if (!title) return null;
  const doi = clean(String(work?.doi || "").replace(/^https?:\/\/doi\.org\//i, ""), 220) || undefined;
  const primaryUrl = normalizeUrl(work?.best_oa_location?.landing_page_url)
    || normalizeUrl(work?.primary_location?.landing_page_url)
    || normalizeUrl(work?.open_access?.oa_url)
    || (doi ? `https://doi.org/${doi}` : normalizeUrl(work?.id));
  if (!primaryUrl || isBlockedUrl(primaryUrl)) return null;

  const evidenceLevel = classifyOpenAlex(work);
  if (!evidenceMatchesGroups(evidenceLevel, sourceGroups)) return null;

  const languageCode = String(work?.language || "").toLowerCase();
  const country = openAlexCountry(work, primaryUrl);
  const institution = clean(work?.primary_location?.source?.display_name, 260) || "OpenAlex";
  const authors = Array.isArray(work?.authorships)
    ? work.authorships.map((item) => clean(item?.author?.display_name, 160)).filter(Boolean).slice(0, 8)
    : [];
  const abstract = reconstructOpenAlexAbstract(work?.abstract_inverted_index);
  const language = detectLanguageFromText(`${title} ${abstract}`, languageCode);
  const provider = openAlexProvider(work, primaryUrl);
  const year = safeNumber(work?.publication_year);
  const portuguese = language === "Português" || country === "Brasil" || hostnameOf(primaryUrl).endsWith(".br");
  const source = {
    id: `openalex-${clean(String(work?.id || index), 80).split("/").pop()}-${index}`,
    title,
    url: primaryUrl,
    institution,
    journal: institution,
    authors,
    publicationTypes: [clean(work?.type, 100)].filter(Boolean),
    domain: hostnameOf(primaryUrl),
    provider,
    language,
    country,
    year,
    publishedAt: clean(work?.publication_date, 40) || undefined,
    evidenceLevel,
    credibility: "peer_reviewed",
    summary: abstract || "Registro científico indexado no OpenAlex. Abra a fonte para conferir resumo, texto completo e metadados disponíveis.",
    whyRelevant: portuguese
      ? "Fonte científica em português/brasileira recuperada diretamente de uma base bibliográfica aberta, sem depender da Pesquisa Google."
      : "Fonte científica internacional comparada às fontes brasileiras para equilibrar autoridade, evidência, abrangência e atualidade.",
    verificationStatus: "verified",
    searchOrigin: "openalex",
    priority: portuguese ? "complementary" : "international",
    score: 0,
    doi,
    isPdf: isPdfUrl(primaryUrl),
    documentFormat: isPdfUrl(primaryUrl) ? "PDF" : "HTML",
    semanticTerms: openAlexWorkSemanticTerms(work).map((item) => item.term).slice(0, 8),
  };
  const relevantSource = attachTopicRelevance(source, topicProfile);
  if (!relevantSource) return null;
  relevantSource.whyRelevant = `${source.whyRelevant} Relevância temática: ${relevantSource.relevanceLevel === "high" ? "alta" : "moderada"}.`;
  const rankedSource = applySelectionMetrics(relevantSource, topicProfile);
  // O relevance_score do OpenAlex serve apenas como desempate leve; não pode superar
  // autoridade, evidência ou abrangência clínica.
  rankedSource.score = Math.min(100, rankedSource.score + Math.min(3, Math.max(0, Math.round(Number(work?.relevance_score) || 0))));
  return rankedSource;
}

async function openAlexRequest({ query, sourceGroups, recency, maxResults, portugueseOnly, topicProfile }) {
  const filters = [openAlexDateFilter(recency)];
  if (portugueseOnly) filters.push("language:pt");
  const params = new URLSearchParams({
    search: query,
    per_page: String(Math.max(20, Math.min(50, maxResults * 5))),
    select: [
      "id", "doi", "display_name", "publication_year", "publication_date", "type", "language",
      "primary_location", "best_oa_location", "authorships", "open_access", "relevance_score", "abstract_inverted_index",
      "topics", "keywords",
    ].join(","),
  });
  const filter = filters.filter(Boolean).join(",");
  if (filter) params.set("filter", filter);
  const response = await fetch(`${OPENALEX_BASE}/works?${params.toString()}`, {
    headers: { accept: "application/json", "user-agent": "FicharioMed/1.0" },
  });
  if (!response.ok) throw new Error(`openalex_${response.status}`);
  const data = await response.json();
  const works = Array.isArray(data?.results) ? data.results : [];
  return works.map((work, index) => openAlexWorkToSource(work, index, sourceGroups, topicProfile)).filter(Boolean);
}

async function searchOpenAlexFallback({ topic, sourceGroups, recency, maxResults, allowInternational, normalizedInternationalQuery, semanticContext }) {
  const topicProfile = buildTopicProfile(topic);
  const queries = Array.from(new Set([topic, broadenPortugueseTopic(topic)].map((item) => clean(item, 220)).filter(Boolean)));
  const sources = [];

  for (const query of queries) {
    try {
      sources.push(...await openAlexRequest({
        query,
        sourceGroups,
        recency,
        maxResults,
        portugueseOnly: true,
        topicProfile,
      }));
    } catch (error) {
      console.warn("OpenAlex PT indisponível", error);
    }
  }

  if (allowInternational) {
    const variants = uniqueQueryVariants([
      ...(semanticContext?.openAlexQueryVariants || []),
      normalizedInternationalQuery,
    ], 4, 220);
    const target = Math.min(Math.max(6, Math.ceil(maxResults * 0.45)), maxResults);
    let acceptedInternational = 0;

    for (const query of variants) {
      const internationalProfile = buildTopicProfile(query);
      if (!internationalProfile.populations.size && topicProfile.populations.size) {
        internationalProfile.populations = new Set(topicProfile.populations);
      }
      try {
        const found = await openAlexRequest({
          query,
          sourceGroups,
          recency,
          maxResults,
          portugueseOnly: false,
          topicProfile: internationalProfile,
        });
        sources.push(...found);
        acceptedInternational += found.length;
      } catch (error) {
        console.warn("OpenAlex internacional indisponível", query, error);
      }
      // Só relaxa quando o degrau atual NÃO entregou diversidade suficiente.
      if (acceptedInternational >= target) break;
    }
  }
  return sources;
}


function officialDocumentIdentity(source) {
  if (!(source?.officialDocument || source?.searchOrigin === "official")) return "";
  const institutionFamily = inferredCredibility(source) === "government" ? "gov-health" : normalizeMedicalText(source?.institution || source?.domain || "official");
  const ignored = new Set([
    ...TOPIC_STOPWORDS,
    "pcdt", "protocolo", "clinico", "clinicos", "diretriz", "diretrizes", "terapeutica", "terapeuticas",
    "documento", "oficial", "pdf", "resumido", "resumida", "resumo", "portaria", "conjunta", "ministerio", "saude",
    "relatorio", "recomendacao", "preliminar", "consulta", "publica", "versao", "atualizacao", "atualizado",
  ]);
  const tokens = uniqueWords(normalizeMedicalText(source?.title || "").split(" ").filter((token) => token.length >= 3 && !/^[0-9]+$/.test(token) && !ignored.has(token)));
  if (!tokens.length) return "";
  return `${institutionFamily}:${tokens.sort().join("-").slice(0, 180)}`;
}

function officialVersionPreference(source) {
  if (!(source?.officialDocument || source?.searchOrigin === "official")) return 0;
  let score = 0;
  const status = source?.officialStatus || officialDocumentStatus(source?.title, source?.url);
  const kind = source?.officialKind || officialDocumentKind(source?.title, source?.url, source?.isPdf);
  if (status === "final") score += 30;
  else if (status === "summary") score += 18;
  else if (status === "recommendation_report") score += 8;
  else if (status === "preliminary") score -= 5;
  if (kind === "pcdt") score += 25;
  else if (kind === "guideline" || kind === "consensus") score += 18;
  else if (kind === "clinical_reference") score += 8;
  if (source?.isPdf) score += 6;
  if (Number.isFinite(Number(source?.year))) score += Math.max(0, Number(source.year) - 2015) * 0.5;
  return score;
}

function shouldReplaceDedupeSource(previous, candidate) {
  const previousVersion = officialVersionPreference(previous);
  const candidateVersion = officialVersionPreference(candidate);
  if (candidateVersion !== previousVersion) return candidateVersion > previousVersion;
  if ((candidate.score || 0) !== (previous.score || 0)) return (candidate.score || 0) > (previous.score || 0);
  if (Boolean(candidate.isPdf) !== Boolean(previous.isPdf)) return Boolean(candidate.isPdf);
  return (candidate.year || 0) > (previous.year || 0);
}

function canonicalDocumentTitleTokens(title) {
  const ignored = new Set([
    ...TOPIC_STOPWORDS, ...GENERIC_TOPIC_WORDS, ...BREADTH_IGNORED_WORDS,
    "article", "artigo", "editorial", "supplement", "suplemento", "update", "updated",
  ]);
  return uniqueWords(normalizeMedicalText(title).split(" ").filter((token) =>
    token.length >= 3 && !/^(19|20)\d{2}$/.test(token) && !ignored.has(token)));
}

function titleSimilarity(a, b) {
  const left = new Set(canonicalDocumentTitleTokens(a));
  const right = new Set(canonicalDocumentTitleTokens(b));
  if (!left.size || !right.size) return { jaccard: 0, containment: 0 };
  const intersection = Array.from(left).filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return {
    jaccard: intersection / union,
    containment: intersection / Math.min(left.size, right.size),
  };
}

function sameConceptualDocument(a, b) {
  const doiA = String(a?.doi || "").toLowerCase().trim();
  const doiB = String(b?.doi || "").toLowerCase().trim();
  if (doiA && doiB && doiA === doiB) return true;
  const pmidA = String(a?.pmid || "").trim();
  const pmidB = String(b?.pmid || "").trim();
  if (pmidA && pmidB && pmidA === pmidB) return true;

  const officialA = officialDocumentIdentity(a);
  const officialB = officialDocumentIdentity(b);
  if (officialA && officialB && officialA === officialB) return true;

  const titleA = normalizeMedicalText(a?.title || "");
  const titleB = normalizeMedicalText(b?.title || "");
  const yearA = Number(a?.year);
  const yearB = Number(b?.year);
  const yearDiff = Number.isFinite(yearA) && Number.isFinite(yearB) ? Math.abs(yearA - yearB) : 0;
  if (titleA && titleA === titleB && yearDiff <= 2) return true;

  const similarity = titleSimilarity(a?.title, b?.title);
  if (yearDiff <= 1 && similarity.jaccard >= 0.92) return true;
  if (yearDiff === 0 && similarity.jaccard >= 0.86 && similarity.containment >= 0.95) return true;
  return false;
}

function dedupeAndRankSources(sources, maxResults, topic) {
  const profile = buildTopicProfile(topic);
  const deduped = [];

  // Deduplicação em camadas. DOI/PMID continuam sendo sinais fortes, mas não impedem a
  // comparação por título: duas indexações da mesma diretriz com DOIs diferentes não
  // ocupam duas vagas da base documental.
  for (const rawSource of sources) {
    if (!rawSource?.title) continue;
    const source = rawSource.authorityScore == null || rawSource.breadthScore == null
      ? applySelectionMetrics(rawSource, profile)
      : rawSource;
    const duplicateIndex = deduped.findIndex((previous) => sameConceptualDocument(previous, source));
    if (duplicateIndex < 0) {
      deduped.push(source);
    } else if (shouldReplaceDedupeSource(deduped[duplicateIndex], source)) {
      deduped[duplicateIndex] = source;
    }
  }

  const ranked = deduped.sort((a, b) =>
    (b.score || 0) - (a.score || 0)
    || (b.authorityScore || 0) - (a.authorityScore || 0)
    || (b.breadthScore || 0) - (a.breadthScore || 0)
    || (b.relevanceScore || 0) - (a.relevanceScore || 0)
    || (b.year || 0) - (a.year || 0));

  // Diversidade clínica/editorial: evita concentração por periódico e por subtemas.
  const selected = [];
  const selectedIds = new Set();
  const institutionCounts = new Map();
  const institutionCap = Math.max(2, Math.ceil(maxResults * 0.25));
  const narrowCap = Math.max(2, Math.ceil(maxResults * 0.34));
  const publicEducationCap = 1;
  let narrowCount = 0;
  let publicEducationCount = 0;

  for (const source of ranked) {
    if (selected.length >= maxResults) break;
    const institutionKey = normalizeMedicalText(source.institution || source.journal || source.domain || "desconhecido");
    const sameInstitution = institutionCounts.get(institutionKey) || 0;
    const isNarrow = source.breadthLevel === "narrow";
    const isPublicEducation = source.officialContentClass === "public_education";
    if (institutionKey && sameInstitution >= institutionCap) continue;
    if (isNarrow && narrowCount >= narrowCap) continue;
    if (isPublicEducation && publicEducationCount >= publicEducationCap) continue;

    selected.push(source);
    selectedIds.add(source.id);
    if (institutionKey) institutionCounts.set(institutionKey, sameInstitution + 1);
    if (isNarrow) narrowCount += 1;
    if (isPublicEducation) publicEducationCount += 1;
  }

  // Se o conjunto for muito pequeno, completa com o melhor restante, mas nunca duplica.
  if (selected.length < maxResults) {
    for (const source of ranked) {
      if (selected.length >= maxResults) break;
      if (selectedIds.has(source.id)) continue;
      selected.push(source);
      selectedIds.add(source.id);
    }
  }

  return selected.sort((a, b) =>
    (b.score || 0) - (a.score || 0)
    || (b.authorityScore || 0) - (a.authorityScore || 0)
    || (b.breadthScore || 0) - (a.breadthScore || 0)
    || (b.relevanceScore || 0) - (a.relevanceScore || 0)
    || (b.year || 0) - (a.year || 0));
}

async function searchPubMedFallback({ topic, sourceGroups, recency, maxResults, normalizedQuery, semanticContext }) {
  const normalized = normalizedQuery || await normalizeTopicForPubMed(topic, semanticContext);
  const typeClause = buildPubMedTypeClause(sourceGroups);
  const dateClause = buildPubMedDateClause(recency);
  const variants = uniqueQueryVariants([
    ...(semanticContext?.pubmedQueryVariants || []),
    normalized,
  ], 5, 420);

  const idSet = new Set();
  const target = Math.min(Math.max(6, Math.ceil(maxResults * 0.5)), maxResults);
  for (const variant of variants) {
    const attempts = uniqueQueryVariants([
      [variant, typeClause, dateClause].filter(Boolean).join(" AND "),
      [variant, dateClause].filter(Boolean).join(" AND "),
      variant,
    ], 3, 900);
    for (const query of attempts) {
      const ids = await pubmedSearch(query, Math.max(maxResults, target));
      ids.forEach((id) => idSet.add(id));
      if (idSet.size >= target) break;
    }
    // Escada progressiva: se já temos massa crítica, não degradamos para um núcleo amplo.
    if (idSet.size >= target) break;
  }

  const ids = Array.from(idSet).slice(0, maxResults);
  const summaries = await pubmedSummary(ids);
  const relevanceTopic = clean(semanticContext?.internationalQuery, 220) || topic;
  const topicProfile = buildTopicProfile(relevanceTopic);
  if (!topicProfile.populations.size) topicProfile.populations = new Set(buildTopicProfile(topic).populations);
  return summaries
    .map(pubmedSummaryToSource)
    .filter(Boolean)
    .map((source) => attachTopicRelevance(source, topicProfile, 58))
    .filter(Boolean)
    .map((source) => applySelectionMetrics(source, topicProfile))
    .slice(0, maxResults);
}

async function searchIndexedFallback({ topic, sourceGroups, recency, maxResults, allowInternational, semanticContext }) {
  let openAlexQuery;
  let pubmedQuery;
  if (allowInternational) {
    try {
      pubmedQuery = await normalizeTopicForPubMed(topic, semanticContext);
      openAlexQuery = clean(semanticContext?.openAlexQueryVariants?.[0], 220)
        || clean(semanticContext?.internationalQuery, 220)
        || (semanticContext?.meshUsed ? clean(semanticContext?.nuclearSearchPhrase, 220) : "")
        || topic;
    } catch {
      openAlexQuery = clean(semanticContext?.internationalQuery, 220) || topic;
      pubmedQuery = openAlexQuery;
    }
  }

  const openAlexPromise = searchOpenAlexFallback({
    topic,
    sourceGroups,
    recency,
    maxResults,
    allowInternational,
    normalizedInternationalQuery: openAlexQuery,
    semanticContext,
  });
  const pubmedPromise = allowInternational
    ? (async () => {
        try {
          return await searchPubMedFallback({ topic, sourceGroups, recency, maxResults, normalizedQuery: pubmedQuery, semanticContext });
        } catch (error) {
          console.warn("PubMed indisponível", error);
          return [];
        }
      })()
    : Promise.resolve([]);

  const [openAlexSources, pubmedSources] = await Promise.all([openAlexPromise, pubmedPromise]);
  return [...openAlexSources, ...pubmedSources]
    .filter((source) => !sourceContradictsOriginalTopic(source, topic));
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken || !(await verifyFirebaseUser(idToken))) {
    return json({ error: "unauthorized", message: "Sua sessão expirou. Entre novamente." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "A pesquisa recebeu dados inválidos." }, 400);
  }

  const topic = clean(body?.topic, MAX_TOPIC_LENGTH);
  const sourceGroups = Array.isArray(body?.sourceGroups)
    ? Array.from(new Set(body.sourceGroups.filter((item) => ["guidelines", "reviews", "primary"].includes(item))))
    : [];
  const recency = ["5y", "10y", "all"].includes(body?.recency) ? body.recency : "5y";
  const maxResults = Math.max(5, Math.min(20, Number(body?.maxResults) || 12));
  const allowInternational = body?.allowInternational !== false;

  if (topic.length < 3) return json({ error: "topic_too_short", message: "Digite um tema médico mais específico." }, 400);
  if (!sourceGroups.length) return json({ error: "no_source_group", message: "Selecione pelo menos um tipo de fonte." }, 400);

  const searchedAt = new Date().toISOString();
  try {
    // Coleta um conjunto de candidatos maior que a lista visual. A seleção final só ocorre
    // depois de comparar web/Fontes oficiais + OpenAlex + PubMed.
    const candidateLimit = Math.min(50, Math.max(24, maxResults * 3));
    const webCandidateLimit = Math.min(20, Math.max(maxResults + 6, 12));

    let semanticContext = { source: "none", seedCount: 0, seedQueries: [], internationalQuery: "", openAlexQueryVariants: [], pubmedQuery: "", pubmedQueryVariants: [], internationalTerms: [], bridgeTerms: [], meshUsed: false, meshDescriptors: [], languageFallbackUsed: false, queryFirstUsed: false, trustedModifierTerms: [] };
    if (allowInternational || sourceGroups.includes("guidelines")) {
      try {
        semanticContext = await buildSemanticContext(topic);
      } catch (error) {
        console.warn("Expansão semântica indisponível; mantendo busca literal", error?.message || error);
      }
    }

    const [officialSettled, webSettled, indexedSettled] = await Promise.allSettled([
      searchOfficialBrazilianSources({ topic, sourceGroups, maxResults: candidateLimit, semanticContext }),
      searchWebGrounded({ topic, sourceGroups, recency, maxResults: webCandidateLimit, allowInternational }),
      searchIndexedFallback({ topic, sourceGroups, recency, maxResults: candidateLimit, allowInternational, semanticContext }),
    ]);

    const officialResult = officialSettled.status === "fulfilled"
      ? officialSettled.value
      : { sources: [], queries: [], attempted: true, authorities: [] };
    const webResult = webSettled.status === "fulfilled"
      ? webSettled.value
      : { sources: [], queries: [], attempts: [], errorCode: "grounding_unavailable" };
    const indexedSources = indexedSettled.status === "fulfilled" ? indexedSettled.value : [];
    if (officialSettled.status === "rejected") console.warn("Fontes oficiais falharam", officialSettled.reason);
    if (webSettled.status === "rejected") console.warn("Pesquisa web falhou", webSettled.reason);
    if (indexedSettled.status === "rejected") console.warn("Bases indexadas falharam", indexedSettled.reason);

    const allCandidates = [...(officialResult.sources || []), ...(webResult.sources || []), ...indexedSources]
      .filter((source) => !sourceContradictsOriginalTopic(source, topic));
    const selectedSources = dedupeAndRankSources(allCandidates, maxResults, topic);
    const webAvailable = Array.isArray(webResult.sources) && webResult.sources.length > 0;

    return json({
      sources: selectedSources,
      meta: {
        originalTopic: topic,
        normalizedTopic: webResult.normalizedTopic || topic,
        queryUsed: webAvailable ? (webResult.queries.join(" · ") || topic) : topic,
        searchedAt,
        totalMatches: allCandidates.length,
        returnedCount: selectedSources.length,
        queryNormalization: webAvailable ? "grounded_web" : (semanticContext.meshUsed ? "mesh_clinical_fallback" : (semanticContext.internationalQuery ? "openalex_semantic_fallback" : "literal_fallback")),
        provider: "multi_source",
        searchMode: webAvailable ? "grounded_web" : "indexed_fallback",
        languagePreference: "pt-BR",
        searchModel: webResult.model,
        webSearchQueries: webResult.queries || [],
        fallbackUsed: !webAvailable,
        fallbackReason: webAvailable
          ? undefined
          : "A Pesquisa Google não ficou disponível nesta tentativa. O Fichário continuou pesquisando diretamente no catálogo oficial de PCDTs, em fontes governamentais brasileiras e em sociedades médicas pertinentes ao tema, validando páginas/PDFs antes de aceitá-los, além de OpenAlex e, quando permitido, PubMed/internacional. A lista final foi escolhida por relevância, autoridade, nível de evidência, abrangência clínica e vigência documental.",
        officialSearchUsed: officialResult.attempted === true,
        officialCandidateCount: Array.isArray(officialResult.sources) ? officialResult.sources.length : 0,
        officialSearchQueries: officialResult.queries || [],
        officialAuthorities: officialResult.authorities || [],
        officialAuthorityRegistry: officialResult.authorityRegistry || "AMB specialty societies + semantic routing + document-library fallback + PDF metadata validation + local fallback",
        semanticExpansionSource: semanticContext.source,
        semanticSeedCount: semanticContext.seedCount || 0,
        semanticInternationalQuery: semanticContext.internationalQuery || undefined,
        semanticPubMedQuery: semanticContext.pubmedQuery || undefined,
        semanticPubMedQueries: semanticContext.pubmedQueryVariants || [],
        semanticOpenAlexQueries: semanticContext.openAlexQueryVariants || [],
        semanticQueryFirstUsed: semanticContext.queryFirstUsed === true,
        semanticTrustedModifiers: semanticContext.trustedModifierTerms || [],
        semanticNuclearSource: semanticContext.nuclearSource || undefined,
        semanticTerms: (semanticContext.internationalTerms || []).map((item) => item.term).slice(0, 6),
        semanticBridgeUsed: officialResult.semanticBridgeUsed === true || (semanticContext.bridgeTerms || []).some((item) => item.bridgeEligible),
        meshUsed: semanticContext.meshUsed === true,
        meshDescriptors: semanticContext.meshDescriptors || [],
        meshNuclearDescriptor: semanticContext.nuclearMeshDescriptor || undefined,
        semanticLanguageFallbackUsed: semanticContext.languageFallbackUsed === true,
        semanticPortugueseSeedCount: semanticContext.portugueseSeedCount || 0,
        semanticUnrestrictedSeedCount: semanticContext.unrestrictedSeedCount || 0,
        candidateCount: allCandidates.length,
        rankingVersion: "clinical-quality-v14-brazilian-document-discovery",
      },
    });
  } catch (error) {
    console.error("Pesquisa por tema falhou", error);
    return json({
      error: "research_provider_error",
      message: "Não foi possível consultar as fontes médicas agora. Tente novamente em alguns instantes.",
    }, 502);
  }
};
