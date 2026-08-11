(() => {
  // src/engine/state.js
  function createSessionState() {
    return {
      answers: {},
      // nodeId -> answer value (number for scored questions, string/array otherwise)
      asked: [],
      // ordered list of node ids actually shown to the user, for progress/back-nav
      dedupe: {}
      // dedupeKey -> value already collected under a different node id
    };
  }
  function recordAnswer(state, node, value) {
    state.answers[node.id] = value;
    if (!state.asked.includes(node.id)) state.asked.push(node.id);
    if (node.dedupeKey) state.dedupe[node.dedupeKey] = value;
  }
  function hasDedupeValue(state, dedupeKey) {
    return Boolean(dedupeKey) && Object.prototype.hasOwnProperty.call(state.dedupe, dedupeKey);
  }
  function getDedupeValue(state, dedupeKey) {
    return state.dedupe[dedupeKey];
  }
  function adoptDedupedAnswer(state, node) {
    if (!node.dedupeKey || !hasDedupeValue(state, node.dedupeKey)) return false;
    state.answers[node.id] = getDedupeValue(state, node.dedupeKey);
    if (!state.asked.includes(node.id)) state.asked.push(node.id);
    return true;
  }

  // src/engine/graph.js
  function buildFlow(order, nodes) {
    const index = new Map(nodes.map((n) => [n.id, n]));
    return { order, index };
  }
  function getNode(flow, id) {
    return flow.index.get(id);
  }
  function defaultNextId(flow, id) {
    const pos = flow.order.indexOf(id);
    if (pos === -1 || pos === flow.order.length - 1) return null;
    return flow.order[pos + 1];
  }
  function isAnswered(state, nodeId) {
    const v = state.answers[nodeId];
    return v !== void 0 && v !== "" && !(Array.isArray(v) && v.length === 0);
  }
  function resolveNext(flow, currentId, state) {
    let id = currentId === null ? flow.order[0] : nextIdFrom(flow, currentId, state);
    while (id !== null) {
      const node = getNode(flow, id);
      if (!node) return null;
      if (node.visibleIf && !node.visibleIf(state.answers)) {
        id = nextIdFrom(flow, id, state);
        continue;
      }
      if (!isAnswered(state, node.id) && adoptDedupedAnswer(state, node)) {
        id = nextIdFrom(flow, id, state);
        continue;
      }
      return id;
    }
    return null;
  }
  function nextIdFrom(flow, id, state) {
    const node = getNode(flow, id);
    if (node && typeof node.next === "function") {
      const explicit = node.next(state.answers);
      if (explicit !== void 0) return explicit;
    }
    return defaultNextId(flow, id);
  }
  function visibleNodes(flow, state) {
    const result = [];
    let id = resolveNext(flow, null, state);
    const seen = /* @__PURE__ */ new Set();
    while (id !== null && !seen.has(id)) {
      seen.add(id);
      const node = getNode(flow, id);
      result.push(node);
      if (typeof node.next === "function" && node.required !== false && !isAnswered(state, node.id)) break;
      id = resolveNext(flow, id, state);
    }
    return result;
  }

  // src/data/industries.js
  var INDUSTRIES = [
    { id: "finance", label: "Financial Services", topPriority: "iso27001", alsoRelevant: ["pcidss", "sox"], otDefault: "ask" },
    { id: "health", label: "Healthcare", topPriority: "hipaa", alsoRelevant: ["iso27001"], otDefault: "likely" },
    { id: "pharma", label: "Pharmaceuticals", topPriority: "iso27001", alsoRelevant: ["gdpr"], otDefault: "likely" },
    { id: "energy", label: "Energy / Critical Infrastructure", topPriority: "nis2", alsoRelevant: ["iso27001"], otDefault: "likely" },
    { id: "manufacturing", label: "Manufacturing / Industrial", topPriority: "iso27001", alsoRelevant: ["nis2"], otDefault: "likely" },
    { id: "retail", label: "Retail / E-commerce", topPriority: "pcidss", alsoRelevant: ["gdpr"], otDefault: "ask" },
    { id: "saas", label: "SaaS / Technology", topPriority: "soc2", alsoRelevant: ["iso27001"], otDefault: "skip" },
    { id: "itservices", label: "IT Services / Software Consulting", topPriority: "soc2", alsoRelevant: ["iso27001"], otDefault: "skip" },
    { id: "marketing", label: "Digital Marketing / Marketing Agency", topPriority: "gdpr", alsoRelevant: ["soc2"], otDefault: "skip" },
    { id: "public", label: "Public Sector / Government", topPriority: "nis2", alsoRelevant: ["iso27001"], otDefault: "ask" },
    { id: "other", label: "Other / Not listed", topPriority: null, alsoRelevant: [], otDefault: "ask" }
  ];

  // src/data/regions.js
  var REGIONS = [
    {
      id: "eu",
      label: "European Union",
      frameworks: ["nis2", "gdpr"],
      note: "NIS2 and GDPR are policy frameworks that companies registered or operating in EU regions are expected to adhere to."
    },
    {
      id: "uk",
      label: "United Kingdom",
      frameworks: ["cyberessentials"],
      note: "Cyber Essentials is a UK government-backed baseline certification - especially relevant if you bid on UK government or public-sector contracts."
    },
    {
      id: "na",
      label: "North America",
      frameworks: ["sox", "hipaa", "pcidss"],
      note: "SOX applies to US public companies (and their vendors/auditors); HIPAA applies specifically if you handle US health data; PCI DSS applies specifically if you handle payment card data - check which condition actually applies to your business."
    },
    {
      id: "southamerica",
      label: "South America",
      frameworks: [],
      note: "No single framework applies uniformly across South America - country-specific regimes exist instead, most notably Brazil's LGPD (closely modeled on GDPR). ISO 27001 remains the most broadly recognized starting point across the region."
    },
    {
      id: "middleeast",
      label: "Middle East",
      frameworks: [],
      note: "No single framework applies uniformly across the Middle East - country-specific regimes exist instead (e.g., the UAE's PDPL, Saudi Arabia's PDPL). ISO 27001 remains the most broadly recognized starting point across the region."
    },
    {
      id: "africa",
      label: "Africa",
      frameworks: [],
      note: "No single framework applies uniformly across Africa - country-specific regimes exist instead, most notably South Africa's POPIA. ISO 27001 remains the most broadly recognized starting point across the region."
    },
    {
      id: "apac",
      label: "Asia-Pacific",
      frameworks: [],
      note: "No single framework applies uniformly across Asia-Pacific - country-specific regimes exist instead (e.g., Singapore's PDPA, Japan's APPI, Australia's Privacy Act). ISO 27001 remains the most broadly recognized starting point across the region."
    },
    {
      id: "global",
      label: "Global",
      standalone: true,
      frameworks: [],
      note: "Without a specific regional mandate, internationally recognized certifications such as ISO 27001 or SOC 2 are the most broadly applicable starting point."
    }
  ];

  // src/data/countries.js
  var COUNTRIES = [
    "Afghanistan",
    "Albania",
    "Algeria",
    "Andorra",
    "Angola",
    "Antigua and Barbuda",
    "Argentina",
    "Armenia",
    "Australia",
    "Austria",
    "Azerbaijan",
    "Bahamas",
    "Bahrain",
    "Bangladesh",
    "Barbados",
    "Belarus",
    "Belgium",
    "Belize",
    "Benin",
    "Bhutan",
    "Bolivia",
    "Bosnia and Herzegovina",
    "Botswana",
    "Brazil",
    "Brunei",
    "Bulgaria",
    "Burkina Faso",
    "Burundi",
    "Cabo Verde",
    "Cambodia",
    "Cameroon",
    "Canada",
    "Central African Republic",
    "Chad",
    "Chile",
    "China",
    "Colombia",
    "Comoros",
    "Congo (Republic of the)",
    "Costa Rica",
    "Croatia",
    "Cuba",
    "Cyprus",
    "Czechia",
    "Democratic Republic of the Congo",
    "Denmark",
    "Djibouti",
    "Dominica",
    "Dominican Republic",
    "Ecuador",
    "Egypt",
    "El Salvador",
    "Equatorial Guinea",
    "Eritrea",
    "Estonia",
    "Eswatini",
    "Ethiopia",
    "Fiji",
    "Finland",
    "France",
    "Gabon",
    "Gambia",
    "Georgia",
    "Germany",
    "Ghana",
    "Greece",
    "Grenada",
    "Guatemala",
    "Guinea",
    "Guinea-Bissau",
    "Guyana",
    "Haiti",
    "Honduras",
    "Hungary",
    "Iceland",
    "India",
    "Indonesia",
    "Iran",
    "Iraq",
    "Ireland",
    "Israel",
    "Italy",
    "Ivory Coast",
    "Jamaica",
    "Japan",
    "Jordan",
    "Kazakhstan",
    "Kenya",
    "Kiribati",
    "Kosovo",
    "Kuwait",
    "Kyrgyzstan",
    "Laos",
    "Latvia",
    "Lebanon",
    "Lesotho",
    "Liberia",
    "Libya",
    "Liechtenstein",
    "Lithuania",
    "Luxembourg",
    "Madagascar",
    "Malawi",
    "Malaysia",
    "Maldives",
    "Mali",
    "Malta",
    "Marshall Islands",
    "Mauritania",
    "Mauritius",
    "Mexico",
    "Micronesia",
    "Moldova",
    "Monaco",
    "Mongolia",
    "Montenegro",
    "Morocco",
    "Mozambique",
    "Myanmar",
    "Namibia",
    "Nauru",
    "Nepal",
    "Netherlands",
    "New Zealand",
    "Nicaragua",
    "Niger",
    "Nigeria",
    "North Korea",
    "North Macedonia",
    "Norway",
    "Oman",
    "Pakistan",
    "Palau",
    "Palestine",
    "Panama",
    "Papua New Guinea",
    "Paraguay",
    "Peru",
    "Philippines",
    "Poland",
    "Portugal",
    "Qatar",
    "Romania",
    "Russia",
    "Rwanda",
    "Saint Kitts and Nevis",
    "Saint Lucia",
    "Saint Vincent and the Grenadines",
    "Samoa",
    "San Marino",
    "Sao Tome and Principe",
    "Saudi Arabia",
    "Senegal",
    "Serbia",
    "Seychelles",
    "Sierra Leone",
    "Singapore",
    "Slovakia",
    "Slovenia",
    "Solomon Islands",
    "Somalia",
    "South Africa",
    "South Korea",
    "South Sudan",
    "Spain",
    "Sri Lanka",
    "Sudan",
    "Suriname",
    "Sweden",
    "Switzerland",
    "Syria",
    "Taiwan",
    "Tajikistan",
    "Tanzania",
    "Thailand",
    "Timor-Leste",
    "Togo",
    "Tonga",
    "Trinidad and Tobago",
    "Tunisia",
    "Turkey",
    "Turkmenistan",
    "Tuvalu",
    "Uganda",
    "Ukraine",
    "United Arab Emirates",
    "United Kingdom",
    "United States",
    "Uruguay",
    "Uzbekistan",
    "Vanuatu",
    "Vatican City",
    "Venezuela",
    "Vietnam",
    "Yemen",
    "Zambia",
    "Zimbabwe"
  ];

  // src/data/frameworks.js
  var FRAMEWORKS = [
    { id: "iso27001", name: "ISO 27001", desc: "International standard for an Information Security Management System - common where clients or partners require certification." },
    { id: "nis2", name: "NIS2", desc: "EU directive for essential/important-sector entities - incident notification duties and management accountability." },
    { id: "soc2", name: "SOC 2", desc: "Common for SaaS/vendors selling to enterprise customers who require an independent audit of controls." },
    { id: "hipaa", name: "HIPAA", desc: "U.S. law governing protection of health information - relevant if you handle patient or health data in the US." },
    { id: "gdpr", name: "GDPR", desc: "EU regulation governing personal data protection and privacy - relevant if you handle EU residents' data, regardless of where you're based." },
    { id: "sox", name: "SOX", desc: "U.S. Sarbanes-Oxley Act requiring financial reporting controls - relevant if you're a US public company, or a vendor/auditor to one." },
    { id: "cyberessentials", name: "Cyber Essentials", desc: "UK government-backed baseline certification - relevant for UK organizations, especially those bidding on UK government contracts." },
    { id: "pcidss", name: "PCI DSS", desc: "Payment Card Industry Data Security Standard - relevant if you store, process, or transmit credit or debit card data." }
  ];

  // src/data/vendors.js
  var ANTIVIRUS_VENDORS = [
    "Microsoft Defender Antivirus",
    "Norton",
    "McAfee",
    "Bitdefender",
    "Kaspersky",
    "ESET",
    "Trend Micro",
    "Sophos",
    "Avast Business",
    "Webroot"
  ];
  var EDR_VENDORS = [
    "CrowdStrike Falcon",
    "Microsoft Defender for Endpoint",
    "SentinelOne",
    "Sophos Intercept X",
    "Trend Micro Vision One",
    "Trellix Endpoint Security",
    "Cybereason",
    "ESET PROTECT",
    "Bitdefender GravityZone",
    "Palo Alto Networks Cortex XDR"
  ];
  var EMAIL_SECURITY_VENDORS = [
    "Proofpoint",
    "Mimecast",
    "Microsoft Defender for Office 365",
    "Barracuda Email Protection",
    "Abnormal Security",
    "Cisco Secure Email",
    "Trend Micro Email Security",
    "Google Workspace (built-in)"
  ];
  var DLP_VENDORS = [
    "Microsoft Purview",
    "Forcepoint DLP",
    "Symantec DLP (Broadcom)",
    "Digital Guardian",
    "Netskope",
    "Trellix DLP",
    "Proofpoint DLP"
  ];
  var SDWAN_VENDORS = [
    "Cisco Meraki",
    "Fortinet Secure SD-WAN",
    "VMware VeloCloud",
    "Palo Alto Networks Prisma SD-WAN",
    "Cato Networks",
    "Aryaka",
    "Aruba (HPE) EdgeConnect"
  ];
  var EDGE_DEVICE_VENDORS = [
    "Fortinet FortiGate",
    "Palo Alto Networks",
    "Cisco ASA / Firepower",
    "SonicWall",
    "Check Point",
    "Juniper Networks SRX",
    "WatchGuard",
    "Ubiquiti"
  ];
  var HOSTING_PROVIDERS = [
    "Amazon Web Services (AWS)",
    "Microsoft Azure",
    "Google Cloud Platform",
    "GoDaddy",
    "Bluehost",
    "DigitalOcean",
    "Rackspace Technology",
    "OVHcloud",
    "Hetzner",
    "Self-hosted / on-premises"
  ];
  var CLOUD_PROVIDERS = [
    "Amazon Web Services (AWS)",
    "Microsoft Azure",
    "Google Cloud Platform",
    "Oracle Cloud Infrastructure",
    "IBM Cloud",
    "Alibaba Cloud"
  ];
  var AWARENESS_LMS_VENDORS = [
    "KnowBe4",
    "Proofpoint Security Awareness Training",
    "SANS Security Awareness",
    "Infosec IQ",
    "Mimecast Awareness Training",
    "Hoxhunt",
    "Living Security"
  ];
  var MSP_VENDORS = [
    "Kyndryl",
    "Rackspace Technology",
    "Accenture",
    "IBM Managed Infrastructure Services",
    "NTT DATA",
    "A local/regional MSP"
  ];
  var MDR_VENDORS = [
    "CrowdStrike Falcon Complete",
    "Red Canary",
    "Arctic Wolf",
    "Sophos MDR",
    "eSentire",
    "Expel"
  ];
  var MSSP_VENDORS = [
    "Secureworks",
    "Trustwave",
    "IBM Security Services",
    "Verizon Managed Security Services",
    "NTT Security",
    "Wipro Cybersecurity & Risk Services"
  ];
  var OT_ICS_VENDORS = [
    "Siemens",
    "Rockwell Automation / Allen-Bradley",
    "Schneider Electric",
    "Honeywell",
    "ABB",
    "Emerson",
    "GE Vernova",
    "Yokogawa",
    "Mitsubishi Electric"
  ];
  var OTHER = "__other__";

  // src/data/profile-questions.js
  var ORG_PROFILE_ORDER = ["employeeCount"];
  var ORG_PROFILE_NODES = [
    {
      id: "employeeCount",
      kind: "profile",
      category: "team",
      type: "select",
      text: "How many employees/users are in the organization?",
      options: ["1\u201310", "11\u201350", "51\u2013200", "201\u20131,000", "1,000+"],
      required: true
    }
  ];
  var INFRA_ORDER = [
    "hasAntivirus",
    "antivirusVendor",
    "edrVendor",
    "emailSecurityVendor",
    "awarenessLms",
    "dlpUsed",
    "dlpVendor",
    "deployModel",
    "cloudProvider",
    "sdwanUsed",
    "sdwanVendor",
    "networkArch",
    "externalDevices",
    "edgeDeviceVendor",
    "externalWebsite",
    "webDb",
    "hostingProvider",
    "webServerStack"
  ];
  function text(id, category, label, placeholder, extra) {
    return { id, kind: "profile", category, type: "text", text: label, placeholder, required: false, ...extra };
  }
  function select(id, category, label, options, extra) {
    return { id, kind: "profile", category, type: "select", text: label, options, ...extra };
  }
  function vendor(id, category, label, vendorOptions, extra) {
    return { id, kind: "profile", category, type: "vendor", text: label, vendorOptions, required: false, ...extra };
  }
  var INFRA_NODES = [
    // §5.3: antivirus asked as its own step, before EDR.
    select("hasAntivirus", "infra", "Do you have an antivirus solution?", ["Yes", "No", "Not sure"], { required: true }),
    vendor("antivirusVendor", "infra", "Which antivirus product?", ANTIVIRUS_VENDORS, {
      visibleIf: (answers) => answers.hasAntivirus === "Yes"
    }),
    vendor("edrVendor", "infra", "What EDR (Endpoint Detection & Response) product is deployed, if any?", EDR_VENDORS),
    vendor("emailSecurityVendor", "infra", "What email security / anti-phishing gateway do you use, if any?", EMAIL_SECURITY_VENDORS),
    vendor("awarenessLms", "infra", "What security awareness / LMS platform do you use for training, if any?", AWARENESS_LMS_VENDORS),
    select("dlpUsed", "infra", "Do you use a DLP (data loss prevention) solution?", ["Yes", "No", "Not sure"], { required: true }),
    vendor("dlpVendor", "infra", "Which DLP product?", DLP_VENDORS, {
      visibleIf: (answers) => answers.dlpUsed === "Yes"
    }),
    select("deployModel", "infra", "Is your infrastructure on-premises, cloud-only, or hybrid?", ["On-premises only", "Cloud-only", "Hybrid (on-prem + cloud)"], { required: true }),
    vendor("cloudProvider", "infra", "Which cloud provider(s)?", CLOUD_PROVIDERS, {
      visibleIf: (answers) => answers.deployModel && answers.deployModel !== "On-premises only"
    }),
    select("sdwanUsed", "infra", "Do you use SD-WAN?", ["Yes", "No", "Not sure"], { required: true }),
    vendor("sdwanVendor", "infra", "Which SD-WAN vendor?", SDWAN_VENDORS, {
      visibleIf: (answers) => answers.sdwanUsed === "Yes"
    }),
    select("networkArch", "infra", "How would you describe your network architecture?", ["Flat / mostly unsegmented", "Segmented (VLANs / zones)", "Zero-trust / microsegmented"], { required: true }),
    select("externalDevices", "infra", "Do you have external-facing devices (VPN gateways, remote-access appliances, firewalls with public IPs)?", ["Yes", "No"], { required: true }),
    vendor("edgeDeviceVendor", "infra", "What firewall / VPN gateway appliance handles that external access?", EDGE_DEVICE_VENDORS, {
      visibleIf: (answers) => answers.externalDevices === "Yes"
    }),
    select(
      "externalWebsite",
      "infra",
      "Do you operate any externally-reachable, customer-facing services - websites or web apps that accept user input (forms, logins, uploads), payment gateways, APIs, or portals?",
      ["Yes", "No"],
      { required: true }
    ),
    select("webDb", "infra", "Does that service connect to a backend database?", ["Yes", "No", "Not sure"], {
      required: false,
      visibleIf: (answers) => answers.externalWebsite === "Yes"
    }),
    vendor("hostingProvider", "infra", "Who hosts your web server(s)?", HOSTING_PROVIDERS),
    text("webServerStack", "infra", "What web server software / OS runs it, if known?", "e.g. Nginx on Ubuntu 22.04, IIS on Windows Server")
  ];
  var DEVSEC_ORDER = ["developsSoftware", "devsecopsMaturity", "secretsManagement"];
  var DEVSEC_NODES = [
    select("developsSoftware", "infra", "Does your organization develop or maintain custom software/applications (in-house or via contractors)?", ["Yes", "No"], { required: true }),
    select(
      "devsecopsMaturity",
      "infra",
      "How would you describe your DevSecOps practice?",
      [
        "No formal practice - security reviewed late, if at all",
        "Security scanning exists but isn't enforced in the pipeline",
        "Security gates (SAST/dependency scanning) enforced in CI/CD"
      ],
      { visibleIf: (answers) => answers.developsSoftware === "Yes" }
    ),
    select(
      "secretsManagement",
      "infra",
      "How are secrets (API keys, credentials) managed in your applications/pipelines?",
      [
        "Hardcoded or stored in plain config files",
        "Environment variables, informally managed",
        "Dedicated secrets manager (e.g. Vault, cloud KMS)"
      ],
      { visibleIf: (answers) => answers.developsSoftware === "Yes" }
    )
  ];
  var OT_ORDER = ["hasOT", "otSegregation", "otRemoteAccess", "otPatching", "otMonitoring", "otVendor"];
  var OT_NODES = [
    select("hasOT", "infra", "Do you have a dedicated OT / Industrial Control Systems (ICS/SCADA) environment, separate from your office IT network?", ["Yes", "No", "Not sure"], {
      required: true,
      visibleIf: (answers) => !otSectionSkipped(answers)
    }),
    select("otSegregation", "infra", "Is the OT network segregated from the corporate IT network (e.g. dedicated firewalls, DMZ, air-gap)?", ["No - flat/shared network", "Partially segregated", "Yes, fully segregated"], {
      visibleIf: (answers) => answers.hasOT === "Yes"
    }),
    select("otRemoteAccess", "infra", "Is remote access to OT systems possible, and if so, how is it controlled?", ["No remote access exists", "Yes, but not via a dedicated secure gateway", "Yes, via a monitored jump host / secure gateway"], {
      visibleIf: (answers) => answers.hasOT === "Yes"
    }),
    select("otPatching", "infra", "How are OT/ICS devices patched, given many can't be updated like standard IT?", ["Rarely or never patched (legacy/vendor-locked)", "Patched during scheduled maintenance windows", "Actively managed patch program"], {
      visibleIf: (answers) => answers.hasOT === "Yes"
    }),
    select("otMonitoring", "infra", "Do you have monitoring specific to OT/ICS traffic (e.g. an OT-aware IDS)?", ["No", "Partial coverage", "Yes"], {
      visibleIf: (answers) => answers.hasOT === "Yes"
    }),
    vendor("otVendor", "infra", "What ICS/SCADA platform or vendor is primarily in use, if known?", OT_ICS_VENDORS, {
      visibleIf: (answers) => answers.hasOT === "Yes"
    })
  ];
  function otSectionSkipped(answers) {
    const ind = INDUSTRIES.find((i) => i.id === answers.industry);
    return Boolean(ind && ind.otDefault === "skip" && !answers.otOverride);
  }

  // src/data/team-structure.js
  var HEADCOUNT_OPTIONS = ["1\u20132", "3\u201310", "10+"];
  function profile(id, text2, extra) {
    return { id, kind: "profile", category: "team", type: "select", text: text2, ...extra };
  }
  function vendorField(id, text2, vendorOptions, extra) {
    return { id, kind: "profile", category: "team", type: "vendor", text: text2, vendorOptions, required: false, ...extra };
  }
  var TEAM_STRUCTURE_ORDER = [
    "teamDedicated",
    "itOnlyHeadcount",
    "itHeadcountSeparate",
    "cybersecHeadcount",
    "combinedHeadcount",
    "outsourcedStructure",
    "outsourcedMspName",
    "outsourcedFunctionBreakdown",
    "dayToDay",
    "inhouseSocCapability",
    "partialOutsourceFunctions",
    "fullMspProviderName",
    "mspSocOwner",
    "mixedMspProviderName",
    "mixedOtherProviderDetail",
    "mdrProviderName",
    "mdrMspProviderName",
    "msspProviderName",
    "socOwnership",
    "cyberInsurance",
    "incidentRecoveryOwner"
  ];
  var a = (answers) => answers;
  var DAY_TO_DAY_OPTIONS = [
    { id: "inhouse-all", label: "In-house team manages everything, no services outsourced" },
    { id: "partial-outsource", label: "Some services managed in-house, some outsourced" },
    { id: "full-msp", label: "Completely outsourced to MSP" },
    { id: "mixed-msp-other", label: "Some services managed in-house, some by MSP, some by other outsourced providers" },
    { id: "mdr-msp", label: "MDR service and dedicated MSP" },
    { id: "mssp", label: "MSSP" }
  ];
  var TEAM_STRUCTURE_NODES = [
    // ---- Step 1 ----
    {
      ...profile("teamDedicated", "Do you have a dedicated IT or cybersecurity team?"),
      options: [
        "Yes, only a dedicated IT team maintaining infrastructure",
        "Yes, dedicated IT and cybersecurity team",
        "Our IT team takes care of both IT and cybersecurity",
        "IT services outsourced with no internal IT team"
      ],
      required: true,
      next(answers) {
        switch (a(answers).teamDedicated) {
          case "Yes, only a dedicated IT team maintaining infrastructure":
            return "itOnlyHeadcount";
          case "Yes, dedicated IT and cybersecurity team":
            return "itHeadcountSeparate";
          case "Our IT team takes care of both IT and cybersecurity":
            return "combinedHeadcount";
          case "IT services outsourced with no internal IT team":
            return "outsourcedStructure";
          default:
            return null;
        }
      }
    },
    // ---- Step 2: headcount (shape depends on Step 1) ----
    {
      ...profile("itOnlyHeadcount", "How many people are on your dedicated IT team?"),
      options: HEADCOUNT_OPTIONS,
      required: true,
      next: () => "dayToDay"
    },
    {
      ...profile("itHeadcountSeparate", "How many people are on your dedicated IT team (infrastructure/operations, separate from cybersecurity)?"),
      options: HEADCOUNT_OPTIONS,
      required: true,
      next: () => "cybersecHeadcount"
    },
    {
      ...profile("cybersecHeadcount", "How many people are on your dedicated cybersecurity team?"),
      options: HEADCOUNT_OPTIONS,
      required: true,
      next: () => "dayToDay"
    },
    {
      ...profile("combinedHeadcount", "How many people are on your combined IT & cybersecurity team?"),
      options: HEADCOUNT_OPTIONS,
      required: true,
      next: () => "dayToDay"
    },
    // ---- No internal team branch (Step 1 = outsourced) ----
    // CLAUDE.md's worked example for this branch: "ask specifically whether
    // all services are handled by one dedicated MSP or by different providers
    // per service type, then branch further: is SOC managed by a third party?
    // Is there a cyber insurance provider? Who owns post-incident recovery?"
    {
      ...profile("outsourcedStructure", "Are your IT and cybersecurity services handled by one dedicated provider, or by different providers per service type?"),
      options: [
        "One dedicated MSP handles everything",
        "Different providers for different service types (e.g. separate MSP, MDR, backup vendor)",
        "No formal outsourced arrangement - handled ad hoc"
      ],
      required: true,
      next(answers) {
        switch (a(answers).outsourcedStructure) {
          case "One dedicated MSP handles everything":
            return "outsourcedMspName";
          case "Different providers for different service types (e.g. separate MSP, MDR, backup vendor)":
            return "outsourcedFunctionBreakdown";
          case "No formal outsourced arrangement - handled ad hoc":
            return "socOwnership";
          default:
            return null;
        }
      }
    },
    {
      ...vendorField("outsourcedMspName", "Which MSP provides this coverage?", MSP_VENDORS),
      dedupeKey: "mspProviderName",
      next: () => "socOwnership"
    },
    {
      id: "outsourcedFunctionBreakdown",
      kind: "profile",
      category: "team",
      type: "text",
      text: 'Briefly, which provider handles which function (e.g. "MSP handles helpdesk/patching, separate MDR vendor handles detection")?',
      placeholder: "e.g. MSP: Kyndryl (infrastructure); MDR: Arctic Wolf (monitoring)",
      required: false,
      next: () => "socOwnership"
    },
    // ---- Step 3: day-to-day management (multi-select) ----
    {
      id: "dayToDay",
      kind: "profile",
      category: "team",
      type: "multiselect",
      text: "How is cybersecurity managed day to day? (select all that apply)",
      options: DAY_TO_DAY_OPTIONS,
      required: true,
      visibleIf: (answers) => a(answers).teamDedicated !== "IT services outsourced with no internal IT team",
      next: () => "inhouseSocCapability"
    },
    {
      id: "inhouseSocCapability",
      kind: "profile",
      category: "team",
      type: "select",
      text: "Does your in-house coverage include a dedicated SOC, incident response, and forensics/recovery capability?",
      options: ["Yes, all three in-house", "Some in-house, some gaps", "No dedicated SOC/IR/forensics capability"],
      required: true,
      visibleIf: (answers) => (a(answers).dayToDay || []).includes("inhouse-all"),
      next: () => "partialOutsourceFunctions"
    },
    {
      id: "partialOutsourceFunctions",
      kind: "profile",
      category: "team",
      type: "text",
      text: "Which specific functions are outsourced (e.g. SOC/monitoring, incident response, patch management, backup/DR, firewall management, email security)?",
      placeholder: "e.g. SOC/monitoring and patch management are outsourced; everything else is in-house",
      required: false,
      visibleIf: (answers) => (a(answers).dayToDay || []).includes("partial-outsource"),
      next: () => "fullMspProviderName"
    },
    {
      ...vendorField("fullMspProviderName", "Which MSP is it completely outsourced to?", MSP_VENDORS),
      dedupeKey: "mspProviderName",
      visibleIf: (answers) => (a(answers).dayToDay || []).includes("full-msp"),
      next: () => "mspSocOwner"
    },
    {
      id: "mspSocOwner",
      kind: "profile",
      category: "team",
      type: "select",
      text: "Is SOC/security monitoring handled by that same MSP, or a separate third party?",
      options: ["Same MSP", "Separate third party", "No SOC/monitoring in place"],
      required: true,
      visibleIf: (answers) => (a(answers).dayToDay || []).includes("full-msp"),
      next: () => "mixedMspProviderName"
    },
    {
      ...vendorField("mixedMspProviderName", "In the mixed arrangement, which MSP is involved?", MSP_VENDORS),
      dedupeKey: "mspProviderName",
      visibleIf: (answers) => (a(answers).dayToDay || []).includes("mixed-msp-other"),
      next: () => "mixedOtherProviderDetail"
    },
    {
      id: "mixedOtherProviderDetail",
      kind: "profile",
      category: "team",
      type: "text",
      text: "What do the other outsourced providers handle, and which vendors are they?",
      placeholder: "e.g. Backup/DR outsourced to a separate managed backup vendor",
      required: false,
      visibleIf: (answers) => (a(answers).dayToDay || []).includes("mixed-msp-other"),
      next: () => "mdrProviderName"
    },
    {
      ...vendorField("mdrProviderName", "Which MDR service do you use?", MDR_VENDORS),
      dedupeKey: "mdrProviderName",
      visibleIf: (answers) => (a(answers).dayToDay || []).includes("mdr-msp"),
      next: () => "mdrMspProviderName"
    },
    {
      ...vendorField("mdrMspProviderName", "And which MSP handles the rest of IT alongside that MDR service?", MSP_VENDORS),
      dedupeKey: "mspProviderName",
      visibleIf: (answers) => (a(answers).dayToDay || []).includes("mdr-msp"),
      next: () => "msspProviderName"
    },
    {
      ...vendorField("msspProviderName", "Which MSSP do you use?", MSSP_VENDORS),
      dedupeKey: "msspProviderName",
      visibleIf: (answers) => (a(answers).dayToDay || []).includes("mssp"),
      next: () => "socOwnership"
    },
    // ---- Shared accountability follow-ups (fire once, regardless of which
    // branch triggered outsourcing - dedupeKey prevents any of them being
    // asked twice per §5.10) ----
    {
      id: "socOwnership",
      kind: "profile",
      category: "team",
      type: "select",
      text: "Is SOC / security monitoring managed by a third party, or in-house?",
      options: ["Fully third-party", "Hybrid - some in-house, some third-party", "Fully in-house"],
      required: true,
      dedupeKey: "socOwnership",
      visibleIf: (answers) => {
        const ans = a(answers);
        if (ans.teamDedicated === "IT services outsourced with no internal IT team") return true;
        const d = ans.dayToDay || [];
        return d.some((id) => id !== "inhouse-all");
      },
      next: () => "cyberInsurance"
    },
    {
      id: "cyberInsurance",
      kind: "profile",
      category: "team",
      type: "select",
      text: "Do you have a cyber insurance policy?",
      options: ["Yes", "No", "Not sure"],
      required: true,
      dedupeKey: "cyberInsurance",
      visibleIf: (answers) => {
        const ans = a(answers);
        if (ans.teamDedicated === "IT services outsourced with no internal IT team") return true;
        const d = ans.dayToDay || [];
        return d.some((id) => id !== "inhouse-all");
      },
      next: () => "incidentRecoveryOwner"
    },
    {
      id: "incidentRecoveryOwner",
      kind: "profile",
      category: "team",
      type: "select",
      text: "Who owns post-incident recovery - your internal team, your MSP/MSSP, or a separate incident-response retainer firm?",
      options: ["Internal team", "MSP/MSSP", "Dedicated IR retainer firm", "Not defined"],
      required: true,
      dedupeKey: "incidentRecoveryOwner",
      visibleIf: (answers) => {
        const ans = a(answers);
        if (ans.teamDedicated === "IT services outsourced with no internal IT team") return true;
        const d = ans.dayToDay || [];
        return d.some((id) => id !== "inhouse-all");
      }
    }
  ];

  // src/data/containerization.js
  var CONTAINERIZATION_ORDER = [
    "usesContainers",
    "containerOrchestration",
    "containerImageScanning",
    "containerHostSecurity",
    "usesVirtualization",
    "hypervisorPatching",
    "vmSegmentation"
  ];
  var CONTAINERIZATION_NODES = [
    {
      id: "usesContainers",
      kind: "profile",
      category: "infra",
      type: "select",
      text: "Do you use containerization (e.g. Docker) for any systems - applications, file servers, intranet sites, or other infrastructure?",
      options: ["No", "Yes, some workloads", "Yes, most/all workloads"],
      required: true
    },
    {
      id: "containerOrchestration",
      kind: "profile",
      category: "infra",
      type: "select",
      text: "If containerized, do you use an orchestrator (e.g. Kubernetes)?",
      options: ["No, containers run without an orchestrator", "Yes"],
      visibleIf: (answers) => answers.usesContainers && answers.usesContainers !== "No"
    },
    {
      id: "containerImageScanning",
      kind: "profile",
      category: "infra",
      type: "select",
      text: "Are container images/dependencies scanned for known vulnerabilities before deployment?",
      options: ["No", "Occasionally", "Yes, automated on every build"],
      visibleIf: (answers) => answers.usesContainers && answers.usesContainers !== "No"
    },
    {
      id: "containerHostSecurity",
      kind: "profile",
      category: "infra",
      type: "select",
      text: "How are the underlying container hosts secured?",
      options: [
        "Not specifically hardened - same as general servers",
        "Some hardening (e.g. minimal base images)",
        "Hardened and patched on a defined cadence"
      ],
      visibleIf: (answers) => answers.usesContainers && answers.usesContainers !== "No"
    },
    {
      id: "usesVirtualization",
      kind: "profile",
      category: "infra",
      type: "select",
      text: "Beyond containers, is virtualization (VMs/hypervisors) used for servers?",
      options: [
        "No / cloud-native only",
        "Yes, on-prem hypervisor (e.g. VMware, Hyper-V)",
        "Yes, cloud VM instances"
      ],
      required: true
    },
    {
      id: "hypervisorPatching",
      kind: "profile",
      category: "infra",
      type: "select",
      text: "How are hypervisor hosts patched and maintained?",
      options: ["Ad hoc / rarely", "Scheduled maintenance windows", "Actively managed patch program with a defined SLA"],
      visibleIf: (answers) => answers.usesVirtualization && answers.usesVirtualization !== "No / cloud-native only"
    },
    {
      id: "vmSegmentation",
      kind: "profile",
      category: "infra",
      type: "select",
      text: "Are VMs/containers for different trust levels (e.g. production vs. test, internet-facing vs. internal) network-segmented from each other?",
      options: ["No - flat network", "Partially segmented", "Yes, fully segmented"],
      visibleIf: (answers) => answers.usesContainers && answers.usesContainers !== "No" || answers.usesVirtualization && answers.usesVirtualization !== "No / cloud-native only"
    }
  ];

  // src/data/profile-flow.js
  var PROFILE_SCREENS = [
    {
      id: "profile",
      title: "Organization Profile",
      sub: "Scale changes what's realistic to recommend - a 10-person firm and a 2,000-person firm shouldn't get the same advice.",
      flow: buildFlow(ORG_PROFILE_ORDER, ORG_PROFILE_NODES)
    },
    {
      id: "team",
      title: "Your Team & Vendors",
      sub: "Who owns cybersecurity day to day, and how - this shapes which follow-up questions actually apply to you.",
      flow: buildFlow(TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES)
    },
    {
      id: "infra",
      title: "Technology & Infrastructure",
      sub: "The specific products and architecture in place - this is what lets recommendations reference your actual stack instead of speaking generically.",
      flow: buildFlow(INFRA_ORDER, INFRA_NODES)
    },
    {
      id: "containerization",
      title: "Containerization & Virtualization",
      sub: "Applies to any use of containers or VMs - file servers and intranet sites count, not just custom applications.",
      flow: buildFlow(CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES)
    },
    {
      id: "devsecops",
      title: "Software Delivery & DevSecOps",
      sub: "Only applicable if you build software - the first question determines whether the rest of this screen applies.",
      flow: buildFlow(DEVSEC_ORDER, DEVSEC_NODES)
    },
    {
      id: "ot",
      title: "Operational Technology (OT)",
      sub: "Industrial control systems and SCADA run on a different risk model than office IT - this section only applies if one exists.",
      flow: buildFlow(OT_ORDER, OT_NODES),
      skipIf: otSectionSkipped
    }
  ];

  // src/data/categories.js
  var FUNCTIONS2 = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];
  var FUNC_COLORS2 = {
    Govern: "#B48EC7",
    Identify: "#E0A94A",
    Protect: "var(--accent-signal)",
    Detect: "#6FA8DC",
    Respond: "#D6685F",
    Recover: "#3FC7C0"
  };
  var FUNC_DISPLAY = {
    Govern: "Your Team & Vendors",
    Identify: "Data & Systems",
    Protect: "Access & Identity",
    Detect: "Detection & Monitoring",
    Respond: "Incident Readiness",
    Recover: "Recovery & Continuity"
  };
  var FUNC_REF = {
    Govern: "NIST CSF \xB7 GV.PO / GV.RR / GV.SC",
    Identify: "NIST CSF \xB7 ID.AM / ID.RA",
    Protect: "NIST CSF \xB7 PR.AC / PR.DS",
    Detect: "NIST CSF \xB7 DE.CM",
    Respond: "NIST CSF \xB7 RS.RP / RS.CO",
    Recover: "NIST CSF \xB7 RC.RP"
  };

  // src/data/nist-questions.js
  function scored(fn, id, text2, options, extra) {
    return { id, kind: "scored", fn, category: FUNC_DISPLAY[fn], text: text2, options, ...extra };
  }
  var NIST_QUESTIONS = [
    // Govern
    scored("Govern", "govPolicy", "Is there a documented cybersecurity policy, approved by leadership?", [
      { v: 0, t: "No" },
      { v: 1, t: "Yes, but outdated or unreviewed" },
      { v: 2, t: "Yes, current and formally approved" }
    ]),
    scored("Govern", "govRoles", "Are cybersecurity roles and responsibilities formally assigned?", [
      { v: 0, t: 'No - "IT handles it", informally' },
      { v: 1, t: "Somewhat, but not documented" },
      { v: 2, t: "Yes, clearly documented" }
    ]),
    scored("Govern", "govReporting", "Does leadership receive regular reporting on cybersecurity risk?", [
      { v: 0, t: "Never" },
      { v: 1, t: "Ad hoc, when something goes wrong" },
      { v: 2, t: "Yes, on a regular schedule" }
    ]),
    scored("Govern", "govRiskDecisions", "Is cybersecurity risk factored into business decisions (new vendors, new products) before they're approved?", [
      { v: 0, t: "No" },
      { v: 1, t: "Sometimes, informally" },
      { v: 2, t: "Yes, a formal process" }
    ]),
    scored("Govern", "isoIsms", "Do you maintain a formal Information Security Management System (ISMS) with a defined scope and periodic management review?", [
      { v: 0, t: "No" },
      { v: 1, t: "Informally" },
      { v: 2, t: "Yes, formally documented" }
    ], { framework: "iso27001" }),
    scored("Govern", "nis2Training", "Has your management body received specific training on cybersecurity risk oversight, as NIS2 requires of accountable executives?", [
      { v: 0, t: "No" },
      { v: 1, t: "Not formally" },
      { v: 2, t: "Yes" }
    ], { framework: "nis2" }),
    // §5.6 — HIPAA
    scored("Govern", "hipaaBAA", "Do you have signed Business Associate Agreements (BAAs) with every vendor that accesses, stores, or transmits PHI?", [
      { v: 0, t: "No" },
      { v: 1, t: "With some, not all" },
      { v: 2, t: "Yes, with all applicable vendors" }
    ], { framework: "hipaa" }),
    // §5.6 — GDPR
    scored("Govern", "gdprRopa", "Do you maintain a record of processing activities (ROPA) documenting the lawful basis for each use of personal data?", [
      { v: 0, t: "No" },
      { v: 1, t: "Partial / informal" },
      { v: 2, t: "Yes, maintained and current" }
    ], { framework: "gdpr" }),
    scored("Govern", "gdprDSR", "Do you have a documented process to handle data subject rights requests (access, deletion, portability) within the required timeframe?", [
      { v: 0, t: "No" },
      { v: 1, t: "Informal, no defined timeframe" },
      { v: 2, t: "Yes, a documented process exists" }
    ], { framework: "gdpr" }),
    // §5.8
    scored("Govern", "aiToolGovernance", "Are AI tools used within the organization, and if so, is that usage tracked and governed?", [
      { v: 0, t: "Used with no tracking or policy" },
      { v: 1, t: "Used informally - some awareness, no formal policy" },
      { v: 2, t: "A formal AI usage policy exists and usage is tracked" }
    ]),
    // Identify
    scored("Identify", "assetInv", "How would you describe your asset inventory?", [
      { v: 0, t: "No formal inventory - tribal knowledge" },
      { v: 1, t: "Partial, manually maintained spreadsheet" },
      { v: 2, t: "Automated and continuously updated" }
    ]),
    scored("Identify", "dataClass", "Do you classify data by sensitivity (public / internal / confidential / restricted)?", [
      { v: 0, t: "No" },
      { v: 2, t: "Yes" }
    ]),
    scored("Identify", "vendorCount", "How many third-party vendors have access to your systems or data?", [
      { v: 2, t: "None" },
      { v: 1, t: "1\u20135, informally tracked" },
      { v: 0, t: "6+, and not formally reviewed" }
    ]),
    scored("Identify", "isoRiskAssess", "Do you conduct a formal asset-based risk assessment at least annually?", [
      { v: 0, t: "No" },
      { v: 1, t: "Ad hoc, not annual" },
      { v: 2, t: "Yes, at least annually" }
    ], { framework: "iso27001" }),
    // §5.6 — HIPAA
    scored("Identify", "hipaaRiskAnalysis", "Have you conducted a HIPAA-required security risk analysis covering all systems that create, receive, maintain, or transmit ePHI?", [
      { v: 0, t: "No" },
      { v: 1, t: "Yes, but outdated or partial" },
      { v: 2, t: "Yes, current and comprehensive" }
    ], { framework: "hipaa" }),
    // Protect
    scored("Protect", "mfa", "Is multi-factor authentication enforced for remote and admin access?", [
      { v: 0, t: "No" },
      { v: 1, t: "Admin accounts only" },
      { v: 2, t: "Yes, everywhere" }
    ]),
    scored("Protect", "patching", "How are software patches and updates managed?", [
      { v: 0, t: "Ad hoc / manual" },
      { v: 1, t: "Scheduled but inconsistent" },
      { v: 2, t: "Automated, with an SLA" }
    ]),
    scored("Protect", "training", "Do employees receive security awareness training?", [
      { v: 0, t: "Never" },
      { v: 1, t: "Once, at onboarding" },
      { v: 2, t: "Ongoing, recurring" }
    ]),
    scored("Protect", "phishingSim", "Do you run simulated phishing tests for employees?", [
      { v: 0, t: "No" },
      { v: 1, t: "Yes, but infrequently (less than annually)" },
      { v: 2, t: "Yes, on a regular schedule" }
    ]),
    // §5.7: cadence follow-up on top of the training question above, rather
    // than a duplicate training question - only asked once some training
    // actually happens. Integrates with (doesn't duplicate) phishingSim.
    scored("Protect", "trainingCadence", "What is the actual cadence of that security awareness training?", [
      { v: 0, t: "Ad hoc / no fixed schedule" },
      { v: 1, t: "Annually" },
      { v: 2, t: "Ongoing / continuous (e.g. monthly micro-training)" }
    ], { visibleIf: (answers) => answers.training !== 0 }),
    scored("Protect", "endpoint", "Is endpoint protection (EDR/antivirus) deployed on all devices?", [
      { v: 0, t: "No" },
      { v: 1, t: "Partial coverage" },
      { v: 2, t: "Yes, all devices" }
    ]),
    scored("Protect", "rdpExposed", "Is RDP or another remote-admin protocol reachable directly from the internet (not behind a VPN/ZTNA)?", [
      { v: 0, t: "Yes" },
      { v: 2, t: "No - behind VPN/ZTNA only" }
    ]),
    scored("Protect", "emailAuth", "Is email authentication (SPF, DKIM, and DMARC set to quarantine/reject) enforced for your domain?", [
      { v: 0, t: "No / not sure" },
      { v: 1, t: 'Partially - e.g. DMARC set to "none"' },
      { v: 2, t: "Yes, fully enforced" }
    ]),
    scored("Protect", "privSeparation", "Are administrative accounts kept separate from everyday user accounts?", [
      { v: 0, t: "No - same account used for both" },
      { v: 1, t: "Partially" },
      { v: 2, t: "Yes, fully separated" }
    ]),
    // §5.8: builds on privSeparation with the just-in-time dimension - only
    // meaningful once there's at least a partially separate admin account to
    // grant standing vs. just-in-time privileges on.
    scored("Protect", "privilegedAccessModel", "For those separate admin accounts, is elevated access always-on (standing privileges) or granted just-in-time for specific tasks?", [
      { v: 0, t: "Standing / always-on elevated access" },
      { v: 1, t: "Some just-in-time elements, not fully enforced" },
      { v: 2, t: "Fully just-in-time - elevated only when needed" }
    ], { visibleIf: (answers) => answers.privSeparation !== 0 }),
    scored("Protect", "privAccountMgmt", "How are privileged accounts (domain admins, database admins, local/server administrators) managed?", [
      { v: 0, t: "No formal management - shared or long-standing credentials" },
      { v: 1, t: "Individually assigned, but not regularly reviewed" },
      { v: 2, t: "Individually assigned, regularly reviewed/rotated, least-privilege enforced" }
    ]),
    scored("Protect", "passwordPolicy", "What is the organization's password policy for length, complexity, and rotation?", [
      { v: 0, t: "No formal policy / weak defaults" },
      { v: 1, t: "Basic complexity requirements enforced" },
      { v: 2, t: "Strong length/complexity policy enforced organization-wide" }
    ]),
    scored("Protect", "passwordManager", "Do administrators and/or employees use a password management tool?", [
      { v: 0, t: "No" },
      { v: 1, t: "Some individuals use one informally" },
      { v: 2, t: "Yes, an organization-provisioned password manager is standard" }
    ]),
    scored("Protect", "offboarding", "Is there a formal process to revoke all access immediately when someone leaves or changes roles?", [
      { v: 0, t: "No" },
      { v: 1, t: "Informal / inconsistent" },
      { v: 2, t: "Yes, formal and immediate" }
    ]),
    scored("Protect", "soc2Change", "Do you have documented change management controls for production systems?", [
      { v: 0, t: "No" },
      { v: 1, t: "Informal" },
      { v: 2, t: "Yes, documented and enforced" }
    ], { framework: "soc2" }),
    // §5.6 — HIPAA
    scored("Protect", "hipaaEncryption", "Is PHI encrypted both at rest and in transit?", [
      { v: 0, t: "No / not consistently" },
      { v: 1, t: "One but not both (at rest or in transit)" },
      { v: 2, t: "Yes, both at rest and in transit" }
    ], { framework: "hipaa" }),
    // §5.6 — SOX
    scored("Protect", "soxSoD", "Are segregation-of-duties controls enforced for systems affecting financial reporting (e.g. no single person can both initiate and approve a transaction)?", [
      { v: 0, t: "No" },
      { v: 1, t: "Partially" },
      { v: 2, t: "Yes, enforced" }
    ], { framework: "sox" }),
    scored("Protect", "soxAccessReview", "Are user access rights to financial systems formally reviewed on a periodic basis?", [
      { v: 0, t: "No" },
      { v: 1, t: "Ad hoc, not scheduled" },
      { v: 2, t: "Yes, on a defined schedule" }
    ], { framework: "sox" }),
    // §5.6 — Cyber Essentials (UK NCSC's 5 technical control themes - malware
    // protection and patch management are already covered by the existing
    // endpoint/patching questions above, so these two focus on the two themes
    // that aren't: boundary firewalls and secure configuration).
    scored("Protect", "cyberEssentialsBoundaryFirewall", "Are boundary firewalls configured to block all inbound traffic by default, only permitting explicitly required services?", [
      { v: 0, t: "No / broadly permissive rules" },
      { v: 1, t: "Partially restricted" },
      { v: 2, t: "Yes, default-deny with explicit exceptions only" }
    ], { framework: "cyberessentials" }),
    scored("Protect", "cyberEssentialsSecureConfig", "Are default/manufacturer passwords and unnecessary software or services removed from devices before deployment (secure baseline configuration)?", [
      { v: 0, t: "No" },
      { v: 1, t: "Inconsistently" },
      { v: 2, t: "Yes, a secure baseline is enforced" }
    ], { framework: "cyberessentials" }),
    // §5.6 — PCI DSS
    scored("Protect", "pcidssCDESegmentation", "Is the cardholder data environment (CDE) segmented from the rest of your network?", [
      { v: 0, t: "No" },
      { v: 1, t: "Partially segmented" },
      { v: 2, t: "Yes, fully segmented" }
    ], { framework: "pcidss" }),
    scored("Protect", "pcidssSensitiveAuthData", "Do you store sensitive authentication data (full track data, CVV/CVC, PIN) after authorization?", [
      { v: 0, t: "Yes, some is retained" },
      { v: 1, t: "Not sure" },
      { v: 2, t: "No, none is stored post-authorization" }
    ], { framework: "pcidss" }),
    // Detect
    scored("Detect", "siem", "Do you have centralized logging (SIEM or equivalent)?", [
      { v: 0, t: "No" },
      { v: 2, t: "Yes" }
    ]),
    scored("Detect", "anomalyTime", "How quickly would you typically notice a suspicious login or anomaly?", [
      { v: 2, t: "Minutes to hours - automated alerting" },
      { v: 1, t: "Days - manual review" },
      { v: 0, t: "We likely wouldn't notice" }
    ]),
    scored("Detect", "exfil", "Do you monitor for data exfiltration or unusual outbound traffic?", [
      { v: 0, t: "No" },
      { v: 2, t: "Yes" }
    ]),
    scored("Detect", "vulnScanning", "Do you run regular external and internal vulnerability scans?", [
      { v: 0, t: "Never" },
      { v: 1, t: "Occasionally / ad hoc" },
      { v: 2, t: "Yes, on a regular schedule" }
    ]),
    scored("Detect", "pentest", "Have you had an external penetration test or red-team engagement in the last 12 months?", [
      { v: 0, t: "No" },
      { v: 1, t: "More than 12 months ago" },
      { v: 2, t: "Yes, within the last 12 months" }
    ]),
    scored("Detect", "soc2Evidence", "Could you produce evidence/logs for an independent auditor showing controls operated effectively over a review period?", [
      { v: 0, t: "No" },
      { v: 1, t: "Partially" },
      { v: 2, t: "Yes" }
    ], { framework: "soc2" }),
    // §5.6 — SOX
    scored("Detect", "soxAuditTrail", "Are audit trails for financial systems retained and protected from tampering, per your audit requirements?", [
      { v: 0, t: "No" },
      { v: 1, t: "Retained, but not protected from tampering" },
      { v: 2, t: "Yes, retained and protected" }
    ], { framework: "sox" }),
    // §5.6 — PCI DSS
    scored("Detect", "pcidssASVScanning", "Do you undergo quarterly external vulnerability scans by an Approved Scanning Vendor (ASV), as PCI DSS requires?", [
      { v: 0, t: "No" },
      { v: 1, t: "Irregularly" },
      { v: 2, t: "Yes, quarterly" }
    ], { framework: "pcidss" }),
    // Respond
    scored("Respond", "irPlan", "Do you have a documented incident response plan?", [
      { v: 0, t: "No" },
      { v: 1, t: "Yes, but never tested" },
      { v: 2, t: "Yes, tested annually" }
    ]),
    scored("Respond", "irTeam", "Is there a designated incident response contact or team?", [
      { v: 0, t: "No" },
      { v: 2, t: "Yes" }
    ]),
    scored("Respond", "commsPlan", "Do you have a breach communication plan (legal, customers, regulators)?", [
      { v: 0, t: "No" },
      { v: 2, t: "Yes" }
    ]),
    scored("Respond", "nis2Notify", "If you experienced a significant incident, could you notify your national CSIRT/authority within 24 hours, as NIS2's early-warning rule requires?", [
      { v: 0, t: "No / unsure" },
      { v: 1, t: "Possibly, no defined process" },
      { v: 2, t: "Yes, a defined process exists" }
    ], { framework: "nis2" }),
    // §5.6 — GDPR
    scored("Respond", "gdprBreach72h", "If a personal data breach occurred, could you notify the relevant supervisory authority within GDPR's 72-hour window?", [
      { v: 0, t: "No / unsure" },
      { v: 1, t: "Possibly, no defined process" },
      { v: 2, t: "Yes, a defined process exists" }
    ], { framework: "gdpr" }),
    // Recover
    scored("Recover", "backupTest", "How often are backups tested by actually restoring data?", [
      { v: 2, t: "Quarterly or more" },
      { v: 1, t: "Rarely" },
      { v: 0, t: "Never" }
    ]),
    scored("Recover", "bcdr", "Do you have a documented business continuity / disaster recovery plan?", [
      { v: 0, t: "No" },
      { v: 2, t: "Yes" }
    ]),
    scored("Recover", "backupIsolation", "Are backups isolated from the production network (offline or immutable)?", [
      { v: 0, t: "No" },
      { v: 2, t: "Yes" }
    ])
  ];

  // src/data/assessment-flow.js
  var ASSESSMENT_NODES = NIST_QUESTIONS.map(
    (q) => q.framework ? { ...q, visibleIf: (answers) => Boolean(answers[q.framework]) } : q
  );
  var ASSESSMENT_ORDER = ASSESSMENT_NODES.map((q) => q.id);
  var ASSESSMENT_FLOW = buildFlow(ASSESSMENT_ORDER, ASSESSMENT_NODES);

  // src/engine/scoring.js
  function scoreFunction(fn, state) {
    const qs = visibleNodes(ASSESSMENT_FLOW, state).filter((q) => q.fn === fn);
    if (qs.length === 0) return 0;
    const max = qs.length * 2;
    const got = qs.reduce((sum, q) => sum + (state.answers[q.id] ?? 0), 0);
    return Math.round(got / max * 100);
  }
  function computeFuncScores(state) {
    return FUNCTIONS2.map((fn) => ({ fn, pct: scoreFunction(fn, state) }));
  }
  function computeOverall(funcScores) {
    return Math.round(funcScores.reduce((a2, f) => a2 + f.pct, 0) / funcScores.length);
  }
  function computeFlags(state) {
    const answers = state.answers;
    const flags = [];
    if (answers.mfa === 0 && answers.vendorCount === 0) {
      flags.push("No MFA combined with 6+ unreviewed third-party vendors means any single leaked vendor credential grants direct, unmonitored access - this is a materially higher-risk combination than either gap alone.");
    }
    if (answers.siem === 0 && answers.irPlan !== 2) {
      flags.push("No centralized logging paired with an untested (or absent) incident response plan means a breach would likely be discovered late, by someone else, with no rehearsed process to contain it.");
    }
    if (answers.backupTest === 0 && answers.endpoint !== 2) {
      flags.push("Untested backups combined with incomplete endpoint protection is the specific combination that turns a routine ransomware infection into an unrecoverable one.");
    }
    if (answers.training === 0 && answers.mfa !== 2) {
      flags.push("No security awareness training alongside partial MFA coverage means phishing is both more likely to succeed and more likely to reach an unprotected account.");
    }
    if (answers.govRiskDecisions === 0 && answers.vendorCount === 0) {
      flags.push("Cybersecurity risk isn't factored into vendor decisions, and you already have 6+ vendors that were never formally reviewed - this is exactly how supply-chain risk enters unnoticed rather than through a single dramatic failure.");
    }
    if (answers.govPolicy === 0 && answers.irPlan !== 2) {
      flags.push("No leadership-approved security policy alongside no tested incident response plan means there's no top-down mandate driving readiness - response capability depends on individual initiative rather than an accountable program.");
    }
    if (answers.externalWebsite === "Yes" && answers.webDb === "Yes" && (answers.siem === 0 || answers.exfil === 0)) {
      flags.push("A public-facing web app that connects to a backend database, without centralized logging or outbound-traffic monitoring, is precisely the setup where a SQL injection or similar attack goes unnoticed long enough to exfiltrate the entire database.");
    }
    if (answers.teamDedicated === "IT services outsourced with no internal IT team" && answers.outsourcedStructure === "No formal outsourced arrangement - handled ad hoc") {
      flags.push("No internal IT/security team and no formal outsourced arrangement either means, in practice, no one is accountable for noticing or acting on any of the findings in this report.");
    }
    if ((answers.deployModel === "Cloud-only" || answers.deployModel === "Hybrid (on-prem + cloud)") && answers.mfa === 0) {
      flags.push("Cloud or hybrid infrastructure without MFA enforced is a materially larger exposure than the same gap on a purely on-premises setup - cloud admin consoles are reachable from anywhere a leaked password reaches.");
    }
    if (answers.rdpExposed === 0 && (answers.backupTest === 0 || answers.endpoint !== 2)) {
      flags.push("Remote admin access reachable directly from the internet is, on its own, one of the most common real-world ransomware entry points. Paired with the backup or endpoint gaps flagged elsewhere here, it meaningfully raises the odds of a successful, damaging intrusion - this exact combination appears repeatedly in ransomware case studies.");
    }
    if (answers.emailAuth === 0 && answers.training === 0) {
      flags.push("No enforced email authentication (SPF/DKIM/DMARC) combined with no security awareness training means phishing and business email compromise attempts are both more likely to arrive successfully and more likely to fool the person who receives them.");
    }
    if (answers.training !== 0 && answers.phishingSim === 0) {
      flags.push("Training is happening, but without simulated phishing tests there's no actual evidence it's working - the two are meant to reinforce each other, and skipping simulation means the training's real effectiveness is unmeasured.");
    }
    if (answers.hasOT === "Yes" && answers.otSegregation === "No - flat/shared network") {
      flags.push("An OT/ICS environment sharing a flat network with corporate IT means a routine IT compromise (phishing, ransomware) can pivot directly into industrial control systems - this is one of the most consequential architecture gaps an OT environment can have.");
    }
    if (answers.hasOT === "Yes" && answers.otRemoteAccess === "Yes, but not via a dedicated secure gateway") {
      flags.push("Remote access into OT systems without a dedicated, monitored gateway is a direct path from any compromised remote user's device straight into industrial control systems.");
    }
    if (answers.developsSoftware === "Yes" && answers.devsecopsMaturity === "No formal practice - security reviewed late, if at all" && answers.secretsManagement === "Hardcoded or stored in plain config files") {
      flags.push("No security gates in the software delivery pipeline, combined with hardcoded secrets in code or config files, is one of the most common ways credentials end up leaked in a public repository or a compromised build artifact.");
    }
    if (answers.usesContainers && answers.usesContainers !== "No" && answers.containerImageScanning === "No") {
      flags.push("Running containerized workloads without scanning images for known vulnerabilities means you could be deploying publicly known, already-patched CVEs into production without realizing it.");
    }
    return flags;
  }
  function computeGapItems(state) {
    const items = [];
    visibleNodes(ASSESSMENT_FLOW, state).forEach((q) => {
      const val = state.answers[q.id];
      const maxOpt = Math.max(...q.options.map((o) => o.v));
      if (val === void 0 || val < maxOpt) {
        items.push({ fn: q.fn, gap: q.text, severity: maxOpt - (val ?? 0) });
      }
    });
    return items;
  }
  function computePriorities(state) {
    return computeGapItems(state).sort((a2, b) => b.severity - a2.severity).slice(0, 5);
  }
  function verdictLabel(pct) {
    if (pct >= 80) return "Strong health";
    if (pct >= 55) return "Moderate exposure";
    if (pct >= 30) return "Elevated exposure";
    return "Critical exposure";
  }

  // src/data/vendor-notes.js
  var VENDOR_NOTES = [
    { keywords: ["fortinet", "fortigate", "fortios"], vendor: "Fortinet", note: "Fortinet's FortiOS/FortiGate line has had multiple critical, actively-exploited authentication-bypass and RCE vulnerabilities in recent years. Regardless of current patch level: confirm firmware is on a currently-supported, patched release; avoid exposing the management interface to the internet; and enforce MFA on SSL-VPN." },
    { keywords: ["citrix", "netscaler"], vendor: "Citrix", note: 'Citrix NetScaler/ADC and Gateway appliances have repeatedly been targeted by actively-exploited critical vulnerabilities (the "Citrix Bleed" family among them). Keep firmware current, terminate active sessions after any patch, and restrict management access to trusted networks only.' },
    { keywords: ["ivanti", "pulse secure"], vendor: "Ivanti / Pulse Secure", note: "Ivanti Connect Secure and Pulse Secure VPN appliances have seen sustained, actively-exploited zero-days. Treat any Ivanti/Pulse edge device as a high-priority, frequent patch target and consider added network-layer restrictions on management access." },
    { keywords: ["cisco asa", "cisco ios", "cisco"], vendor: "Cisco", note: "Cisco ASA and IOS/IOS XE devices have had multiple actively-exploited RCE and privilege-escalation vulnerabilities. Disable the web management UI on internet-facing interfaces where not strictly required, and check Cisco's PSIRT advisories directly for your specific model." },
    { keywords: ["exchange"], vendor: "Microsoft Exchange (on-prem)", note: "On-premises Exchange servers have been a recurring target for critical, chained RCE vulnerabilities. If still running on-prem Exchange, treat it as a high-priority, closely-monitored patch target regardless of current version." },
    { keywords: ["vcenter", "esxi", "vmware"], vendor: "VMware", note: "VMware vCenter and ESXi have had several critical, actively-exploited RCE vulnerabilities. Ensure management interfaces are never internet-facing, and patching stays current." },
    { keywords: ["moveit"], vendor: "MOVEit / Progress", note: "MOVEit Transfer was the subject of a major mass-exploitation event via a since-patched critical vulnerability. Confirm you're on a current, fully-patched release and review file-transfer logs for the historical exposure window." },
    { keywords: ["sonicwall"], vendor: "SonicWall", note: "SonicWall firewall/VPN appliances have had repeated critical, actively-exploited vulnerabilities. Confirm firmware is current and management access is restricted." },
    { keywords: ["barracuda"], vendor: "Barracuda", note: "Barracuda's Email Security Gateway was subject to a critical zero-day serious enough that Barracuda recommended full hardware replacement for affected units. If you run Barracuda ESG appliances, verify directly with Barracuda whether your hardware was affected." },
    { keywords: ["proofpoint"], vendor: "Proofpoint", note: "Proofpoint's email security and security-awareness products are widely deployed - confirm URL Defense/attachment sandboxing are actually enabled (not just licensed), and that simulated-phishing results are being reviewed and acted on, not just collected." },
    { keywords: ["mimecast"], vendor: "Mimecast", note: "Mimecast email security deployments are commonly found with misconfigured DMARC alignment or impersonation-protection settings left at default - confirm these are actively enforced, not merely available in the license." },
    { keywords: ["knowbe4"], vendor: "KnowBe4", note: "Awareness platforms like KnowBe4 are only as effective as their completion and simulated-phishing-failure rates are actually reviewed by someone - track those metrics on a schedule, don't just deploy the training and move on." },
    { keywords: ["defender for office", "office 365 atp", "microsoft 365 defender"], vendor: "Microsoft Defender for Office 365", note: "Defender for Office 365 requires Safe Links and Safe Attachments to be explicitly enabled per the licensing tier - confirm these are actually turned on, not just included in the plan you're paying for." }
  ];
  function matchedVendorNotes(answers) {
    const haystack = [
      answers.edgeDeviceVendor,
      answers.sdwanVendor,
      answers.edrVendor,
      answers.hostingProvider,
      answers.webServerStack,
      answers.dlpVendor,
      answers.cloudProvider,
      answers.emailSecurityVendor,
      answers.awarenessLms
    ].filter(Boolean).join(" ").toLowerCase();
    if (!haystack) return [];
    const seen = /* @__PURE__ */ new Set();
    const matches = [];
    VENDOR_NOTES.forEach((v) => {
      if (v.keywords.some((k) => haystack.includes(k)) && !seen.has(v.vendor)) {
        seen.add(v.vendor);
        matches.push(v);
      }
    });
    return matches;
  }

  // src/ui/snapshot.js
  function snapshotRows(answers) {
    const rows = [];
    rows.push(["Organization size", answers.employeeCount || "-"]);
    let team = answers.teamDedicated || "-";
    if (answers.teamDedicated === "IT services outsourced with no internal IT team") {
      if (answers.outsourcedMspName) team += ` (${answers.outsourcedMspName})`;
    } else {
      const headcount = answers.itHeadcountSeparate || answers.combinedHeadcount || answers.itOnlyHeadcount;
      if (headcount) team += ` - ${headcount}`;
      if (answers.cybersecHeadcount) team += ` (+${answers.cybersecHeadcount} cybersecurity)`;
    }
    rows.push(["Dedicated IT/security team", team]);
    const providerNames = [answers.mspProviderName, answers.mdrProviderName, answers.msspProviderName].filter(Boolean);
    if (Array.isArray(answers.dayToDay) && answers.dayToDay.length) {
      const labels = answers.dayToDay.map((id) => DAY_TO_DAY_OPTIONS.find((o) => o.id === id)?.label || id);
      rows.push(["Security managed by", labels.join("; ") + (providerNames.length ? ` (${providerNames.join(", ")})` : "")]);
    } else if (providerNames.length) {
      rows.push(["Security managed by", providerNames.join(", ")]);
    }
    rows.push(["EDR / antivirus", answers.edrVendor || "Not specified"]);
    rows.push(["Email security gateway", answers.emailSecurityVendor || "Not specified"]);
    rows.push(["Awareness / LMS platform", answers.awarenessLms || "Not specified"]);
    let dlp = answers.dlpUsed || "-";
    if (answers.dlpVendor) dlp += ` - ${answers.dlpVendor}`;
    rows.push(["DLP solution", dlp]);
    let deploy = answers.deployModel || "-";
    if (answers.cloudProvider) deploy += ` - ${answers.cloudProvider}`;
    rows.push(["Deployment model", deploy]);
    rows.push(["Network architecture", answers.networkArch || "-"]);
    let sdwan = answers.sdwanUsed || "-";
    if (answers.sdwanVendor) sdwan += ` - ${answers.sdwanVendor}`;
    rows.push(["SD-WAN", sdwan]);
    rows.push(["External-facing devices", answers.externalDevices || "-"]);
    if (answers.edgeDeviceVendor) rows.push(["Firewall / VPN appliance", answers.edgeDeviceVendor]);
    let webExp = answers.externalWebsite || "-";
    if (answers.webDb) webExp += `, DB-connected: ${answers.webDb}`;
    rows.push(["External-facing services", webExp]);
    let hosting = answers.hostingProvider || "Not specified";
    if (answers.webServerStack) hosting += ` - ${answers.webServerStack}`;
    rows.push(["Hosting / web stack", hosting]);
    if (answers.usesContainers) rows.push(["Containerization", answers.usesContainers]);
    if (answers.usesVirtualization) rows.push(["Virtualization", answers.usesVirtualization]);
    if (answers.developsSoftware) {
      rows.push(["Develops custom software", answers.developsSoftware]);
      if (answers.developsSoftware === "Yes") {
        if (answers.devsecopsMaturity) rows.push(["DevSecOps maturity", answers.devsecopsMaturity]);
        if (answers.secretsManagement) rows.push(["Secrets management", answers.secretsManagement]);
      }
    }
    if (answers.hasOT) {
      let ot = answers.hasOT;
      if (answers.hasOT === "Yes" && answers.otSegregation) ot += ` - segregation: ${answers.otSegregation}`;
      rows.push(["OT / ICS environment", ot]);
      if (answers.otVendor) rows.push(["ICS/SCADA platform", answers.otVendor]);
    }
    return rows;
  }

  // src/engine/framework-guidance.js
  var FRAMEWORK_SUMMARY = {
    iso27001: "ISO 27001 certification requires a functioning ISMS with periodic management review and a documented risk assessment - both are exactly what the two ISO-tagged questions in this assessment measure.",
    nis2: "NIS2 carries personal liability for management bodies and a strict 24-hour early-warning notification duty - the NIS2-tagged questions above are among the most commonly failed requirements in early readiness assessments.",
    soc2: "A SOC 2 Type II audit specifically tests whether your change-management and evidence-logging controls operated effectively over the review period, not just whether they exist on paper.",
    hipaa: "HIPAA's Security Rule requires a documented risk analysis, executed Business Associate Agreements with every vendor touching PHI, and encryption of PHI - gaps in any of these are among the most commonly cited findings in HHS OCR enforcement actions.",
    gdpr: "GDPR requires a documented lawful basis for processing (a ROPA), a working data-subject-rights process, and the ability to notify a supervisory authority within 72 hours of a breach.",
    sox: "SOX Section 404 requires effective internal controls over financial reporting - segregation of duties, periodic access reviews, and tamper-evident audit trails on financial systems are the IT general controls auditors test first.",
    cyberessentials: "Cyber Essentials certification is scored against five specific technical control themes. The questions tagged for it here cover the two themes not already assessed elsewhere in this instrument (boundary firewalls and secure configuration) - malware protection and patch management are covered by the Endpoint and Patching questions above.",
    pcidss: "PCI DSS compliance hinges on keeping the cardholder data environment segmented, never retaining prohibited authentication data post-authorization, and running the required quarterly ASV scans."
  };
  function computeFrameworkRecommendations(state) {
    return FRAMEWORKS.filter((f) => state.answers[f.id]).map((f) => {
      const questions = NIST_QUESTIONS.filter((q) => q.framework === f.id);
      const gaps = questions.filter((q) => state.answers[q.id] !== void 0).map((q) => {
        const maxOpt = Math.max(...q.options.map((o) => o.v));
        const val = state.answers[q.id];
        if (val >= maxOpt) return null;
        const chosen = q.options.find((o) => o.v === val);
        return { question: q.text, chosen: chosen ? chosen.t : String(val) };
      }).filter(Boolean);
      return {
        id: f.id,
        name: f.name,
        summary: FRAMEWORK_SUMMARY[f.id] || f.desc,
        gaps,
        questionCount: questions.length
      };
    });
  }

  // src/ui/assessment.js
  function createAssessmentController({ getPanel, getRail, icon: icon2, goToTab: goToTab2, storage, exportProgressJson: exportProgressJson2 }) {
    const session = createSessionState();
    const ui = { phase: "scope", screenIndex: 0, categoryIndex: 0 };
    function panel() {
      return getPanel();
    }
    function visibleProfileScreens() {
      return PROFILE_SCREENS.filter((s) => !s.skipIf || !s.skipIf(session.answers));
    }
    function firstVisibleScreenIndex() {
      const list = visibleProfileScreens();
      return list.length ? PROFILE_SCREENS.indexOf(list[0]) : PROFILE_SCREENS.length;
    }
    function nextVisibleScreenIndex(from) {
      let i = from + 1;
      while (i < PROFILE_SCREENS.length && PROFILE_SCREENS[i].skipIf && PROFILE_SCREENS[i].skipIf(session.answers)) i++;
      return i;
    }
    function prevVisibleScreenIndex(from) {
      let i = from - 1;
      while (i >= 0 && PROFILE_SCREENS[i].skipIf && PROFILE_SCREENS[i].skipIf(session.answers)) i--;
      return i;
    }
    function lastVisibleScreenIndex() {
      let i = PROFILE_SCREENS.length - 1;
      while (i >= 0 && PROFILE_SCREENS[i].skipIf && PROFILE_SCREENS[i].skipIf(session.answers)) i--;
      return i;
    }
    function renderRail() {
      const rail = getRail();
      if (!rail) return;
      const visiblePre = visibleProfileScreens();
      const items = ["Scope", ...visiblePre.map((s) => s.title), ...FUNCTIONS2.map((fn) => FUNC_DISPLAY[fn]), "Reading"];
      let activeIdx;
      if (ui.phase === "scope") activeIdx = 0;
      else if (ui.phase === "profile") {
        const posInVisible = visiblePre.indexOf(PROFILE_SCREENS[ui.screenIndex]);
        activeIdx = 1 + (posInVisible >= 0 ? posInVisible : 0);
      } else if (ui.phase === "wizard") activeIdx = 1 + visiblePre.length + ui.categoryIndex;
      else activeIdx = items.length - 1;
      rail.innerHTML = '<div class="rail-line"></div>' + items.map((label, i) => {
        let cls = "node";
        if (i < activeIdx) cls += " done";
        if (i === activeIdx) cls += " active";
        return `<div class="${cls}"><div class="dot"></div><div class="label">${label}</div></div>`;
      }).join("");
    }
    function updateSerial() {
      const el = document.getElementById("serial");
      if (!el) return;
      const extra = FRAMEWORKS.filter((f) => session.answers[f.id]).map((f) => f.name);
      const label = extra.length ? `NIST CSF 2.0 \xB7 CIS Controls v8 + ${extra.join(" + ")}` : "NIST CSF 2.0 \xB7 CIS Controls v8";
      el.innerHTML = `SIMPLIFIEDCS / PROTOTYPE&nbsp;v0.1 \xB7 ${label}`;
    }
    async function renderScope() {
      const p = panel();
      p.innerHTML = `<div class="step-eyebrow">Scope</div><h2 class="step-title">Before we start</h2>`;
      let historyCount = 0;
      try {
        const lr = await storage.list("runs:", false);
        historyCount = lr && lr.keys ? lr.keys.length : 0;
      } catch (e) {
      }
      const ind = session.answers.industry ? INDUSTRIES.find((i) => i.id === session.answers.industry) : null;
      const selectedRegions = session.answers.regions || [];
      const selectedCountries = session.answers.countries || [];
      const reasons = {};
      const addReason = (fid, r) => {
        reasons[fid] = reasons[fid] || [];
        reasons[fid].push(r);
      };
      if (ind && ind.topPriority) addReason(ind.topPriority, { type: "top", label: `\u2605 Top priority recommendation for ${ind.label}` });
      if (ind && ind.alsoRelevant) ind.alsoRelevant.forEach((fid) => addReason(fid, { type: "industry", label: `Commonly relevant for ${ind.label}` }));
      selectedRegions.forEach((rid) => {
        const r = REGIONS.find((x) => x.id === rid);
        if (r) r.frameworks.forEach((fid) => addReason(fid, { type: "region", label: `Relevant for ${r.label} operations` }));
      });
      const highlightedIds = Object.keys(reasons);
      const highlightedFw = FRAMEWORKS.filter((f) => highlightedIds.includes(f.id)).sort((a2, b) => (a2.id === ind?.topPriority ? -1 : 0) - (b.id === ind?.topPriority ? -1 : 0));
      const otherFw = FRAMEWORKS.filter((f) => !highlightedIds.includes(f.id));
      const regularRegions = REGIONS.filter((r) => !r.standalone);
      const globalRegion = REGIONS.find((r) => r.standalone);
      p.innerHTML = `
      <div class="step-eyebrow">Scope</div>
      <h2 class="step-title">Before we start</h2>
      <p class="step-sub">Every assessment includes the NIST CSF 2.0 + CIS Controls baseline. Add any compliance standards that apply to your organization - none are selected automatically, even if we flag one as relevant for your industry or region.</p>
      ${historyCount ? `<p class="history-link" id="historyLink">You have ${historyCount} previous assessment${historyCount === 1 ? "" : "s"} saved on this account - <u>view history</u></p>` : ""}

      <div class="fw-section-label">Industry</div>
      <div class="industry-grid">
        ${INDUSTRIES.map((i) => `<div class="industry-card ${session.answers.industry === i.id ? "selected" : ""}" data-industry="${i.id}">${i.label}</div>`).join("")}
      </div>

      ${(() => {
        if (!ind) return "";
        if (ind.otDefault === "skip")
          return `<div class="ot-skip-note">
          Based on <b>${ind.label}</b>, we've assumed no dedicated OT/ICS environment and will skip those questions.
          <label class="ot-override-label"><input type="checkbox" id="otOverrideCheck" ${session.answers.otOverride ? "checked" : ""}> Include OT questions anyway</label>
        </div>`;
        if (ind.otDefault === "likely")
          return `<div class="ot-likely-note">
          OT/ICS environments are common in <b>${ind.label}</b> - we've kept those questions in your assessment by default. Answer "No" on that step if it genuinely doesn't apply to you.
        </div>`;
        return "";
      })()}

      <div class="fw-section-label">Where do you operate?</div>
      <p class="scope-hint" style="margin-top:-6px;">Select every region your organization is registered or operating in - this surfaces the specific frameworks mandated there. Choose Global if this doesn't apply, or narrow down to specific countries below.</p>

      <div class="region-global-standalone ${selectedRegions.includes(globalRegion.id) ? "selected" : ""}" data-region="${globalRegion.id}">
        <div class="checkbox"></div><b>${globalRegion.label}</b> - not tied to a specific region
      </div>

      <div class="region-grid">
        ${regularRegions.map(
        (r) => `
          <div class="region-chip ${selectedRegions.includes(r.id) ? "selected" : ""}" data-region="${r.id}">
            <div class="checkbox"></div>${r.label}
          </div>
        `
      ).join("")}
      </div>
      ${selectedRegions.map((rid) => {
        const r = REGIONS.find((x) => x.id === rid);
        return r ? `<div class="region-note"><b>${r.label}:</b> ${r.note}</div>` : "";
      }).join("")}

      <div class="acc-card ${selectedCountries.length ? "open" : ""}" style="margin-top:10px;">
        <div class="acc-head">
          <div class="icon-badge">${icon2("register")}</div>
          <div><h4>Select specific countries</h4><div class="acc-sub">Optional - ${selectedCountries.length ? `${selectedCountries.length} selected` : "for granular, per-country tracking"}</div></div>
          <div class="acc-chevron">\u25B8</div>
        </div>
        <div class="acc-body">
          <div class="country-checklist">
            ${COUNTRIES.map(
        (c) => `
              <label class="country-check-item">
                <input type="checkbox" data-country="${c}" ${selectedCountries.includes(c) ? "checked" : ""}> ${c}
              </label>
            `
      ).join("")}
          </div>
        </div>
      </div>

      <div class="fw-section-label">Frameworks</div>
      <div class="fw-baseline"><b>Always included:</b> NIST CSF 2.0 + CIS Controls v8 (the baseline this instrument is built on)</div>
      ${(() => {
        const hasOtherSelected = otherFw.some((f) => session.answers[f.id]);
        const fwCardHtml = (f) => `
          <div class="fw-card ${session.answers[f.id] ? "selected" : ""} ${reasons[f.id]?.some((r) => r.type === "top") ? "fw-top-priority" : ""}" data-fw="${f.id}">
            <div>
              <div class="fw-name">${f.name}</div>
              ${(reasons[f.id] || []).map((r) => `<div class="priority-tag">${r.label}</div>`).join("")}
              <div class="fw-desc">${f.desc}</div>
            </div>
            <div class="checkbox"></div>
          </div>
        `;
        return `
          ${highlightedFw.map(fwCardHtml).join("")}
          <div class="acc-card ${hasOtherSelected ? "open" : ""}" style="margin-top:10px;">
            <div class="acc-head">
              <div class="icon-badge">${icon2("register")}</div>
              <div><h4>Additional Compliance & Regulatory Frameworks</h4><div class="acc-sub">${otherFw.length} more standards available - ${hasOtherSelected ? "you have one selected below" : "optional, select any that apply"}</div></div>
              <div class="acc-chevron">\u25B8</div>
            </div>
            <div class="acc-body" style="padding-left:18px;">
              ${otherFw.map(fwCardHtml).join("")}
            </div>
          </div>
        `;
      })()}
      <p class="scope-hint">These are common patterns, not a legal determination - confirm exact obligations (especially NIS2 sector/size thresholds) with your regulatory counsel.</p>

      <div class="nav">
        <div></div>
        <button class="primary" id="scopeNext">Start assessment \u2192</button>
      </div>
    `;
      p.querySelectorAll(".industry-card").forEach((el) => {
        el.addEventListener("click", () => {
          session.answers.industry = el.dataset.industry;
          renderScope();
        });
      });
      p.querySelectorAll(".region-chip, .region-global-standalone").forEach((el) => {
        el.addEventListener("click", () => {
          const rid = el.dataset.region;
          session.answers.regions = session.answers.regions || [];
          const i = session.answers.regions.indexOf(rid);
          if (i >= 0) session.answers.regions.splice(i, 1);
          else session.answers.regions.push(rid);
          renderScope();
        });
      });
      p.querySelectorAll("input[data-country]").forEach((el) => {
        el.addEventListener("change", () => {
          session.answers.countries = session.answers.countries || [];
          const c = el.dataset.country;
          const i = session.answers.countries.indexOf(c);
          if (el.checked && i < 0) session.answers.countries.push(c);
          else if (!el.checked && i >= 0) session.answers.countries.splice(i, 1);
        });
      });
      const otCheck = document.getElementById("otOverrideCheck");
      if (otCheck) {
        otCheck.addEventListener("change", () => {
          session.answers.otOverride = otCheck.checked;
          renderScope();
        });
      }
      const historyLinkEl = document.getElementById("historyLink");
      if (historyLinkEl) historyLinkEl.addEventListener("click", () => goToTab2("history"));
      p.querySelectorAll(".acc-head").forEach((el) => {
        el.addEventListener("click", (e) => {
          if (e.target.closest(".fw-card")) return;
          el.parentElement.classList.toggle("open");
        });
      });
      p.querySelectorAll(".fw-card").forEach((el) => {
        el.addEventListener("click", () => {
          const id = el.dataset.fw;
          session.answers[id] = !session.answers[id];
          renderScope();
          updateSerial();
        });
      });
      document.getElementById("scopeNext").addEventListener("click", () => {
        updateSerial();
        const idx = firstVisibleScreenIndex();
        if (idx >= PROFILE_SCREENS.length) {
          ui.phase = "wizard";
          ui.categoryIndex = 0;
          renderRail();
          renderAssessmentCategory();
        } else {
          ui.phase = "profile";
          ui.screenIndex = idx;
          renderRail();
          renderProfileScreen();
        }
      });
    }
    function fieldHtml(node) {
      const val = session.answers[node.id] ?? "";
      if (node.type === "info") return `<div class="info-box">${node.text}</div>`;
      if (node.type === "select") {
        return `
        <div class="field">
          <label>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</label>
          <select data-fid="${node.id}">
            <option value="" ${val === "" ? "selected" : ""} disabled>Select\u2026</option>
            ${node.options.map((o) => `<option value="${o}" ${val === o ? "selected" : ""}>${o}</option>`).join("")}
          </select>
        </div>`;
      }
      if (node.type === "multiselect") {
        const selected = Array.isArray(val) ? val : [];
        return `
        <div class="field">
          <label>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</label>
          <div class="checkbox-group" data-fid="${node.id}">
            ${node.options.map(
          (o) => `
              <label class="checkbox-option ${selected.includes(o.id) ? "selected" : ""}">
                <input type="checkbox" data-optid="${o.id}" ${selected.includes(o.id) ? "checked" : ""}> ${o.label}
              </label>
            `
        ).join("")}
          </div>
        </div>`;
      }
      if (node.type === "vendor") {
        const isOther = session.answers[node.id + "__isOther"] || val !== "" && !node.vendorOptions.includes(val);
        return `
        <div class="field">
          <label>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</label>
          <select data-vendor-fid="${node.id}">
            <option value="" ${val === "" && !isOther ? "selected" : ""} disabled>Select\u2026</option>
            ${node.vendorOptions.map((v) => `<option value="${v}" ${!isOther && val === v ? "selected" : ""}>${v}</option>`).join("")}
            <option value="${OTHER}" ${isOther ? "selected" : ""}>Other</option>
          </select>
          ${isOther ? `<input type="text" data-vendor-other-fid="${node.id}" value="${!node.vendorOptions.includes(val) ? val : ""}" placeholder="Please specify">` : ""}
        </div>`;
      }
      return `
      <div class="field">
        <label>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</label>
        <input type="text" data-fid="${node.id}" value="${val}" placeholder="${node.placeholder || ""}">
      </div>`;
    }
    function screenComplete(screen) {
      return visibleNodes(screen.flow, session).every((n) => !n.required || session.answers[n.id] !== void 0 && session.answers[n.id] !== "" && !(Array.isArray(session.answers[n.id]) && session.answers[n.id].length === 0));
    }
    function renderProfileScreen() {
      const screen = PROFILE_SCREENS[ui.screenIndex];
      const p = panel();
      const nodes = visibleNodes(screen.flow, session);
      const isLastVisible = nextVisibleScreenIndex(ui.screenIndex) >= PROFILE_SCREENS.length;
      p.innerHTML = `
      <div class="step-eyebrow">Pre-Assessment</div>
      <h2 class="step-title">${screen.title}</h2>
      <p class="step-sub">${screen.sub}</p>
      ${nodes.map(fieldHtml).join("")}
      <div class="nav">
        <button id="backBtn">\u2190 Back</button>
        <button id="saveProgressBtn">Save progress \u2193</button>
        <button class="primary" id="nextBtn" ${screenComplete(screen) ? "" : "disabled"}>${isLastVisible ? "Continue to assessment \u2192" : "Continue \u2192"}</button>
      </div>
    `;
      document.getElementById("saveProgressBtn").addEventListener("click", () => exportProgressJson2(null));
      function refreshNext() {
        document.getElementById("nextBtn").disabled = !screenComplete(screen);
      }
      p.querySelectorAll("select[data-fid]").forEach((el) => {
        el.addEventListener("change", () => {
          const node = screen.flow.index.get(el.dataset.fid);
          recordAnswer(session, node, el.value);
          renderProfileScreen();
        });
      });
      p.querySelectorAll("input[type=text][data-fid]").forEach((el) => {
        el.addEventListener("input", () => {
          const node = screen.flow.index.get(el.dataset.fid);
          recordAnswer(session, node, el.value);
          refreshNext();
        });
      });
      p.querySelectorAll("select[data-vendor-fid]").forEach((el) => {
        el.addEventListener("change", () => {
          const node = screen.flow.index.get(el.dataset.vendorFid);
          if (el.value === OTHER) {
            session.answers[node.id + "__isOther"] = true;
            recordAnswer(session, node, "");
          } else {
            delete session.answers[node.id + "__isOther"];
            recordAnswer(session, node, el.value);
          }
          renderProfileScreen();
        });
      });
      p.querySelectorAll("input[data-vendor-other-fid]").forEach((el) => {
        el.addEventListener("input", () => {
          const node = screen.flow.index.get(el.dataset.vendorOtherFid);
          recordAnswer(session, node, el.value);
          refreshNext();
        });
      });
      p.querySelectorAll(".checkbox-group[data-fid]").forEach((groupEl) => {
        groupEl.querySelectorAll("input[data-optid]").forEach((cb) => {
          cb.addEventListener("change", () => {
            const node = screen.flow.index.get(groupEl.dataset.fid);
            const current = Array.isArray(session.answers[node.id]) ? [...session.answers[node.id]] : [];
            const optId = cb.dataset.optid;
            const i = current.indexOf(optId);
            if (cb.checked && i < 0) current.push(optId);
            else if (!cb.checked && i >= 0) current.splice(i, 1);
            recordAnswer(session, node, current);
            renderProfileScreen();
          });
        });
      });
      refreshNext();
      document.getElementById("nextBtn").addEventListener("click", () => {
        const nxt = nextVisibleScreenIndex(ui.screenIndex);
        if (nxt >= PROFILE_SCREENS.length) {
          ui.phase = "wizard";
          ui.categoryIndex = 0;
          renderRail();
          renderAssessmentCategory();
        } else {
          ui.screenIndex = nxt;
          renderRail();
          renderProfileScreen();
        }
      });
      document.getElementById("backBtn").addEventListener("click", () => {
        const prv = prevVisibleScreenIndex(ui.screenIndex);
        if (prv < 0) {
          ui.phase = "scope";
          renderRail();
          renderScope();
        } else {
          ui.screenIndex = prv;
          renderRail();
          renderProfileScreen();
        }
      });
    }
    function categoryQuestions(fn) {
      return visibleNodes(ASSESSMENT_FLOW, session).filter((q) => q.fn === fn);
    }
    function categoryAnswered(fn) {
      return categoryQuestions(fn).every((q) => session.answers[q.id] !== void 0);
    }
    function renderAssessmentCategory() {
      const fn = FUNCTIONS2[ui.categoryIndex];
      const p = panel();
      const qs = categoryQuestions(fn);
      p.innerHTML = `
      <div class="step-eyebrow">${FUNC_REF[fn]}</div>
      <h2 class="step-title">${FUNC_DISPLAY[fn]}</h2>
      <p class="step-sub"></p>
      ${qs.map(
        (q) => `
        <div class="question">
          <p>${q.text}${q.framework ? `<span class="q-badge">${FRAMEWORKS.find((f) => f.id === q.framework).name}</span>` : ""}</p>
          <div class="options">
            ${q.options.map(
          (o) => `
              <div class="option ${session.answers[q.id] === o.v ? "selected" : ""}" data-qid="${q.id}" data-val="${o.v}">
                <div class="radio"></div><div>${o.t}</div>
              </div>
            `
        ).join("")}
          </div>
        </div>
      `
      ).join("")}
      <div class="nav">
        <button id="backBtn">\u2190 Back</button>
        <button id="saveProgressBtn2">Save progress \u2193</button>
        <button class="primary" id="nextBtn" ${categoryAnswered(fn) ? "" : "disabled"}>${ui.categoryIndex === FUNCTIONS2.length - 1 ? "Generate reading" : "Continue \u2192"}</button>
      </div>
    `;
      document.getElementById("saveProgressBtn2").addEventListener("click", () => exportProgressJson2(null));
      p.querySelectorAll(".option").forEach((el) => {
        el.addEventListener("click", () => {
          const qid = el.dataset.qid;
          const node = ASSESSMENT_FLOW.index.get(qid);
          recordAnswer(session, node, Number(el.dataset.val));
          renderAssessmentCategory();
        });
      });
      document.getElementById("nextBtn").addEventListener("click", () => {
        if (ui.categoryIndex === FUNCTIONS2.length - 1) {
          ui.phase = "results";
          renderRail();
          renderResults();
        } else {
          ui.categoryIndex++;
          renderRail();
          renderAssessmentCategory();
        }
      });
      document.getElementById("backBtn").addEventListener("click", () => {
        if (ui.categoryIndex > 0) {
          ui.categoryIndex--;
          renderRail();
          renderAssessmentCategory();
        } else {
          const idx = lastVisibleScreenIndex();
          if (idx < 0) {
            ui.phase = "scope";
            renderRail();
            renderScope();
          } else {
            ui.phase = "profile";
            ui.screenIndex = idx;
            renderRail();
            renderProfileScreen();
          }
        }
      });
    }
    async function renderResults() {
      const p = panel();
      p.innerHTML = `<div class="step-eyebrow">Synthesis - all functions considered jointly</div><h2 class="step-title">Calculating your reading\u2026</h2>`;
      const funcScores = computeFuncScores(session);
      const overall = computeOverall(funcScores);
      const flags = computeFlags(session);
      const gapItems = computeGapItems(session);
      const priorities = computePriorities(session);
      const vendorNotes = matchedVendorNotes(session.answers);
      const frameworkRecs = computeFrameworkRecommendations(session);
      const currentGapTexts = gapItems.map((i) => i.gap);
      let prevRun = null, historyCount = 0;
      try {
        const lr = await storage.list("runs:", false);
        if (lr && lr.keys && lr.keys.length) {
          historyCount = lr.keys.length;
          const gets = await Promise.all(lr.keys.map((k) => storage.get(k, false).catch(() => null)));
          const runs = gets.filter(Boolean).map((g) => JSON.parse(g.value)).sort((a2, b) => a2.ts - b.ts);
          if (runs.length) prevRun = runs[runs.length - 1];
        }
      } catch (e) {
      }
      let resolvedSincePrev = [], newSincePrev = [];
      if (prevRun && prevRun.gapTexts) {
        resolvedSincePrev = prevRun.gapTexts.filter((g) => !currentGapTexts.includes(g));
        newSincePrev = currentGapTexts.filter((g) => !prevRun.gapTexts.includes(g));
      }
      const runRecord = { ts: Date.now(), overall, gapTexts: currentGapTexts, industry: session.answers.industry };
      try {
        await storage.set(`runs:${runRecord.ts}`, JSON.stringify(runRecord), false);
      } catch (e) {
      }
      const conic = (() => {
        const slice = 360 / funcScores.length;
        let acc = 0;
        const parts = funcScores.map((f) => {
          const start = acc;
          acc += slice;
          return `${FUNC_COLORS2[f.fn]} ${start}deg ${acc}deg`;
        });
        return `conic-gradient(${parts.join(",")})`;
      })();
      const delta = prevRun ? overall - prevRun.overall : null;
      p.innerHTML = `
      <div class="step-eyebrow">Synthesis - all functions considered jointly</div>
      <h2 class="step-title">Health Reading</h2>
      <p class="step-sub">Assessed against: NIST CSF 2.0 + CIS Controls v8${FRAMEWORKS.filter((f) => session.answers[f.id]).map((f) => " + " + f.name).join("")}${session.answers.industry ? " \xB7 " + INDUSTRIES.find((i) => i.id === session.answers.industry).label : ""}</p>

      ${prevRun ? `
      <div class="delta-box">
        <h3>Change since your last assessment (${new Date(prevRun.ts).toLocaleDateString()})</h3>
        <div class="delta-score ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : ""}${delta}% overall</div>
        ${resolvedSincePrev.length ? `<div class="delta-resolved"><b>Resolved:</b> ${resolvedSincePrev.length} item(s) closed since last time</div>` : ""}
        ${newSincePrev.length ? `<div class="delta-new"><b>New:</b> ${newSincePrev.length} item(s) newly flagged</div>` : ""}
      </div>` : ""}

      <div class="snapshot">
        <h3>Infrastructure snapshot (self-reported)</h3>
        ${snapshotRows(session.answers).map(([k, v]) => `<div class="snapshot-row"><div class="skey">${k}</div><div>${v}</div></div>`).join("")}
      </div>

      <div class="gauge-row">
        <div class="gauge" style="background:${conic}">
          <div class="gauge-inner">
            <div class="pct">${overall}%</div>
            <div class="verdict">${verdictLabel(overall)}</div>
          </div>
        </div>
        <div class="func-bars">
          ${funcScores.map(
        (f) => `
            <div class="func-bar-row">
              <div class="fname">${FUNC_DISPLAY[f.fn]}</div>
              <div class="func-bar-track"><div class="func-bar-fill" style="width:${f.pct}%; background:${FUNC_COLORS2[f.fn]}"></div></div>
              <div class="fpct">${f.pct}%</div>
            </div>
          `
      ).join("")}
        </div>
      </div>

      ${flags.length ? `
      <div class="flags">
        <h3>Compounding risk - patterns across steps</h3>
        ${flags.map((f) => `<div class="flag-item"><b>Combined finding -</b> ${f}</div>`).join("")}
      </div>` : ""}

      ${vendorNotes.length ? `
      <div class="flags">
        <h3>Vendor-specific mitigation notes</h3>
        ${vendorNotes.map((v) => `<div class="vendor-note-item"><b>${v.vendor} -</b> ${v.note}</div>`).join("")}
        <p class="scope-hint">Illustrative, based on well-documented historical exploitation patterns for named products - not a live feed. This tool intentionally doesn't do vulnerability scanning; treat this as a prompt to check current vendor advisories for your exact version, not a substitute for doing so.</p>
      </div>` : ""}

      ${frameworkRecs.length ? `
      <div class="flags">
        <h3>Compliance considerations</h3>
        ${frameworkRecs.map(
        (r) => `
          <div class="vendor-note-item">
            <b>${r.name} -</b> ${r.summary}
            ${r.gaps.length ? `<div class="fw-gap-list">${r.gaps.map((g) => `<div class="fw-gap-item">Gap: <i>${g.question}</i> - currently: "${g.chosen}"</div>`).join("")}</div>` : r.questionCount ? `<div class="fw-gap-list"><div class="fw-gap-item">No gaps flagged in the ${r.name}-specific questions above.</div></div>` : ""}
          </div>
        `
      ).join("")}
        <p class="scope-hint">This is pattern-based guidance from your own answers, not a certification audit or legal compliance determination.</p>
      </div>` : ""}

      <div class="priorities">
        <h3>Where to act first, ranked</h3>
        ${priorities.map(
        (p2, i) => `
          <div class="priority-item">
            <div class="priority-rank">${String(i + 1).padStart(2, "0")}</div>
            <div><b>${FUNC_DISPLAY[p2.fn]}:</b> ${p2.gap}</div>
          </div>
        `
      ).join("")}
      </div>

      <div class="note-box">
        <b>Prototype note -</b> the flags and priority list above are produced by a rules engine for this demo.
        In the live version, this panel is where the Claude API call plugs in: it receives the full answer set
        plus retrieved remediation content from the knowledge base, and writes the actual narrative report.
        The vendor/product fields in the snapshot above (EDR, email security, SD-WAN, hosting/web stack) are
        exactly what a live lookup would key off - and that lookup is designed to check sources in a specific
        order: the vendor's own official website or security-advisories page first, then CISA's KEV catalog and
        NVD, rather than a generic web search. What's shown here is illustrative pattern-matching for named
        vendors, not a live fetch, but it's built to reflect that same source priority.
        <br><br>
        This run was just saved using Claude's artifact storage (private to your account) - that's what powers
        the history/delta view above. That storage is specific to this Claude environment; the production
        deployment needs a real database (e.g., Supabase) doing the same job.
      </div>

      <div class="nav">
        <button id="backBtn2">\u2190 Review answers</button>
        <button id="exportJsonBtn">Export as JSON \u2193</button>
        <button id="viewHistoryBtn">View history (${historyCount + 1}) \u2192</button>
      </div>
    `;
      document.getElementById("backBtn2").addEventListener("click", () => {
        ui.phase = "wizard";
        ui.categoryIndex = FUNCTIONS2.length - 1;
        renderRail();
        renderAssessmentCategory();
      });
      document.getElementById("viewHistoryBtn").addEventListener("click", () => goToTab2("history"));
      document.getElementById("exportJsonBtn").addEventListener("click", () => exportProgressJson2(overall));
    }
    function loadExport(data) {
      Object.keys(session.answers).forEach((k) => delete session.answers[k]);
      Object.assign(session.answers, data.scope || {}, data.answers || {});
      if (!Array.isArray(session.answers.regions)) session.answers.regions = [];
      session.asked = [];
      session.dedupe = {};
      ui.phase = "scope";
      ui.screenIndex = 0;
      ui.categoryIndex = 0;
    }
    return {
      get phase() {
        return ui.phase;
      },
      session,
      loadExport,
      renderRail,
      renderScope,
      renderProfileScreen,
      renderAssessmentCategory,
      renderResults,
      // entry point used by renderActiveTab() when switching into the assessment tab
      renderCurrentPhase() {
        updateSerial();
        renderRail();
        if (ui.phase === "scope") renderScope();
        else if (ui.phase === "profile") renderProfileScreen();
        else if (ui.phase === "wizard") renderAssessmentCategory();
        else renderResults();
      }
    };
  }

  // src/main.js
  var assessmentController = createAssessmentController({
    getPanel: () => document.getElementById("panel"),
    getRail: () => document.getElementById("rail"),
    icon: (name) => icon(name),
    goToTab: (id, anchor) => goToTab(id, anchor),
    // Forward at call time (not a captured reference) - matches the original
    // code's pattern of always reading window.storage fresh, since it's a
    // host-provided API that may not exist yet at module-init time (see the
    // try/catch around every call site: it's absent entirely on a real
    // Netlify deploy today, and only present inside a Claude.ai artifact
    // preview - see §7 of CLAUDE.md for the real-database replacement plan).
    storage: {
      get: (...args) => window.storage.get(...args),
      set: (...args) => window.storage.set(...args),
      list: (...args) => window.storage.list(...args),
      delete: (...args) => window.storage.delete(...args)
    },
    exportProgressJson: (overall) => exportProgressJson(overall)
  });
  var activeTab = "home";
  var theme = "dark";
  var TOP_TABS = [
    { id: "home", label: "Home" },
    { id: "methodology", label: "Methodology" },
    { id: "maturity", label: "Maturity Model" },
    { id: "metrics", label: "Metrics" },
    { id: "news", label: "Trends & News" },
    { id: "assessment", label: "Assessment" }
  ];
  var HOME_DROPDOWN = [
    { id: "maturitymodel", label: "What is SimplifiedCS?" },
    { id: "coreprinciples", label: "Core Principles" },
    { id: "runbook", label: "Runbooks" },
    { id: "playbooks", label: "Playbooks" },
    { id: "casestudy", label: "Case Studies" },
    { id: "glossary", label: "Glossary" },
    { id: "history", label: "History" }
  ];
  var ASSESSMENT_DROPDOWN = [
    { id: "assessment", label: "Take Assessment" },
    { id: "transform", label: "Import Report" },
    { id: "history", label: "History" }
  ];
  var NEWS_ITEMS = [
    {
      date: "2026-08-01",
      cat: "vuln",
      catLabel: "Vulnerability",
      headline: "Chained SharePoint flaws enable full unauthenticated RCE",
      body: "Two vulnerabilities disclosed across Microsoft's June and July 2026 patches - an authentication bypass and a deserialization flaw - can be chained for unauthenticated remote code execution against on-prem SharePoint. Weeks after fixes shipped, researchers still found thousands of exposed servers unpatched.",
      source: "SecurityWeek / Rapid7"
    },
    {
      date: "2026-07-28",
      cat: "vuln",
      catLabel: "Vulnerability",
      headline: "Fastjson RCE exploited under default configuration",
      body: "A critical, actively-exploited flaw in the widely used Fastjson Java library allows unauthenticated remote code execution with no special configuration required, affecting deployments still on the unsupported 1.x branch.",
      source: "SecurityWeek"
    },
    {
      date: "2026-07-26",
      cat: "vuln",
      catLabel: "Vulnerability",
      headline: "Critical Rails flaw forces early public disclosure",
      body: "A flaw in Ruby on Rails' Active Storage component allowed unauthenticated file reads capable of exposing an application's master cryptographic key. Public proof-of-concept exploits appeared so quickly that maintainers published full details and forensic tooling ahead of schedule.",
      source: "BleepingComputer / Akamai"
    },
    {
      date: "2026-06-25",
      cat: "ot",
      catLabel: "OT / Industrial",
      headline: "Actively-exploited PLM platform flaw added to CISA's KEV catalog",
      body: "An unauthenticated RCE vulnerability in PTC Windchill and FlexPLM - platforms widely used in engineering and manufacturing - is being actively exploited to plant web shells and gain footholds inside industrial and supply-chain environments. A reminder that OT-adjacent platforms, not just classic ICS/SCADA gear, are squarely in scope for real attacks.",
      source: "CISA KEV / Field Effect"
    },
    {
      date: "2026-06-11",
      cat: "ai",
      catLabel: "AI & Security",
      headline: "Agentic AI now rated the #1 cybersecurity concern for 2026",
      body: "A Dark Reading readership poll found 48% of security professionals now rank agentic AI and autonomous systems as the top attack vector for the year, ahead of ransomware and deepfakes. Separate research found most organizations that deployed AI agents had already had a related security incident - most often tied to over-permissioned agent credentials or prompt injection.",
      source: "Dark Reading / Darktrace State of AI Cybersecurity 2026"
    },
    {
      date: "2026-06-05",
      cat: "ai",
      catLabel: "AI & Security",
      headline: "Anthropic discloses a large-scale, AI-orchestrated espionage campaign",
      body: 'Anthropic reported detecting and disrupting a campaign in which a threat actor used Claude Code to automate significant portions of an attack against roughly 30 organizations - a concrete, disclosed example of the "AI agent as attacker" pattern security teams have been warning about.',
      source: "Anthropic disclosure"
    },
    {
      date: "2026-07-30",
      cat: "ai",
      catLabel: "AI & Security",
      headline: 'Microsoft unveils multi-agent "Project Perception" for security operations',
      body: "Rather than a single AI assistant, Microsoft's new platform coordinates specialized Red Team, Blue Team, and Green Team AI agents that collaborate to discover vulnerabilities, investigate threats, validate defenses, and recommend remediation - a real-world example of the same multi-agent pattern behind this site's own synthesis design.",
      source: "Microsoft / industry coverage"
    },
    {
      date: "2026-03-09",
      cat: "landscape",
      catLabel: "Threat Landscape",
      headline: "Supply-chain attacks and public-facing app exploits both surge",
      body: "IBM's X-Force team recorded a 44% year-over-year rise in exploitation of public-facing applications, and found major supply-chain and third-party breaches have quadrupled over five years. Incidents like the Salesloft/Drift OAuth token compromise show how one trusted-vendor breach cascades into many downstream customer environments.",
      source: "IBM X-Force Threat Intelligence Index 2026"
    },
    {
      date: "2026-03-23",
      cat: "landscape",
      catLabel: "Threat Landscape",
      headline: "Breach costs diverge sharply by region",
      body: "Global average breach costs fell to $4.44M in IBM's latest Cost of a Data Breach report, credited to wider AI/automation adoption in detection and containment - but U.S. breach costs bucked the trend, rising 9% to $10.22M, the highest of any region measured.",
      source: "IBM Cost of a Data Breach Report"
    }
  ];
  var newsFilter = "all";
  function icon(name) {
    const common = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
    const icons = {
      shield: `<svg ${common}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 8v4"/><circle cx="12" cy="15" r="0.6" fill="currentColor"/></svg>`,
      backup: `<svg ${common}><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/><path d="M18.5 9.5a3 3 0 1 1-1-2.3" transform="translate(0,-1)"/></svg>`,
      document: `<svg ${common}><path d="M7 2.5h7l3.5 3.5V21H7z"/><path d="M14 2.5V6h3.5"/><path d="M9.3 12h5.4M9.3 15h5.4M9.3 18h3.4"/></svg>`,
      register: `<svg ${common}><rect x="3.5" y="4" width="17" height="16" rx="1"/><path d="M3.5 9h17M3.5 14h17M9 4v16"/></svg>`,
      ransomware: `<svg ${common}><rect x="6" y="10.5" width="12" height="9" rx="1.2"/><path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5"/><path d="M12 14v2.4"/><path d="M4 4l16 16" opacity="0.55"/></svg>`,
      phishing: `<svg ${common}><rect x="3.2" y="6" width="17.6" height="12.5" rx="1.2"/><path d="M3.2 7l8.8 6 8.8-6"/><path d="M15.5 15.5c2-1.6 2-4 .3-5.3" opacity="0.7"/></svg>`,
      ddos: `<svg ${common}><rect x="8.5" y="9" width="7" height="7" rx="1"/><path d="M12 9V4M12 20v-5M5 12H2M22 12h-3M6.5 6.5 4.5 4.5M17.5 6.5l2-2M6.5 17.5l-2 2M17.5 17.5l2 2"/></svg>`,
      lateral: `<svg ${common}><circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M6.8 7.6 10.3 16.2M17.2 7.6 13.7 16.2" stroke-dasharray="3 2.5"/></svg>`,
      cycle: `<svg ${common}><path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2"/><path d="M18.5 4v3.2H15.3M5.5 20v-3.2H8.7"/></svg>`,
      key: `<svg ${common}><circle cx="8" cy="8.5" r="4"/><path d="M11 11.5l9 9M15.5 16l2.5-2.5M18 18.5l2.5-2.5"/></svg>`,
      link: `<svg ${common}><circle cx="9.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/></svg>`,
      people: `<svg ${common}><circle cx="8.5" cy="8" r="3"/><path d="M3 19c0-3.3 2.5-5.5 5.5-5.5S14 15.7 14 19"/><circle cx="16.5" cy="9" r="2.4"/><path d="M14.8 19c0-2.6 1.8-4.4 3.9-4.4"/></svg>`,
      cloud: `<svg ${common}><path d="M7 17a4 4 0 0 1 .3-8 5.5 5.5 0 0 1 10.6 1.8A3.5 3.5 0 0 1 17 17z"/><path d="M12 20v-3M10 19l2-2 2 2" opacity="0.75"/></svg>`,
      exfil: `<svg ${common}><path d="M7 2.5h7l3.5 3.5V21H7z"/><path d="M14 2.5V6h3.5"/><path d="M9.5 15l4.5-4.5M10 10.5h4.5V15" opacity="0.85"/></svg>`,
      urgent: `<svg ${common}><path d="M12 3l9 15.5H3z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor"/></svg>`,
      route: `<svg ${common}><path d="M5 21V3"/><path d="M5 4.5c3-2 5 2 8 0s5 2 8 0v9c-3 2-5-2-8 0s-5-2-8 0"/></svg>`,
      signal: `<svg ${common}><path d="M12 19.3v.01"/><path d="M8.2 15.8a5.2 5.2 0 0 1 7.6 0"/><path d="M5 12.3a9.2 9.2 0 0 1 14 0"/></svg>`,
      checklist: `<svg ${common}><rect x="6" y="4" width="12" height="17" rx="1.4"/><rect x="9" y="2.3" width="6" height="3" rx="1"/><path d="M9 12l1.8 1.8L15 10" /></svg>`,
      clock: `<svg ${common}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2.3h6M12 2.3V5"/></svg>`,
      sun: `<svg ${common}><circle cx="12" cy="12" r="4.3"/><path d="M12 3v2.3M12 18.7V21M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M3 12h2.3M18.7 12H21M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>`,
      moon: `<svg ${common}><path d="M20 14.2A8 8 0 1 1 9.8 4a6.4 6.4 0 0 0 10.2 10.2z"/></svg>`,
      external: `<svg ${common}><path d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/><path d="M14 4h6v6"/><path d="M20 4 11 13"/></svg>`,
      arrowright: `<svg ${common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
      "hiw-clipboard": `<svg ${common}><rect x="6" y="4" width="12" height="17" rx="1.5"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M8.5 11l2 2 4-4.5"/><path d="M8.5 16.5h5.5"/></svg>`,
      "hiw-magnify": `<svg ${common}><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/><path d="M7.5 10.5h6M10.5 7.5v6"/></svg>`,
      "hiw-lightbulb": `<svg ${common}><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.7v.5h6v-.5c0-.7.3-1.3.8-1.7A6.5 6.5 0 0 0 12 3z"/></svg>`,
      "hiw-transform": `<svg ${common}><path d="M4 14a8 8 0 0 1 14-5.2"/><path d="M17 4v3.2h-3.2"/><path d="M20 10a8 8 0 0 1-14 5.2"/><path d="M7 20v-3.2h3.2"/></svg>`
    };
    return icons[name] || "";
  }
  var RISK_SCORE_DESCRIPTIONS = {
    1: "Minimal risk. Controls are comprehensive, tested, and continuously monitored across every function. This is an aspirational benchmark, not a typical starting point for most organizations.",
    2: "Very low risk. A strong baseline across most functions, with only minor, well-understood gaps that are already being tracked.",
    3: "Low risk. Core protections are in place and working; a few specific areas need attention, but nothing systemic.",
    4: "Low-to-moderate risk. Foundational controls exist, but consistency and testing vary across the organization - some areas are solid, others untested.",
    5: "Moderate risk. A genuine mix of solid and weak areas - the kind of profile where a single overlooked gap is enough to be exploited.",
    6: "Moderate-to-elevated risk. Multiple functions show real gaps at once; an opportunistic attacker would likely find a way in without much effort.",
    7: "Elevated risk. Significant gaps across several NIST functions, especially around detection and response - incidents would likely go unnoticed for a while.",
    8: "High risk. Fundamental controls are missing or inconsistently applied. A breach isn't really a question of if, but when.",
    9: "Very high risk. Minimal effective defenses in place - the organization would likely not detect an active compromise on its own.",
    10: "Severe risk. Essentially an unmanaged security posture. Every function needs immediate, foundational work, starting with visibility into what even exists."
  };
  var STAGE_DETAIL = {
    discovery: {
      summary: "The data-collection phase - your adaptive questionnaire across all six NIST CSF functions (Govern, Identify, Protect, Detect, Respond, Recover), shaped by your industry, region, and infrastructure so you only answer what actually applies.",
      metrics: "Every answer scores 0, 1, or 2 depending on the option chosen. A function's score is the sum of its answers divided by the maximum possible, as a percentage."
    },
    transformation: {
      summary: "Where raw answers become an actual risk read, not just a total - every answer is cross-checked against every other answer for known dangerous combinations, then ranked into a priority action list.",
      metrics: "Compounding-risk flags are computed separately from the percentage score - two individually moderate gaps that combine into something materially worse each get surfaced as their own finding."
    },
    optimization: {
      summary: "Re-running the assessment on a cadence to measure real change - which findings were resolved, which are newly flagged, and how the overall score has moved since the last run.",
      metrics: "History tracks a score delta between assessments, plus a resolved-vs-new breakdown per finding, so improvement is measured against your own baseline, not an abstract target."
    }
  };
  var STAGE_META = {
    discovery: {
      label: "Discovery",
      range: "Phases 1\u20134",
      color: "var(--accent-signal)",
      blurb: "You don't have a security program yet so much as a starting point - the goal is visibility: what exists, where it's exposed, and who owns fixing it."
    },
    transformation: {
      label: "Transformation",
      range: "Phases 5\u20137",
      color: "var(--accent-secure)",
      blurb: "Findings become controls, and controls become documented, rehearsed processes - this is where most of the actual engineering and writing happens."
    },
    optimization: {
      label: "Optimization",
      range: "Phases 8\u201310",
      color: "var(--accent-violet)",
      blurb: 'The program runs continuously - monitored, tested, and adjusted as the environment and threat landscape change, rather than declared "done."'
    }
  };
  var PHASES = [
    {
      num: 1,
      stage: "discovery",
      title: "Asset & Data Discovery",
      desc: "Inventory hardware, software, cloud resources, and data stores - including shadow IT. You can't protect what you don't know exists, and this is where most real gaps first surface.",
      monitor: "Tracked via a living asset inventory, reviewed whenever new systems, cloud resources, or vendors are added - not just annually.",
      evolve: "Once assets are known, Phase 2 can map real exposure instead of guessing at it."
    },
    {
      num: 2,
      stage: "discovery",
      title: "Attack Surface Mapping",
      desc: "Identify every external-facing entry point - websites, APIs, VPNs, remote access, third-party integrations - and understand how an attacker would actually get in.",
      monitor: "Re-checked whenever external-facing infrastructure changes - new domains, new APIs, new remote-access points.",
      evolve: "A mapped surface is what makes Phase 4's gap analysis meaningful rather than generic."
    },
    {
      num: 3,
      stage: "discovery",
      title: "Governance & Ownership Baseline",
      desc: "Assign real accountability for security decisions before writing a single control. Without an owner, findings from every later phase just accumulate unactioned.",
      monitor: "Verified through named accountability - can you point to the specific person who owns a given control?",
      evolve: "Without an owner, nothing found in later phases gets actioned - this single phase unlocks every one after it."
    },
    {
      num: 4,
      stage: "discovery",
      title: "Gap Analysis & Prioritization",
      desc: "Compare current state against a recognized framework (NIST CSF, CIS Controls) and rank gaps by risk - this is the exact function this site's Assessment tab performs.",
      monitor: "This is literally what the Assessment tab re-measures every time you run it - your score IS this phase's monitoring signal.",
      evolve: "Turns raw findings into an ordered backlog, which is what Phase 5 actually executes against."
    },
    {
      num: 5,
      stage: "transformation",
      title: "Control Implementation",
      desc: "Roll out the prioritized technical controls - MFA, EDR, network segmentation, email authentication, backup isolation - turning the roadmap into deployed defenses.",
      monitor: "Tracked as percentage of the Phase 4 backlog actually deployed, not just planned or ticketed.",
      evolve: "Each control closed here is a specific finding that disappears from your next Assessment run."
    },
    {
      num: 6,
      stage: "transformation",
      title: "Policy & Documentation",
      desc: "Formalize the program in writing: security policy, incident response plan, backup/DR plan, risk register. See the Runbooks tab for what each of these should actually contain.",
      monitor: "Reviewed on the cadence the policy itself states - typically annually, or after any material infrastructure change.",
      evolve: "Turns implemented controls into an auditable, teachable program instead of tribal knowledge that leaves when one person does."
    },
    {
      num: 7,
      stage: "transformation",
      title: "Response Readiness & Testing",
      desc: "Rehearse the plans, don't just file them - tabletop exercises, restore drills from backup, and walkthroughs of the ransomware/phishing/DDoS runbooks before a real incident forces it.",
      monitor: "Measured by whether tabletop exercises and restore drills actually happened, not whether a plan merely exists on paper.",
      evolve: "The last step before a program is operational rather than aspirational - directly supported by the Runbooks tab."
    },
    {
      num: 8,
      stage: "optimization",
      title: "Continuous Monitoring & Tuning",
      desc: "Operationalize logging and detection, and tune it against real telemetry - an alert nobody trusts because of noise is functionally the same as no alert.",
      monitor: "Tracked via alert precision over time - false-positive rate trending down, not just alert volume trending up.",
      evolve: "Reliable detection is the precondition for Phase 9's audits meaning anything at all."
    },
    {
      num: 9,
      stage: "optimization",
      title: "Auditing & Validation",
      desc: "Vulnerability scans, penetration tests, and control audits confirm defenses work as intended rather than just existing on paper - this is also where compliance audits (ISO 27001, SOC 2) fit in.",
      monitor: "Tracked via time-to-remediate findings from scans, pen tests, and compliance audits - not merely whether audits happened.",
      evolve: "Confirms which Phase 5 controls are actually working versus just installed and forgotten."
    },
    {
      num: 10,
      stage: "optimization",
      title: "Adaptive Iteration",
      desc: "Feed lessons from incidents, audits, and a changing threat landscape back into the program - and back into Phase 4's gap analysis, since this loop never really ends.",
      monitor: "Tracked by whether lessons from real incidents and audits visibly change next quarter's priorities.",
      evolve: "Feeds directly back into Phase 4 - the phase that makes the other nine a cycle instead of a one-time checklist."
    }
  ];
  var SCORE_RUBRIC = [
    {
      range: "0 \u2013 1.5",
      verdict: "Critical",
      good: "Rare - if anything scores here, it's usually one isolated function (often Recover) while everything else is failing too.",
      bad: "Core controls are absent, not just weak - no MFA, no logging, no incident response plan, often no named security owner at all. This reflects total absence, not partial effort.",
      why: "Every question in the affected function was likely answered at its lowest option - this isn't measurement noise, it's an accurate reflection of nothing being in place yet.",
      priority: "Start at Maturity Model Phase 1 - asset discovery. Nothing later matters until you know what you're protecting."
    },
    {
      range: "1.5 \u2013 3.5",
      verdict: "Elevated (severe)",
      good: "Usually one or two functions (often Identify or Recover) have partial coverage - an asset list exists, or backups happen even if untested.",
      bad: "Protect and Detect are typically the weakest here - MFA partial at best, no centralized logging, meaning an intrusion would likely go unnoticed for a long time.",
      why: 'A handful of "Partial" answers pull the average up slightly off zero, but the functions that stop real attacks are still mostly unanswered at their lowest tier.',
      priority: "Close the highest-severity items in the Priority list first - this band is where compounding-risk flags (like exposed RDP plus weak backups) are most common and most dangerous."
    },
    {
      range: "3.5 \u2013 5",
      verdict: "Elevated",
      good: "Baseline hygiene exists - patching happens, some endpoint protection is deployed - but inconsistently applied across the organization.",
      bad: "Governance is usually the gap here - controls exist without policy backing them, so they aren't sustained once the person who set them up moves on.",
      why: 'Individual controls score "Partial" across the board rather than a mix of strong and absent - the org is doing things, just not consistently or on paper.',
      priority: "Move into Maturity Model Phase 3 (Governance) and Phase 6 (Policy & Documentation) - enough is in place that formalizing it will lock in real gains."
    },
    {
      range: "5 \u2013 7",
      verdict: "Moderate",
      good: "This is usually where MFA is enforced, backups are tested at least occasionally, and a written security policy exists - real, working fundamentals, not just intentions.",
      bad: "Response readiness is the most common weak point in this band - plans exist on paper (Respond/Recover score fine) but haven't been rehearsed, and detection tends to be reactive rather than proactive.",
      why: `Most functions individually look "fine" (Partial-to-Yes answers throughout), but nothing has been tested end-to-end - the score reflects presence of controls, not proof they'd hold up under a real incident.`,
      priority: "Maturity Model Phase 7 - Response Readiness & Testing - is where this band gets stuck without deliberate rehearsal (tabletop exercises, restore drills)."
    },
    {
      range: "7 \u2013 8.5",
      verdict: "Strong (developing)",
      good: "Controls are implemented and tested - this is typically an org that's been through at least one real incident or a serious tabletop exercise.",
      bad: "Monitoring/tuning is the usual gap - alerting exists but hasn't been tuned enough to avoid noise, or audits happen but findings aren't tracked to closure.",
      why: "Almost every question scores at or near its top option, with only Detect/Optimization-related items pulling the average down slightly.",
      priority: "Maturity Model Phase 8\u20139 - Continuous Monitoring and Auditing - is where this band should focus, since the foundational work is already done."
    },
    {
      range: "8.5 \u2013 10",
      verdict: "Strong",
      good: "Full coverage across all six functions, tested and audited, with a demonstrated feedback loop from past incidents and audits into current priorities.",
      bad: "Even here, the compounding-risk flags still matter - a single overlooked combination (like a new vendor integration nobody reviewed) can create real exposure that a per-function score alone wouldn't catch.",
      why: "Consistently top-tier answers across every function - this band is earned, not assumed, and should be re-verified every assessment cycle rather than taken for granted.",
      priority: "Maturity Model Phase 10 - Adaptive Iteration. The job here is sustaining the loop, not finding new gaps."
    }
  ];
  var TRANSFORM_STEPS = [
    { n: 1, title: "Prioritize from your assessment", desc: "Start from the ranked Priority list on your latest results - highest severity first, not whatever's easiest.", phaseRef: "Maturity Model Phase 4" },
    { n: 2, title: "Assign ownership", desc: "Every item on that list needs a named person, not a team - an unowned finding is a finding nobody fixes.", phaseRef: "Maturity Model Phase 3" },
    { n: 3, title: "Implement the technical controls", desc: "MFA, EDR, network segmentation, email authentication - the specific gaps your assessment flagged, in order.", phaseRef: "Maturity Model Phase 5" },
    { n: 4, title: "Document it", desc: "Every control needs a policy behind it. See the Runbooks tab for exactly what each foundational document should contain.", phaseRef: "Maturity Model Phase 6" },
    { n: 5, title: "Rehearse, don't just file it", desc: "Tabletop exercises and backup-restore drills - a plan that's never been tested is a hypothesis, not a plan.", phaseRef: "Maturity Model Phase 7" },
    { n: 6, title: "Re-assess to confirm it worked", desc: "Run the Assessment again. This is how you prove the transformation happened instead of assuming it did.", phaseRef: "Maturity Model Phase 4, next cycle" }
  ];
  var FOUNDATIONAL_DOCS = [
    {
      id: "irplan",
      icon: "shield",
      title: "Incident Response Plan",
      points: [
        "Roles and a clear chain of command (who declares an incident, who leads response, who has final say to shut something down)",
        "Severity classification - not every incident needs the same response tier",
        "Communication plan: internal escalation, legal/regulatory notification obligations, and what (if anything) goes to customers or the public",
        "Evidence preservation steps, so forensic investigation isn't compromised by an eager cleanup",
        "A named post-incident review process - the plan should explicitly require updating itself after every real incident"
      ]
    },
    {
      id: "backupdr",
      icon: "backup",
      title: "Backup & Disaster Recovery Plan",
      points: [
        "Follow the 3-2-1 rule as a baseline: 3 copies of data, on 2 different media types, with 1 copy offline or immutable",
        "Define RTO (how fast you must be back up) and RPO (how much data loss is tolerable) per system - not every system needs the same targets",
        "Isolate backups from the production network so a ransomware event can't encrypt the recovery path along with everything else",
        "Test restores on a real schedule - a backup that has never been restored is a hypothesis, not a plan",
        "Document a failover/DR site or cloud region if uptime requirements demand it, and test that failover too"
      ]
    },
    {
      id: "policy",
      icon: "document",
      title: "Cybersecurity Policy Document",
      points: [
        "Scope: which systems, data, and people the policy governs",
        "Acceptable use, access control, and data classification rules stated plainly enough that non-security staff can follow them",
        "Named roles and responsibilities (ties directly to Phase 3 of the Maturity Model - governance has to exist before policy means anything)",
        "A mandatory review cadence - annually at minimum, and after any material change to infrastructure or the threat landscape"
      ]
    },
    {
      id: "riskreg",
      icon: "register",
      title: "Risk Register",
      points: [
        "One row per identified risk: description, likelihood, impact, and a calculated or assigned risk rating",
        "A named owner per risk - an unowned risk is a risk nobody is actually managing",
        "Treatment plan and status: accept, mitigate, transfer (insurance), or avoid - and what's actually being done about it",
        "A review date per entry, not just a review date for the whole register - old risks silently going stale is the most common failure mode"
      ]
    },
    {
      id: "bcp",
      icon: "cycle",
      title: "Business Continuity Plan",
      points: [
        "Distinct from the Backup/DR plan: this covers how the *business* keeps operating, not just how IT recovers systems",
        "Identify critical business functions and their maximum tolerable downtime - not every process is equally urgent",
        "Named alternate processes (manual workarounds, alternate suppliers, alternate premises) for when primary systems are unavailable",
        "A communication tree for staff, customers, and suppliers that doesn't depend on the systems that might be down",
        "Tested via exercises, not just written - a plan that has only ever been read is unproven"
      ]
    },
    {
      id: "iam",
      icon: "key",
      title: "Access Control / IAM Policy",
      points: [
        `Least-privilege as the default: access granted for a specific need, not by default "in case it's useful"`,
        "A defined joiner/mover/leaver process - access granted on day one and revoked the moment someone leaves or changes role",
        "Privileged/admin access kept separate from everyday accounts, with additional approval and logging requirements",
        "Periodic access reviews - confirming people still need what they were granted, not just granting once and forgetting"
      ]
    },
    {
      id: "vendor",
      icon: "link",
      title: "Third-Party / Vendor Risk Policy",
      points: [
        "A required security review before any vendor gets access to systems or data - not after the contract is signed",
        "Minimum security requirements scaled to what the vendor can actually touch (a payroll processor needs more scrutiny than a stock-photo subscription)",
        "A record of what each vendor can access, so a vendor breach (like the Salesloft/Drift incident referenced in the News tab) can be scoped quickly",
        "A defined offboarding step for vendors too - revoking access when a contract ends, not just for employees"
      ]
    },
    {
      id: "training",
      icon: "people",
      title: "Security Awareness Training Program",
      points: [
        "Recurring, not one-time - a single onboarding session is well-documented to fade within months",
        "Scenario-based content (real phishing simulations, not just slideshows) tends to change behavior more than lecture-style training",
        "Role-specific modules - finance staff need BEC/wire-fraud training that a warehouse employee doesn't, and vice versa",
        "Tracked completion and a non-punitive reporting culture - see the Phishing runbook for why blame reduces future self-reporting"
      ]
    }
  ];
  var RUNBOOKS = [
    {
      id: "ransomware",
      icon: "ransomware",
      title: "Ransomware",
      sub: "Encryption event / extortion attempt",
      steps: [
        "Isolate affected systems immediately - disconnect from the network rather than powering off, to preserve memory-resident evidence",
        "Activate the incident response team and determine scope: which systems, which data, and whether backups were touched",
        "Preserve evidence and logs before any cleanup begins; forensic timeline matters for both recovery and any legal/insurance process",
        "Notify legal counsel, cyber insurance, and regulators per your legal obligations - timing requirements vary by jurisdiction and sector",
        "Assess backup viability and restore from clean, verified-isolated backups rather than paying first and asking questions later",
        "Run a post-incident review and feed findings back into Phase 10 of the Maturity Model - the same gap that let this in will let the next one in too"
      ]
    },
    {
      id: "phishing",
      icon: "phishing",
      title: "Phishing / BEC",
      sub: "Credential compromise or business email compromise",
      steps: [
        "Have a one-click reporting mechanism for users - the first report is often the only warning before it spreads",
        "Quarantine the message organization-wide and block the sending domain/infrastructure where possible",
        "For any account that clicked through or entered credentials: force a password reset and revoke all active sessions immediately",
        "Check for lateral spread - mailbox rules, forwarding rules, or OAuth app grants the attacker may have added to maintain access",
        "Follow up with the affected user and team without blame - punitive responses reliably reduce future self-reporting"
      ]
    },
    {
      id: "ddos",
      icon: "ddos",
      title: "DDoS",
      sub: "Availability / denial-of-service attack",
      steps: [
        "Confirm it's actually an attack and not a legitimate traffic spike or an internal misconfiguration - the response differs completely",
        "Engage your upstream provider, CDN, or scrubbing service - most effective DDoS mitigation happens outside your own network edge",
        "Apply traffic filtering and rate-limiting rules for the specific attack pattern observed, not a generic block",
        "Keep stakeholders informed during the outage with a realistic status cadence - silence during an outage erodes trust faster than the outage itself",
        "After the fact, review whether current capacity and mitigation contracts are actually sized for the attack you just saw"
      ]
    },
    {
      id: "lateral",
      icon: "lateral",
      title: "Lateral Movement",
      sub: "Active intrusion spreading internally",
      steps: [
        "Segment or isolate the affected network segment to contain spread while investigation continues",
        "Rotate credentials for any accounts observed or suspected to be used by the intruder - assume more were touched than confirmed",
        "Use EDR to isolate affected endpoints individually rather than shutting down broad segments where avoidable, to preserve business continuity",
        "Threat-hunt for persistence mechanisms (scheduled tasks, new admin accounts, unfamiliar services) - the initial entry point is rarely the only foothold",
        "Maintain chain of custody on any forensic evidence gathered, in case of later legal, insurance, or regulatory review"
      ]
    },
    {
      id: "cloudcompromise",
      icon: "cloud",
      title: "Cloud Account Compromise",
      sub: "Compromised AWS/Azure/GCP credentials or console access",
      steps: [
        "Revoke or rotate the compromised credentials/API keys immediately, and invalidate active sessions and tokens",
        "Check for new IAM users, roles, or access keys the attacker may have created to maintain access after the original credential is fixed",
        "Review billing and resource-creation logs for unauthorized compute spun up for cryptomining or further attacks - a common monetization move",
        "Check for modified security groups, storage bucket permissions, or public exposure changes made during the intrusion window",
        "Preserve cloud provider audit logs (CloudTrail/Azure Activity Log/GCP Audit Logs) before any retention window expires"
      ]
    },
    {
      id: "insider",
      icon: "exfil",
      title: "Insider Threat / Data Exfiltration",
      sub: "Suspected internal actor or unusual data movement",
      steps: [
        "Involve HR and legal before taking action on a person, not just IT - this category carries employment and legal exposure others don't",
        "Preserve access logs, file activity, and DLP alerts immediately - behavior evidence degrades fast once someone knows they're suspected",
        "Restrict access proportionate to the evidence rather than immediately alerting the individual, to avoid destruction of evidence",
        "Review what data specifically was accessed or moved, and to where, to scope actual exposure rather than assuming worst case",
        "Close the loop afterward - most insider incidents trace back to an offboarding or access-review gap the Risk Register should already have flagged"
      ]
    },
    {
      id: "supplychain",
      icon: "link",
      title: "Supply Chain / Third-Party Compromise",
      sub: "A vendor or integration you depend on gets breached",
      steps: [
        "Identify exactly what that vendor could access - this is only fast if the Vendor Risk Policy's access record is actually kept current",
        "Revoke or rotate any credentials, API keys, or OAuth tokens shared with the affected vendor immediately, don't wait for their all-clear",
        "Check your own logs for activity from the vendor's integration during the suspected compromise window, not just take their word for scope",
        "Notify your own downstream customers if their data could have been exposed through the chain - the obligation doesn't stop at your vendor",
        "Reassess whether that vendor's access level was appropriate in the first place, and tighten it regardless of fault"
      ]
    },
    {
      id: "zeroday",
      icon: "urgent",
      title: "Zero-Day / Actively Exploited Vulnerability",
      sub: "A critical flaw in something you run is being exploited in the wild",
      steps: [
        "Check CISA's Known Exploited Vulnerabilities (KEV) catalog and vendor advisories immediately to confirm exploitation status and scope",
        "Apply the vendor patch as the primary fix - but if none exists yet, apply documented interim mitigations (disabling a feature, restricting network access) without waiting",
        "Inventory every instance of the affected product across the environment - partial patching (as seen in real incidents like the SharePoint RCE chain) leaves real exposure",
        "Hunt for indicators of prior compromise, not just patch and move on - actively-exploited flaws are often already used before a patch exists",
        "Track time-to-patch as a metric - this is exactly what Phase 9 (Auditing & Validation) of the Maturity Model should be measuring over time"
      ]
    }
  ];
  var GLOSSARY = [
    { term: "Air-gap", def: "Physically isolating a network or system so it has no connection to untrusted networks - common in OT/ICS environments." },
    { term: "Attack surface", def: "The total set of points where an attacker could try to enter or extract data from an environment." },
    { term: "BCP (Business Continuity Plan)", def: "A plan for keeping business operations running during a disruption - broader than IT disaster recovery, covering people and processes." },
    { term: "BEC (Business Email Compromise)", def: "Fraud where an attacker impersonates a trusted party over email to trigger a payment or data disclosure." },
    { term: "CIS Controls v8", def: "A prioritized set of defensive safeguards published by the Center for Internet Security, used here for question-level detail." },
    { term: "CISA KEV", def: "The U.S. Cybersecurity and Infrastructure Security Agency catalog of vulnerabilities confirmed to be actively exploited in the wild." },
    { term: "Compounding risk", def: "This site's term for two or more individually moderate gaps that combine into a materially worse risk than either alone." },
    { term: "Containerization", def: "Packaging an application with its dependencies into a portable, isolated unit (e.g. Docker) that runs consistently across environments." },
    { term: "CVE", def: "Common Vulnerabilities and Exposures - the standardized public identifier assigned to a specific known security flaw." },
    { term: "DDoS", def: "Distributed Denial of Service - flooding a system with traffic from many sources to make it unavailable to legitimate users." },
    { term: "DevSecOps", def: "Embedding security checks directly into software development and deployment pipelines rather than reviewing at the end." },
    { term: "DKIM", def: "DomainKeys Identified Mail - cryptographically signs outbound email so recipients can verify it genuinely came from your domain." },
    { term: "DLP", def: "Data Loss Prevention - tooling that detects and blocks sensitive data from leaving an organization improperly." },
    { term: "DMARC", def: "A policy layer built on SPF and DKIM telling receiving mail servers what to do with messages that fail authentication." },
    { term: "EDR", def: "Endpoint Detection & Response - software that monitors devices for malicious behavior and can isolate or remediate automatically." },
    { term: "Exfiltration", def: "Unauthorized transfer of data out of an organization, typically the final stage of a data breach." },
    { term: "Hardening", def: "Reducing a system's attack surface by disabling unnecessary services, tightening configuration, and applying secure defaults." },
    { term: "IAM", def: "Identity & Access Management - the policies and systems governing who can access what, and under what conditions." },
    { term: "Immutable backup", def: "A backup that cannot be altered or deleted for a set period, protecting recovery data from ransomware encryption." },
    { term: "Incident Response Plan", def: "A documented, rehearsed procedure defining roles, severity levels, communications, and steps taken during a security incident." },
    { term: "ISMS", def: "Information Security Management System - the documented, scoped, management-reviewed structure at the heart of ISO 27001." },
    { term: "ISO 27001", def: "An international standard for establishing and certifying an Information Security Management System." },
    { term: "Jump host", def: "A hardened, monitored intermediate server that administrators must pass through to reach sensitive systems." },
    { term: "KEV", def: "Known Exploited Vulnerability - a flaw with confirmed active exploitation, warranting faster remediation than severity score alone suggests." },
    { term: "Lateral movement", def: "An attacker progressing from an initially compromised system deeper into a network to reach higher-value targets." },
    { term: "Least privilege", def: "Granting each account only the minimum access needed for its role, rather than broad access by default." },
    { term: "Maturity tier", def: "A qualitative stage (Partial, Risk Informed, Repeatable, Adaptive) describing how deliberately an organization manages cyber risk." },
    { term: "MDR", def: "Managed Detection & Response - an outsourced service providing continuous monitoring, threat hunting, and incident response." },
    { term: "MFA", def: "Multi-factor authentication - requiring more than one independent proof of identity before granting access." },
    { term: "Microsegmentation", def: "Dividing a network into very granular zones so a compromise in one zone cannot reach others without passing controls." },
    { term: "MSP", def: "Managed Service Provider - an outsourced provider handling IT operations, sometimes including security functions." },
    { term: "NIS2", def: "An EU directive imposing cybersecurity risk-management and incident-notification duties on essential and important entities." },
    { term: "NIST CSF 2.0", def: "The NIST Cybersecurity Framework, organized around six functions: Govern, Identify, Protect, Detect, Respond, and Recover." },
    { term: "NVD", def: "National Vulnerability Database - the U.S. government repository of standardized vulnerability data and severity scoring." },
    { term: "OT / ICS", def: "Operational Technology / Industrial Control Systems - computing that controls physical processes, prioritizing safety and availability over confidentiality." },
    { term: "Penetration test", def: "An authorized simulated attack performed to validate whether defenses actually hold up in practice." },
    { term: "Phishing", def: "Deceptive messages designed to trick recipients into revealing credentials, opening malware, or authorizing fraudulent actions." },
    { term: "Prompt injection", def: "An attack against AI systems where malicious instructions hidden in content cause the model to act against its operator's intent." },
    { term: "Ransomware", def: "Malware that encrypts data, or threatens to leak it, and demands payment for restoration or silence." },
    { term: "RCE", def: "Remote Code Execution - a vulnerability class letting an attacker run arbitrary code on a system over a network." },
    { term: "Risk register", def: "A living record of identified risks with likelihood, impact, a named owner, treatment plan, and review date." },
    { term: "RPO", def: "Recovery Point Objective - the maximum amount of data loss, measured in time, that an organization can tolerate." },
    { term: "RTO", def: "Recovery Time Objective - the maximum acceptable time to restore a system after an outage." },
    { term: "SAST", def: "Static Application Security Testing - analyzing source code for security flaws before the application is run." },
    { term: "SCADA", def: "Supervisory Control and Data Acquisition - systems used to monitor and control industrial processes at scale." },
    { term: "SD-WAN", def: "Software-Defined Wide Area Network - centrally managed, software-controlled routing across distributed network sites." },
    { term: "Secrets management", def: "Storing and rotating credentials, API keys, and certificates in a dedicated vault rather than in code or config files." },
    { term: "Segmentation", def: "Dividing a network into isolated zones so that compromise of one area does not automatically grant access to others." },
    { term: "SIEM", def: "Security Information & Event Management - centralizes, correlates, and alerts on security logs across an environment." },
    { term: "SOC 2", def: "An audit standard covering security and related controls, frequently required by enterprise buyers of SaaS products." },
    { term: "SPF", def: "Sender Policy Framework - a DNS record declaring which mail servers are authorized to send email for your domain." },
    { term: "SQL injection", def: "Injecting malicious database commands through unvalidated application input, often to read or alter an entire database." },
    { term: "Supply chain attack", def: "Compromising a trusted vendor, library, or software update to reach that vendor's downstream customers." },
    { term: "Tabletop exercise", def: "A discussion-based rehearsal where a team walks through an incident scenario to test plans before a real event." },
    { term: "Threat actor", def: "An individual or group conducting malicious activity, ranging from criminal groups to state-sponsored operations." },
    { term: "Vulnerability scanning", def: "Automated checks against systems to identify known vulnerabilities and misconfigurations on a recurring basis." },
    { term: "Zero-day", def: "A vulnerability being exploited before a patch exists, or before defenders are aware of it." },
    { term: "Zero trust", def: "A model that never assumes trust based on network location, verifying every access request explicitly instead." },
    { term: "ZTNA", def: "Zero Trust Network Access - granting per-application access after verification, replacing broad VPN network access." }
  ];
  var REFERENCES = [
    { label: "NIST Cybersecurity Framework 2.0", href: "https://www.nist.gov/cyberframework", note: "Primary framework backbone for all six scored functions." },
    { label: "CIS Controls v8", href: "https://www.cisecurity.org/controls", note: "Source of question-level control granularity." },
    { label: "ISO/IEC 27001", href: "https://www.iso.org/standard/27001", note: "Optional compliance overlay for ISMS-related questions." },
    { label: "EU NIS2 Directive", href: "https://digital-strategy.ec.europa.eu/en/policies/nis2-directive", note: "Optional overlay covering EU incident-notification duties." },
    { label: "AICPA SOC 2", href: "https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2", note: "Optional overlay for vendor/SaaS audit readiness." },
    { label: "CISA Known Exploited Vulnerabilities Catalog", href: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", note: "Authoritative source for confirmed active exploitation." },
    { label: "National Vulnerability Database (NVD)", href: "https://nvd.nist.gov/", note: "Standardized vulnerability data and severity scoring." },
    { label: "IBM X-Force Threat Intelligence Index", href: null, note: "Cited for threat landscape statistics on the Trends & News tab." },
    { label: "IBM Cost of a Data Breach Report", href: null, note: "Cited for breach cost figures on the Trends & News tab." },
    { label: "Darktrace State of AI Cybersecurity", href: null, note: "Cited for AI-related threat findings on the Trends & News tab." },
    { label: "Case study sources", href: null, note: "Each incident on the Case Studies tab links to its own source individually." }
  ];
  var PLAYBOOK_SELECTION_CRITERIA = [
    "Inclusion in an established industry classification - OWASP Top 10:2021 for web applications, or the OWASP Top 10 for LLM Applications (2025) for AI-specific risk.",
    "Mappability to a MITRE ATT&CK tactic (or MITRE ATLAS tactic for AI-specific entries), so each playbook connects to a broader adversary-behavior model rather than standing alone.",
    "Real-world exploitation evidence, cross-referenced against CISA's KEV catalog and the incidents on this site's Case Studies tab.",
    "A mitigation achievable without a dedicated security engineering team - consistent with the rest of this site's intended audience."
  ];
  var OSINT_TOOLS = [
    { name: "Shodan", desc: "Indexes internet-connected devices and exposed services - used to understand what an organization's actual external attack surface looks like." },
    { name: "theHarvester", desc: "Aggregates public email addresses, subdomains, and employee names from search engines and public sources." },
    { name: "Maltego", desc: "Link-analysis tool for mapping relationships between infrastructure, domains, and organizations." },
    { name: "SpiderFoot", desc: "Automates OSINT collection across dozens of public data sources into a single reconnaissance report." },
    { name: "VirusTotal", desc: "Checks files, URLs, and indicators of compromise against multiple antivirus and threat-intel engines." },
    { name: "Have I Been Pwned", desc: "Checks whether an email address or domain appears in known public credential breaches." },
    { name: "MITRE ATT&CK Navigator", desc: "Visualizes which tactics and techniques a given threat actor or scenario covers - used to build each playbook's mapping below." }
  ];
  var PLAYBOOKS = [
    {
      cat: "OWASP Web",
      ref: "A01:2021",
      title: "Broken Access Control",
      mitre: "Privilege Escalation - T1548 (Abuse Elevation Control Mechanism)",
      desc: "Authorization checks are missing or incorrectly enforced, letting authenticated users act outside their intended permissions - e.g., accessing another user's records by changing an ID in a URL.",
      steps: [
        "Enforce authorization server-side on every request - never trust client-side role checks alone.",
        "Deny by default; grant access explicitly per resource and role.",
        "Centralize access-control logic rather than duplicating checks per endpoint.",
        "Log and alert on repeated authorization failures from a single account."
      ]
    },
    {
      cat: "OWASP Web",
      ref: "A02:2021",
      title: "Cryptographic Failures",
      mitre: "Credential Access - T1552 (Unsecured Credentials)",
      desc: "Sensitive data is transmitted or stored without adequate encryption, or with weak/outdated algorithms, exposing it if intercepted or if storage is breached.",
      steps: [
        "Encrypt sensitive data at rest and in transit using current, vetted algorithms.",
        "Never store passwords in plaintext or reversible encryption - use a modern salted hashing function.",
        "Disable legacy TLS versions and weak cipher suites.",
        "Classify data by sensitivity so encryption requirements match actual risk."
      ]
    },
    {
      cat: "OWASP Web",
      ref: "A03:2021",
      title: "Injection",
      mitre: "Initial Access / Execution - T1190 (Exploit Public-Facing Application)",
      desc: "Untrusted input is interpreted as executable code or commands by an interpreter (SQL, OS shell, LDAP), letting an attacker manipulate queries or execute arbitrary commands.",
      steps: [
        "Use parameterized queries/prepared statements - never string-concatenated queries.",
        "Validate and sanitize all input server-side, using allow-lists over deny-lists.",
        "Apply least-privilege database accounts so a successful injection has limited reach.",
        "Run static analysis (SAST) against injection patterns in CI/CD."
      ]
    },
    {
      cat: "OWASP Web",
      ref: "A04:2021",
      title: "Insecure Design",
      mitre: "Spans multiple tactics - an architectural gap, not a single technique",
      desc: "The application's underlying architecture or business logic contains exploitable flaws that no amount of secure coding can fix, because the design itself doesn't account for abuse cases.",
      steps: [
        "Threat-model new features before writing code, not after.",
        "Build abuse-case testing into design review, not just functional testing.",
        "Use secure design patterns and reference architectures rather than one-off solutions.",
        "Maintain a record of previously identified design flaws so they aren't repeated elsewhere."
      ]
    },
    {
      cat: "OWASP Web",
      ref: "A05:2021",
      title: "Security Misconfiguration",
      mitre: "Initial Access - T1190 (Exploit Public-Facing Application)",
      desc: "Default accounts, unnecessary features, verbose error messages, or open cloud storage are left enabled, giving attackers an easy, often automated, path in.",
      steps: [
        "Harden configurations using a repeatable, automated baseline (Infrastructure as Code).",
        "Disable or remove unused features, ports, services, and default accounts.",
        "Regularly scan for configuration drift, not just once at deployment.",
        "Ensure error handling doesn't leak stack traces or internal details to end users."
      ]
    },
    {
      cat: "OWASP Web",
      ref: "A06:2021",
      title: "Vulnerable and Outdated Components",
      mitre: "Initial Access - T1190 (Exploit Public-Facing Application)",
      desc: "Using libraries, frameworks, or components with known vulnerabilities, often because there's no inventory of what's actually running in production.",
      steps: [
        "Maintain a software bill of materials (SBOM) for every application.",
        "Automate dependency scanning (SCA) in the build pipeline.",
        "Patch or replace end-of-life components on a defined schedule.",
        "Subscribe to vendor security advisories for every component in use."
      ]
    },
    {
      cat: "OWASP Web",
      ref: "A07:2021",
      title: "Identification and Authentication Failures",
      mitre: "Credential Access - T1110 (Brute Force)",
      desc: "Weak session management, missing account lockout, or lack of MFA allows attackers to compromise accounts through credential stuffing or brute force.",
      steps: [
        "Enforce MFA, especially for privileged and remote-access accounts.",
        "Rate-limit and lock out after repeated failed login attempts.",
        "Rotate and invalidate session tokens after password changes or logout.",
        "Eliminate default credentials on any deployed system."
      ]
    },
    {
      cat: "OWASP Web",
      ref: "A08:2021",
      title: "Software and Data Integrity Failures",
      mitre: "Supply Chain Compromise - T1195",
      desc: "Code or infrastructure relies on plugins, libraries, or updates from sources that aren't verified for integrity, allowing a compromised upstream source to inject malicious code.",
      steps: [
        "Verify digital signatures on software updates and dependencies before deployment.",
        "Use dependency-pinning and lockfiles rather than automatically pulling the latest version.",
        "Restrict CI/CD pipelines from pulling unverified third-party packages.",
        "Apply integrity checks (checksums) to deployment artifacts."
      ]
    },
    {
      cat: "OWASP Web",
      ref: "A09:2021",
      title: "Security Logging and Monitoring Failures",
      mitre: "Defense Evasion - T1070 (Indicator Removal)",
      desc: "Insufficient logging, or logs that aren't monitored, means breaches go undetected for long periods and can't be reconstructed after the fact.",
      steps: [
        "Centralize logs in a SIEM with alerting thresholds, not just local log files.",
        "Log authentication events, access-control failures, and input-validation failures specifically.",
        "Protect log integrity so attackers can't delete evidence of their activity.",
        "Test detection coverage with periodic red-team or purple-team exercises."
      ]
    },
    {
      cat: "OWASP Web",
      ref: "A10:2021",
      title: "Server-Side Request Forgery (SSRF)",
      mitre: "Initial Access / C2 - T1190 (Exploit Public-Facing Application)",
      desc: "An application fetches a remote resource without validating the user-supplied URL, letting an attacker force the server to make requests to internal systems it shouldn't reach.",
      steps: [
        "Validate and allow-list destination URLs/IPs for any server-initiated request.",
        "Segment internal services from the network zone that processes external requests.",
        "Disable unnecessary URL schemas and redirects in the fetching library.",
        "Block outbound requests to internal metadata/management endpoints at the firewall."
      ]
    },
    {
      cat: "AI / LLM",
      ref: "LLM01:2025",
      title: "Prompt Injection",
      mitre: "MITRE ATLAS - AI Model Access / Execution",
      desc: "Crafted input, either direct from a user or indirectly embedded in retrieved content, overrides the model's intended instructions and causes it to perform unintended actions or reveal restricted information.",
      steps: [
        "Segregate untrusted external content from system instructions in the prompt structure.",
        "Apply output filtering and human-in-the-loop approval for any sensitive or irreversible action.",
        "Constrain model behavior via system prompts and expected output formats.",
        "Treat this as unpatchable by design - defense in depth, not a single fix."
      ]
    },
    {
      cat: "AI / LLM",
      ref: "LLM02:2025",
      title: "Sensitive Information Disclosure",
      mitre: "MITRE ATLAS - Exfiltration",
      desc: "The model exposes personal data, credentials, or proprietary information in its output, either because it was present in training/context data or because output isn't filtered before returning to the user.",
      steps: [
        "Apply data minimization - don't include sensitive data in context/prompts unless strictly necessary.",
        "Filter and redact model output before it reaches the end user.",
        "Isolate retrieval-augmented generation (RAG) sources by access level, not just relevance.",
        "Audit logs and transcripts for accidental sensitive-data echoes."
      ]
    },
    {
      cat: "AI / LLM",
      ref: "LLM03:2025",
      title: "Supply Chain",
      mitre: "Supply Chain Compromise - T1195",
      desc: "Third-party models, datasets, or plugins introduce vulnerable or malicious components into an AI pipeline - the same behavioral pattern as traditional software supply-chain risk, extended to model weights and training data.",
      steps: [
        "Source models and datasets only from vetted, signed repositories.",
        "Scan model files for unsafe deserialization risks (e.g., unsafe pickle loading).",
        "Maintain an AI bill of materials tracking model provenance and version.",
        'Pin specific model versions rather than auto-updating to "latest."'
      ]
    },
    {
      cat: "AI / LLM",
      ref: "LLM04:2025",
      title: "Data and Model Poisoning",
      mitre: "MITRE ATLAS - Resource Development / Persistence",
      desc: "Manipulated training, fine-tuning, or embedding data introduces hidden backdoors, bias, or degraded behavior that activates under specific triggering conditions.",
      steps: [
        "Validate the provenance and integrity of training and fine-tuning data sources.",
        "Test models against known trigger patterns before deployment.",
        "Monitor production model outputs for behavioral drift from baseline.",
        "Restrict who can contribute to training/fine-tuning datasets."
      ]
    },
    {
      cat: "AI / LLM",
      ref: "LLM06:2025",
      title: "Excessive Agency",
      mitre: "MITRE ATLAS - Impact",
      desc: "An AI agent is granted more autonomous permissions, tool access, or ability to take real-world action than its task actually requires, so a manipulated or malfunctioning agent can cause outsized damage.",
      steps: [
        "Grant agents least-privilege access to tools and systems, scoped per task.",
        "Require human approval for irreversible or high-impact actions.",
        "Log every tool call an agent makes, with the reasoning that triggered it.",
        "Set hard rate/scope limits on what an autonomous agent can execute unsupervised."
      ]
    },
    {
      cat: "AI / LLM",
      ref: "LLM10:2025",
      title: "Unbounded Consumption",
      mitre: "Impact - T1499 (Endpoint Denial of Service, closest classic analogue)",
      desc: "Uncontrolled or excessive requests to a model cause runaway computational cost, resource exhaustion, or denial of service - extended to include financial cost, not just availability.",
      steps: [
        "Apply rate limiting and per-user/per-key quotas on model API calls.",
        "Set maximum token/context limits per request.",
        "Monitor cost and usage in real time with automatic circuit breakers.",
        "Isolate high-cost operations behind additional authorization checks."
      ]
    }
  ];
  var CASE_STUDIES = [
    {
      year: "2010",
      title: "Stuxnet",
      href: "https://en.wikipedia.org/wiki/Stuxnet",
      body: "A worm believed to be a joint U.S.\u2013Israeli operation physically damaged centrifuges at an Iranian uranium enrichment facility by manipulating industrial control systems while feeding operators falsified normal readings.",
      lesson: "The first widely-documented cyberattack with physical, real-world consequences - the entire reason this site treats OT/ICS as a distinct module rather than folding it into general IT."
    },
    {
      year: "2013",
      title: "Target Corporation data breach",
      href: "https://en.wikipedia.org/wiki/Target_Corporation#2013_security_breach",
      body: "Attackers stole network credentials from a third-party HVAC vendor, then pivoted into Target's network and installed point-of-sale malware, exposing roughly 40 million payment cards during the holiday shopping season.",
      lesson: "A textbook case for why the Third-Party/Vendor Risk Policy on the Runbooks tab exists - the breach didn't start with Target's own systems at all."
    },
    {
      year: "2014",
      title: "Sony Pictures hack",
      href: "https://en.wikipedia.org/wiki/2014_Sony_Pictures_hack",
      body: "Attackers, later attributed by U.S. officials to North Korea, exfiltrated internal emails, unreleased films, and employee data, then deployed wiper malware that destroyed large portions of Sony's computing infrastructure.",
      lesson: "A destructive attack, not just a data leak - exactly the scenario the Backup & Disaster Recovery guidance on the Runbooks tab is built around."
    },
    {
      year: "2017",
      title: "Equifax data breach",
      href: "https://en.wikipedia.org/wiki/2017_Equifax_data_breach",
      body: "A critical Apache Struts vulnerability was publicly disclosed and patched in March 2017; Equifax failed to apply it, and attackers exploited the same flaw months later, exposing sensitive data on roughly 143 million people.",
      lesson: "The gap wasn't sophistication, it was patch management - the exact combination this site's Vulnerability & Patch Management questions and the Zero-Day runbook are designed to catch."
    },
    {
      year: "2017",
      title: "WannaCry ransomware attack",
      href: "https://en.wikipedia.org/wiki/WannaCry_ransomware_attack",
      body: "Self-propagating ransomware exploited a leaked NSA Windows SMB vulnerability (EternalBlue) to spread across unpatched systems worldwide within hours, crippling parts of the UK's National Health Service among thousands of other organizations.",
      lesson: "Shows exactly why this site's Ransomware runbook opens with isolation, not negotiation - and why untested backups turn an infection into a catastrophe."
    },
    {
      year: "2017",
      title: "NotPetya",
      href: "https://en.wikipedia.org/wiki/Petya_(malware)",
      body: "Disguised as ransomware but built purely to destroy data, NotPetya spread through a compromised update to Ukrainian tax software and went on to cause over $10 billion in global damage, including to shipping giant Maersk.",
      lesson: "The clearest real-world case for the Supply Chain/Third-Party Compromise runbook - the entry point was software the victims trusted and had already installed."
    },
    {
      year: "2020",
      title: "SolarWinds hack",
      href: "https://en.wikipedia.org/wiki/SolarWinds_hack",
      body: "Suspected Russian state-sponsored actors inserted malicious code into SolarWinds' Orion software updates, compromising roughly 18,000 downstream customers including multiple U.S. federal agencies, undetected for months.",
      lesson: "The reason Maturity Model Phase 9 (Auditing & Validation) matters as much as Phase 5 (Control Implementation) - a control that exists but isn't independently verified can be silently subverted."
    },
    {
      year: "2021",
      title: "Colonial Pipeline ransomware attack",
      href: "https://en.wikipedia.org/wiki/Colonial_Pipeline_ransomware_attack",
      body: "A ransomware attack, traced back to a single compromised password with no MFA on a legacy VPN account, forced the shutdown of a pipeline supplying nearly half the U.S. East Coast's fuel.",
      lesson: "One missing control - MFA on remote access - cascading into critical infrastructure disruption is exactly the kind of compounding risk this site's assessment is built to flag before it happens, not after."
    }
  ];
  var LEARNING_RESOURCES = {
    podcasts: [
      { name: "Darknet Diaries", desc: "Jack Rhysider narrates real-world hacking and breach stories as compelling long-form episodes - the most listened-to show in the genre." },
      { name: "Risky Business", desc: "Weekly news and interviews aimed at practitioners, running since 2007 - built for signal over explainer." },
      { name: "Smashing Security", desc: "Graham Cluley and Carole Theriault cover the same threat landscape with a lighter, more entertaining tone." },
      { name: "CyberWire Daily", desc: "A tight daily news briefing hosted by Dave Bittner - built for a quick catch-up rather than a deep dive." },
      { name: "Malicious Life", desc: "Ran Levi's narrative deep-dives into the history behind major cybercrimes, produced by Cybereason." }
    ],
    newsletters: [
      { name: "tl;dr sec", desc: "A weekly curation of the best security engineering and AppSec writing, without the fluff." },
      { name: "SANS NewsBites / @RISK / OUCH!", desc: "The SANS Institute's trio of newsletters covering news, vulnerabilities, and plain-language awareness tips." },
      { name: "Unsupervised Learning", desc: "Daniel Miessler's newsletter sitting right at the intersection of security and AI - directly relevant to the trends on the News tab." },
      { name: "CloudSecList", desc: "Marco Lancini's weekly, low-noise roundup of cloud-native security research and tooling." }
    ],
    medium: [
      { name: "InfoSec Write-ups", desc: "The largest cybersecurity publication on Medium - bug bounty write-ups, CTF walkthroughs, and real vulnerability research, with its own weekly digest." }
    ],
    newssites: [
      { name: "BleepingComputer", desc: "Fast, detailed coverage of breaking vulnerabilities, ransomware, and malware - often first to publish technical detail on an active incident." },
      { name: "Krebs on Security", desc: "Brian Krebs' investigative reporting - slower, deeper breach investigations rather than daily news volume." },
      { name: "SecurityWeek", desc: "Broad daily coverage across vulnerabilities, breaches, and industry news - a solid single feed to check regularly." }
    ],
    linkedin: [
      { name: "The Cyber Security Hub\u2122", desc: "One of the largest cybersecurity communities on LinkedIn, with a widely-subscribed newsletter surfacing industry news and leadership commentary." }
    ]
  };
  var pendingAnchor = null;
  function scrollToPendingAnchor() {
    if (!pendingAnchor) return;
    const el = document.getElementById(pendingAnchor);
    pendingAnchor = null;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function renderApp() {
    const tc = document.getElementById("tabContent");
    if (tc && tc.childNodes.length) {
      tc.classList.add("tab-fade");
      setTimeout(() => {
        renderTabNav();
        renderThemeToggle();
        renderActiveTab();
        requestAnimationFrame(() => {
          tc.classList.remove("tab-fade");
          observeReveals();
          scrollToPendingAnchor();
        });
      }, 160);
    } else {
      renderTabNav();
      renderThemeToggle();
      renderActiveTab();
      observeReveals();
      scrollToPendingAnchor();
    }
  }
  function observeReveals() {
    const els = document.querySelectorAll(".section-tile, .page-intro");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("revealed"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => io.observe(el));
  }
  function renderTabNav() {
    const nav = document.getElementById("tabnav");
    const dropdownMap = { home: HOME_DROPDOWN, assessment: ASSESSMENT_DROPDOWN };
    const navHtml = TOP_TABS.map((t) => {
      const dd = dropdownMap[t.id];
      if (dd) {
        const parentActive = activeTab === t.id || dd.some((d) => d.id === activeTab);
        return `
        <div class="tab-item has-dropdown">
          <button class="tab-btn ${parentActive ? "active" : ""}" data-tab="${t.id}">${t.label} <span class="tab-caret" data-toggle="1">\u25BE</span></button>
          <div class="tab-dropdown">
            ${dd.map((d) => `<button class="dropdown-link ${activeTab === d.id ? "active" : ""}" data-tab="${d.id}">${d.label}</button>`).join("")}
          </div>
        </div>
      `;
      }
      return `<button class="tab-btn ${activeTab === t.id ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`;
    }).join("");
    nav.innerHTML = navHtml;
    nav.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        renderApp();
      });
    });
    nav.querySelectorAll("[data-toggle]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        const item = el.closest(".tab-item");
        const wasOpen = item.classList.contains("open");
        nav.querySelectorAll(".tab-item.open").forEach((i) => i.classList.remove("open"));
        if (!wasOpen) item.classList.add("open");
      });
    });
    if (!window._tabnavOutsideClickBound) {
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".tab-item")) {
          document.querySelectorAll(".tab-item.open").forEach((i) => i.classList.remove("open"));
        }
      });
      window._tabnavOutsideClickBound = true;
    }
    if (!window._footerLinksBound) {
      document.querySelectorAll(".footer-links a[data-tab]").forEach((a2) => {
        a2.addEventListener("click", (e) => {
          e.preventDefault();
          goToTab(a2.dataset.tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });
      const brandLink = document.getElementById("brandHomeLink");
      if (brandLink) {
        brandLink.addEventListener("click", (e) => {
          e.preventDefault();
          goToTab("home");
        });
      }
      window._footerLinksBound = true;
    }
  }
  function renderThemeToggle() {
    const btn = document.getElementById("themeToggle");
    const goingTo = theme === "dark" ? "light" : "dark";
    btn.innerHTML = `${icon(goingTo === "light" ? "sun" : "moon")} <span>${goingTo === "light" ? "Light" : "Dark"} mode</span>`;
    btn.onclick = async () => {
      theme = goingTo;
      document.documentElement.setAttribute("data-theme", theme);
      renderThemeToggle();
      try {
        await window.storage.set("theme", theme, false);
      } catch (e) {
      }
    };
  }
  function goToTab(id, anchor) {
    activeTab = id;
    pendingAnchor = anchor || null;
    renderApp();
  }
  function exportProgressJson(overallValue) {
    const exportData = { scsExport: true, exportedAt: Date.now(), overall: overallValue ?? null, answers: assessmentController.session.answers };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url;
    const suffix = overallValue === void 0 || overallValue === null ? "in-progress" : "complete";
    a2.download = `simplifiedcs-assessment-${suffix}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a2);
    a2.click();
    a2.remove();
    URL.revokeObjectURL(url);
  }
  function renderActiveTab() {
    const container = document.getElementById("tabContent");
    if (activeTab === "home") renderHomeTab(container);
    else if (activeTab === "methodology") renderMethodologyTab(container);
    else if (activeTab === "maturity") renderMaturityTab(container);
    else if (activeTab === "metrics") renderMetricsTab(container);
    else if (activeTab === "coreprinciples") renderCorePrinciplesTab(container);
    else if (activeTab === "maturitymodel") renderMaturityModelTab(container);
    else if (activeTab === "roadmap") renderRoadmapTab(container);
    else if (activeTab === "transform") renderTransformTab(container);
    else if (activeTab === "runbook") renderRunbookTab(container);
    else if (activeTab === "news") renderNewsTab(container);
    else if (activeTab === "casestudy") renderCaseStudyTab(container);
    else if (activeTab === "playbooks") renderPlaybooksTab(container);
    else if (activeTab === "glossary") renderGlossaryTab(container);
    else if (activeTab === "references") renderReferencesTab(container);
    else if (activeTab === "about") renderAboutTab(container);
    else if (activeTab === "feedback") renderFeedbackTab(container);
    else if (activeTab === "assessment") renderAssessmentTab(container);
    else if (activeTab === "history") {
      container.innerHTML = `<div class="page" id="panel"></div>`;
      renderHistory();
    }
  }
  function renderAssessmentTab(container) {
    container.innerHTML = `
    <div class="assessment-serial" id="serial"></div>
    <div class="layout">
      <div class="rail" id="rail"></div>
      <div><div class="panel" id="panel"></div></div>
    </div>
  `;
    assessmentController.renderCurrentPhase();
  }
  function stageIllustration(stageId) {
    const svgs = {
      discovery: `
      <svg viewBox="0 0 100 100" width="72" height="72">
        <defs><radialGradient id="gDisc" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stop-color="var(--accent-signal)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent-signal)" stop-opacity="0"/>
        </radialGradient></defs>
        <circle cx="50" cy="50" r="46" fill="url(#gDisc)"/>
        <circle cx="30" cy="26" r="3" fill="var(--accent-signal)" opacity="0.6"/>
        <circle cx="72" cy="30" r="2.4" fill="var(--accent-signal)" opacity="0.5"/>
        <circle cx="68" cy="70" r="3" fill="var(--accent-signal)" opacity="0.6"/>
        <circle cx="24" cy="66" r="2" fill="var(--accent-signal)" opacity="0.5"/>
        <circle cx="43" cy="43" r="17" fill="none" stroke="var(--accent-signal)" stroke-width="4.5"/>
        <line x1="55" y1="55" x2="74" y2="74" stroke="var(--accent-signal)" stroke-width="5.5" stroke-linecap="round"/>
      </svg>`,
      transformation: `
      <svg viewBox="0 0 100 100" width="72" height="72">
        <defs><radialGradient id="gTrans" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="var(--accent-secure)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent-secure)" stop-opacity="0"/>
        </radialGradient></defs>
        <circle cx="50" cy="50" r="46" fill="url(#gTrans)"/>
        <path d="M25 42a25 25 0 0 1 42-16" fill="none" stroke="var(--accent-secure)" stroke-width="5" stroke-linecap="round"/>
        <path d="M17 27l8 0 0 8" fill="none" stroke="var(--accent-secure)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M75 58a25 25 0 0 1-42 16" fill="none" stroke="var(--accent-secure)" stroke-width="5" stroke-linecap="round"/>
        <path d="M83 73l-8 0 0-8" fill="none" stroke="var(--accent-secure)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      optimization: `
      <svg viewBox="0 0 100 100" width="72" height="72">
        <defs><radialGradient id="gOpt" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="var(--accent-violet)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent-violet)" stop-opacity="0"/>
        </radialGradient></defs>
        <circle cx="50" cy="50" r="46" fill="url(#gOpt)"/>
        <rect x="24" y="55" width="10" height="21" fill="var(--accent-violet)" opacity="0.55"/>
        <rect x="45" y="40" width="10" height="36" fill="var(--accent-violet)" opacity="0.78"/>
        <rect x="66" y="24" width="10" height="52" fill="var(--accent-violet)"/>
        <path d="M22 50l16-14 12 8 24-22" fill="none" stroke="var(--accent-violet)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    };
    return svgs[stageId] || "";
  }
  function buildHeroInfinity() {
    const a2 = 82, n = 90, cx = 130, cy = 68;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = Math.PI / 2 + i / n * 2 * Math.PI;
      const denom = 1 + Math.sin(t) * Math.sin(t);
      pts.push([cx + a2 * Math.cos(t) / denom, cy + a2 * Math.sin(t) * Math.cos(t) / denom]);
    }
    const toPath = (arr) => "M" + arr.map((p) => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" L");
    const d = toPath(pts) + " Z";
    const half = Math.round(n / 2);
    const discoveryLoop = toPath(pts.slice(0, half + 1));
    const optimizeLoop = toPath(pts.slice(half, n + 1));
    return `
  <div class="hero-infinity">
    <svg viewBox="0 0 ${cx * 2} ${cy * 2}" xmlns="http://www.w3.org/2000/svg">
      <path d="${d}" fill="none" stroke="var(--line)" stroke-width="7"/>
      <path d="${discoveryLoop}" fill="none" stroke="var(--accent-signal)" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
      <path d="${optimizeLoop}" fill="none" stroke="var(--accent-violet)" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
      <path d="${d}" fill="none" stroke="var(--accent-signal)" stroke-width="7" stroke-linecap="round" class="infinity-flow"/>
    </svg>
    <div class="infinity-caption">
      <span style="color:var(--accent-signal)">Discovery</span>
      <span style="color:var(--accent-secure)">Transform</span>
      <span style="color:var(--accent-violet)">Optimization</span>
    </div>
  </div>`;
  }
  var SITE_TILES = [
    { tab: "methodology", icon: "register", title: "Methodology", desc: "Exactly how scoring and adaptive questions work." },
    { tab: "maturity", icon: "cycle", title: "Maturity Model", desc: "The 10-phase journey and NIST's own maturity tiers." },
    { tab: "coreprinciples", icon: "route", title: "Core Principles", desc: "The cybersecurity philosophy this site is built on." },
    { tab: "runbook", icon: "document", title: "Runbooks", desc: "IR plans, backup/DR, and step-by-step incident runbooks." },
    { tab: "news", icon: "signal", title: "Trends & News", desc: "Current threats, AI-in-security developments, and where to keep learning." },
    { tab: "casestudy", icon: "urgent", title: "Case Studies", desc: "Stuxnet, SolarWinds, Equifax, and other watershed incidents." },
    { tab: "playbooks", icon: "checklist", title: "Playbooks", desc: "OWASP Top 10 and AI-threat playbooks, mapped to MITRE ATT&CK." },
    { tab: "roadmap", icon: "clock", title: "Roadmap", desc: "What's shipped, in progress, and planned for this site itself." }
  ];
  var HOW_IT_WORKS = [
    {
      n: "01",
      title: "Data Collection",
      sub: "Assessment",
      tagline: "Know exactly where you stand",
      icon: "hiw-clipboard",
      bullets: [
        "Answer an adaptive questionnaire shaped by your industry and infrastructure",
        "Only relevant questions appear - nothing generic, nothing wasted",
        "All six NIST CSF functions scored individually"
      ]
    },
    {
      n: "02",
      title: "Analysis",
      sub: null,
      tagline: "See risks a checklist would miss",
      icon: "hiw-magnify",
      bullets: [
        "Every answer cross-referenced against every other answer",
        "Compounding risk flagged, not just scored in isolation",
        "Vendor-specific mitigation notes where you've named a product"
      ]
    },
    {
      n: "03",
      title: "Recommendation",
      sub: null,
      tagline: "Know what to fix first",
      icon: "hiw-lightbulb",
      bullets: [
        "A ranked, prioritized action list - not a wall of findings",
        "Each item tied to why it matters more than the rest",
        "Mapped back to the specific control it strengthens"
      ]
    },
    {
      n: "04",
      title: "Transformation",
      sub: null,
      tagline: "Prove the change actually worked",
      icon: "hiw-transform",
      bullets: [
        "Implement fixes using the matching Runbook or Playbook",
        "Re-assess on a cadence to track real progress",
        "See the score delta since your last run"
      ]
    }
  ];
  var START_LINKS = [
    { title: "CISA KEV Catalog", desc: "Actively exploited vulnerabilities, updated continuously", href: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", icon: "urgent", external: true },
    { title: "NVD - National Vulnerability Database", desc: "The U.S. government's authoritative CVE repository", href: "https://nvd.nist.gov/", icon: "register", external: true },
    { title: "Recently Flagged Exploits", desc: "CISA's KEV catalog, sorted with newest entries first", href: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", icon: "clock", external: true },
    { title: "Ongoing Threat Actor Campaigns", desc: "CISA's cybersecurity advisories on active TTPs", href: "https://www.cisa.gov/news-events/cybersecurity-advisories", icon: "lateral", external: true },
    { title: "Current Trends", desc: "This site's own curated threat-landscape roundup", tab: "news", icon: "signal" },
    { title: "Runbooks", desc: "Incident runbooks and foundational documents", tab: "runbook", icon: "document" }
  ];
  function renderHomeTab(container) {
    const stageOrder = ["discovery", "transformation", "optimization"];
    container.innerHTML = `
    <div class="page">
      <div class="hero-banner">
        <div class="hero-banner-inner">
          <h2 class="page-title">Cybersecurity posture assessment, made simple.</h2>
          <p class="page-lede">Answer a few adaptive questions. Get a scored, prioritized, evidence-based read on your cybersecurity health - and a clear path to improve it.</p>
          <div class="hero-links">
            <a href="#" id="heroTakeAssessment" class="link-pill"><span class="link-pill-icon">${icon("checklist")}</span>Take the assessment</a>
            <a href="#how-it-works" class="link-pill secondary"><span class="link-pill-icon">${icon("route")}</span>How it works</a>
          </div>
        </div>
        ${buildHeroInfinity()}
      </div>

      <div class="section-tile">
        <h3 class="section-h" id="how-it-works">How it works</h3>
        <p class="body-text">Four steps, start to finish.</p>
        <div class="phase4-grid">
          ${HOW_IT_WORKS.map((s) => `
            <div class="phase4-card">
              <div class="phase4-icon">${icon(s.icon)}</div>
              <div class="vnum">${s.n}</div>
              <h4>${s.title}${s.sub ? ` <span style="color:var(--text-muted); font-weight:400;">(${s.sub})</span>` : ""}</h4>
              <div class="phase4-tagline">${s.tagline}</div>
              <ul class="phase4-bullets">
                ${s.bullets.map((b) => `<li>${b}</li>`).join("")}
              </ul>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The three phases of the assessment</h3>
        <p class="body-text">Every assessment moves through three stages as a continuous workflow. Select a stage for a quick summary - each links through to the full detail on the <a href="#" id="linkMaturityFromPhases" class="inline-link">Maturity Model</a> page.</p>
        <div class="workflow-row">
          ${stageOrder.map((sid, i) => `
            ${i > 0 ? `<div class="workflow-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>` : ""}
            <div class="workflow-step" data-stage-detail="${sid}" style="border-top:2px solid ${STAGE_META[sid].color}">
              <div class="workflow-phase-tag">Phase ${i + 1}</div>
              <div class="stage-illustration">${stageIllustration(sid)}</div>
              <h4 style="color:${STAGE_META[sid].color}">${STAGE_META[sid].label}</h4>
              <p>${STAGE_META[sid].blurb}</p>
            </div>
          `).join("")}
        </div>
        <div class="stage-detail-panel" id="stageDetailPanel" style="display:none;"></div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Risk Score Matrix</h3>
        <p class="body-text">Every assessment runs on a scored matrix (see the <a href="#" id="linkMetricsFromHome" class="inline-link">Metrics</a> page for the full breakdown). Select a number for what that risk level actually means:</p>
        <div class="risk-slider-wrap">
          <div class="risk-slider-label">Interactive risk scale - the lower the score, the stronger the security posture</div>
          <div class="risk-slider-track">
            <div class="risk-slider-fill"></div>
            ${Array.from({ length: 10 }, (_, i) => `<button class="risk-slider-tick" data-risk="${i + 1}" type="button">${i + 1}</button>`).join("")}
          </div>
          <div class="risk-slider-ends"><span>1 - Minimal risk</span><span>10 - Severe risk</span></div>
          <div class="risk-slider-desc" id="riskSliderDesc"></div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Methodology</h3>
        <p class="body-text">Every question maps to a real control from a recognized framework - nothing here is invented. These frameworks are the guiding principles behind every score:</p>
        <div class="framework-badges">
          <div class="framework-badge">NIST CSF 2.0</div>
          <div class="framework-badge">CIS Controls v8</div>
          <div class="framework-badge">ISO 27001</div>
          <div class="framework-badge">NIS2</div>
          <div class="framework-badge">SOC 2</div>
          <div class="framework-badge">HIPAA</div>
          <div class="framework-badge">GDPR</div>
          <div class="framework-badge">SOX</div>
          <div class="framework-badge">Cyber Essentials</div>
          <div class="framework-badge">PCI DSS</div>
          <div class="framework-badge framework-badge-pipeline">+ more in the pipeline</div>
        </div>
        <p class="body-text">The baseline (NIST CSF + CIS) applies to every organization. The rest layer in based on your industry and the regions you operate in - a healthcare provider and a SaaS company are asked different follow-up questions, scored against different compliance overlays, because the risks and obligations genuinely differ. Operational Technology and DevSecOps modules do the same, appearing only where they're actually relevant. This framework set keeps growing as the tool matures.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Things to get you started</h3>
        <p class="body-text">Real, current sources - not just this site's own content.</p>
        <div class="start-links">
          ${START_LINKS.map((l) => `
            <a class="start-link" ${l.href ? `href="${l.href}" target="_blank" rel="noopener noreferrer"` : `href="#" data-tab="${l.tab}"`}>
              <div class="icon-badge">${icon(l.icon)}</div>
              <div><h4>${l.title}</h4><p>${l.desc}</p></div>
              ${l.external ? '<span class="ext-mark">\u2197</span>' : ""}
            </a>
          `).join("")}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Explore the site</h3>
        <p class="body-text">Everything this platform offers, in one map.</p>
        <div class="site-tile-grid">
          ${SITE_TILES.map((t) => `
            <div class="site-tile" data-tab="${t.tab}">
              <div class="icon-badge">${icon(t.icon)}</div>
              <h4>${t.title}</h4>
              <p>${t.desc}</p>
            </div>
          `).join("")}
        </div>
        <div class="cta-row">
          <button class="cta-btn" id="ctaStart">Start an assessment \u2192</button>
          <button class="cta-btn secondary" id="ctaMethod">See how scoring works</button>
        </div>
      </div>
    </div>
  `;
    document.getElementById("ctaStart").addEventListener("click", () => goToTab("assessment"));
    document.getElementById("ctaMethod").addEventListener("click", () => goToTab("methodology"));
    document.getElementById("heroTakeAssessment").addEventListener("click", (e) => {
      e.preventDefault();
      goToTab("assessment");
    });
    document.getElementById("linkMetricsFromHome").addEventListener("click", (e) => {
      e.preventDefault();
      goToTab("metrics");
    });
    document.getElementById("linkMaturityFromPhases").addEventListener("click", (e) => {
      e.preventDefault();
      goToTab("maturity");
    });
    let openStageDetail = null;
    function closeStageDetail() {
      const panel = document.getElementById("stageDetailPanel");
      if (!panel) return;
      panel.classList.remove("open");
      openStageDetail = null;
      container.querySelectorAll("[data-stage-detail]").forEach((c) => c.classList.remove("stage-active"));
      setTimeout(() => {
        if (!panel.classList.contains("open")) panel.style.display = "none";
      }, 220);
    }
    container.querySelectorAll("[data-stage-detail]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const sid = el.dataset.stageDetail;
        const panel = document.getElementById("stageDetailPanel");
        const d = STAGE_DETAIL[sid];
        if (openStageDetail === sid) {
          closeStageDetail();
          return;
        }
        openStageDetail = sid;
        container.querySelectorAll("[data-stage-detail]").forEach((c) => c.classList.remove("stage-active"));
        el.classList.add("stage-active");
        el.insertAdjacentElement("afterend", panel);
        panel.innerHTML = `
        <h4 style="color:${STAGE_META[sid].color}">${STAGE_META[sid].label}</h4>
        <p class="body-text">${d.summary}</p>
        <p class="body-text"><b>Scoring metrics used:</b> ${d.metrics}</p>
        <a href="#" id="stageDetailMaturityLink" class="inline-link">See ${STAGE_META[sid].label} in full on the Maturity Model page \u2192</a>
      `;
        panel.style.display = "block";
        requestAnimationFrame(() => panel.classList.add("open"));
        document.getElementById("stageDetailMaturityLink").addEventListener("click", (e2) => {
          e2.preventDefault();
          goToTab("maturity", `maturity-${sid}`);
        });
      });
    });
    document.addEventListener("click", (e) => {
      if (openStageDetail && !e.target.closest(".workflow-row") && !e.target.closest(".stage-detail-panel")) {
        closeStageDetail();
      }
    });
    const riskDesc = document.getElementById("riskSliderDesc");
    container.querySelectorAll(".risk-slider-tick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = btn.dataset.risk;
        container.querySelectorAll(".risk-slider-tick").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        riskDesc.innerHTML = `<b>Risk score ${n}:</b> ${RISK_SCORE_DESCRIPTIONS[n]}`;
        riskDesc.classList.remove("open");
        requestAnimationFrame(() => riskDesc.classList.add("open"));
      });
    });
    container.querySelectorAll(".site-tile").forEach((el) => {
      el.addEventListener("click", () => goToTab(el.dataset.tab));
    });
    container.querySelectorAll(".start-link[data-tab]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        goToTab(el.dataset.tab);
      });
    });
  }
  function renderMethodologyTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">How It Works</div>
        <h2 class="page-title">Methodology</h2>
        <p class="page-lede">What you get scored on, why the question set changes per organization, and how the final synthesis is built.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Why NIST CSF and CIS Controls</h3>
        <p class="body-text"><b>NIST CSF 2.0</b> was built by the U.S. National Institute of Standards and Technology as an outcomes-based framework rather than a prescriptive technical checklist - it describes <i>what</i> a mature security program achieves (govern, identify, protect, detect, respond, recover) without dictating exactly how. That makes it vendor-neutral, technology-agnostic, and adopted internationally well beyond the US, which is exactly why it works as a common baseline regardless of your size, sector, or maturity level. Nearly every other major framework - ISO 27001, SOC 2, the others in this assessment - maps cleanly onto its structure, so it functions as a shared language between them rather than one more competing standard.</p>
        <p class="body-text"><b>CIS Controls v8</b> was chosen to complement it for the opposite reason: where NIST CSF stays abstract, CIS is deliberately prescriptive and prioritized - a maintained, practical answer to "where do I actually start." Pairing the two gives this assessment both the high-level structure and the concrete, specific questions underneath it, rather than picking one at the expense of the other.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The framework backbone</h3>
        <p class="body-text">Every assessment scores six functions, matching <b>NIST CSF 2.0</b>, with question granularity drawn from <b>CIS Controls v8</b>. Each question maps to a real control - nothing here is invented.</p>
        <div class="func-legend">
          ${FUNCTIONS.map((f) => `<div class="func-legend-row"><div class="func-legend-dot" style="background:${FUNC_COLORS[f]}"></div><div><b>${f}</b><span>${f === "Govern" ? "Policy, roles, oversight, and risk-informed decisions" : f === "Identify" ? "Asset inventory, data classification, third-party risk" : f === "Protect" ? "Access control, patching, training, endpoint defense" : f === "Detect" ? "Logging, monitoring, vulnerability scanning, testing" : f === "Respond" ? "Incident response plan, team, communication" : "Backup testing, business continuity, isolation"}</span></div></div>`).join("")}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Scoring, in brief</h3>
        <p class="body-text">Each question scores 0, 1, or 2 depending on the answer chosen, rolled up into a function score and an overall percentage. The full breakdown of exactly how that's calculated, what each score band means, and how to read your result lives on the <a href="#" id="linkMetricsFromMethod" class="inline-link">Metrics</a> page.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Why the questions themselves change</h3>
        <p class="body-text">Before scoring starts, you choose an industry and any relevant compliance standards (ISO 27001 / NIS2 / SOC 2), which inject a handful of framework-specific questions into the relevant functions. Two further sections adapt on their own: <b>Operational Technology</b> is skipped by default for industries where it's rarely applicable (and can be included manually), and <b>DevSecOps / containerization</b> only expands if you confirm you develop software. Nobody answers questions that don't apply to them.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The part that isn't just averaging</h3>
        <p class="body-text">Before the results are shown, every answer is cross-checked against every other answer for known dangerous combinations - not just totalled. No MFA plus many unreviewed vendors, exposed remote access plus untested backups, no email authentication plus no security training: each is flagged as its own finding, because the combination is materially riskier than either gap alone. This is the difference between a scored checklist and an actual risk read.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Vendor-aware, not a scanner</h3>
        <p class="body-text">If you name specific products (a firewall vendor, hosting provider, etc.), the report can surface mitigation guidance tied to well-documented historical exploitation patterns for that product. This is intentionally illustrative, not a live vulnerability feed - it's a prompt to check current advisories, not a substitute for a real vulnerability management program.</p>
        <div class="cta-row">
          <button class="cta-btn" id="ctaStart2">Start an assessment \u2192</button>
        </div>
      </div>
    </div>
  `;
    document.getElementById("ctaStart2").addEventListener("click", () => goToTab("assessment"));
    document.getElementById("linkMetricsFromMethod").addEventListener("click", (e) => {
      e.preventDefault();
      goToTab("metrics");
    });
  }
  function renderMaturityTab(container) {
    const stageOrder = ["discovery", "transformation", "optimization"];
    let html = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Maturity Model</div>
        <h2 class="page-title">Maturity Model</h2>
        <p class="page-lede">How a security program actually progresses - ten phases across three stages, four recognized maturity tiers, and what each number on your results page means for where you actually stand.</p>
      </div>
  `;
    stageOrder.forEach((stageId) => {
      const meta = STAGE_META[stageId];
      html += `<div class="section-tile" id="maturity-${stageId}">`;
      html += `
      <div class="stage-band" style="--stage-color:${meta.color}">
        <div class="stage-illustration stage-illustration-sm">${stageIllustration(stageId)}</div>
        <div><h3 class="stage-label">${meta.label}</h3><div class="stage-range">${meta.range}</div></div>
        <p>${meta.blurb}</p>
      </div>
    `;
      PHASES.filter((p) => p.stage === stageId).forEach((p) => {
        html += `
        <div class="phase-row" style="--phase-color:${meta.color}">
          <div class="phase-num">${String(p.num).padStart(2, "0")}</div>
          <div><h4>${p.title}</h4><p>${p.desc}</p></div>
        </div>
      `;
      });
      html += `</div>`;
    });
    html += `
      <div class="section-tile">
        <div class="roadmap-loop">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-signal)" stroke-width="1.8" stroke-linecap="round"><path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2"/><path d="M18.5 4v3.2H15.3M5.5 20v-3.2H8.7"/></svg>
          <span>Phase 10 feeds back into Phase 4 - the Assessment tab is designed to be re-run on a cadence, precisely to drive this loop rather than end it.</span>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Maturity is a known concept - we're borrowing it deliberately</h3>
        <p class="body-text">NIST CSF itself defines four <b>Implementation Tiers</b> describing how an organization's risk management practice matures - this site's repeat-assessment design mirrors that same progression, just measured through this specific instrument instead of a qualitative review.</p>
        <div class="tier-track">
          <div class="tier-row"><div class="tier-num">01</div><div class="tier-body"><h4>Partial</h4><p>Risk management is reactive and ad hoc. Practices exist inconsistently across the organization, often driven by individual initiative rather than policy.</p></div></div>
          <div class="tier-row"><div class="tier-num">02</div><div class="tier-body"><h4>Risk Informed</h4><p>Risk management practices are approved by management but not established as organization-wide policy - awareness exists, consistency doesn't yet.</p></div></div>
          <div class="tier-row"><div class="tier-num">03</div><div class="tier-body"><h4>Repeatable</h4><p>Practices are formally approved and expressed as policy, applied consistently, and regularly updated based on changes in risk and the environment.</p></div></div>
          <div class="tier-row"><div class="tier-num">04</div><div class="tier-body"><h4>Adaptive</h4><p>The organization adapts its practices continuously based on lessons learned and predictive indicators - security is a living, improving process, not a static state.</p></div></div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The full phase table</h3>
        <p class="body-text">Every phase, with how it's actually monitored and what it unlocks next. For how your score itself is calculated, see the <a href="#" id="linkMetricsFromMaturity" class="inline-link">Metrics</a> page.</p>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Level</th><th>Stage</th><th>Title</th><th>How it's monitored</th><th>How it advances the program</th></tr></thead>
            <tbody>
              ${PHASES.map((p) => `
                <tr>
                  <td class="dt-level">${String(p.num).padStart(2, "0")}</td>
                  <td>${STAGE_META[p.stage].label}</td>
                  <td class="dt-title">${p.title}</td>
                  <td>${p.monitor}</td>
                  <td>${p.evolve}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="cta-row">
          <button class="cta-btn" id="ctaMaturityAssess">Start an assessment \u2192</button>
          <button class="cta-btn secondary" id="ctaMaturityDocs">See documentation & runbooks</button>
        </div>
      </div>
    </div>
  `;
    container.innerHTML = html;
    document.getElementById("ctaMaturityAssess").addEventListener("click", () => goToTab("assessment"));
    document.getElementById("ctaMaturityDocs").addEventListener("click", () => goToTab("runbook"));
    document.getElementById("linkMetricsFromMaturity").addEventListener("click", (e) => {
      e.preventDefault();
      goToTab("metrics");
    });
  }
  function buildLifecycleSvg() {
    const stages = ["Draft", "Review", "Approve", "Publish", "Periodic Review"];
    const cx = 200, cy = 170, r = 110;
    const pts = stages.map((s, i) => {
      const a2 = i / stages.length * 2 * Math.PI - Math.PI / 2;
      return { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2), label: s };
    });
    const pathD = `M ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r + 0.01},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy}`;
    return `
  <svg viewBox="0 0 400 340" xmlns="http://www.w3.org/2000/svg">
    <path id="lifecyclePath" d="${pathD}" fill="none" stroke="var(--line)" stroke-width="1.5"/>
    ${pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="var(--surface)" stroke="var(--accent-secure)" stroke-width="1.6"/>`).join("")}
    ${pts.map((p) => {
      const labelY = p.y + (p.y > cy ? 22 : p.y < cy - 5 ? -14 : 5);
      const anchor = p.x > cx + 30 ? "start" : p.x < cx - 30 ? "end" : "middle";
      return `<text x="${p.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" class="lifecycle-node-label">${p.label}</text>`;
    }).join("")}
    <circle r="6" fill="var(--accent-signal)">
      <animateMotion dur="9s" repeatCount="indefinite">
        <mpath href="#lifecyclePath"/>
      </animateMotion>
    </circle>
    <text x="200" y="175" text-anchor="middle" class="lifecycle-node-label" style="font-size:11px; letter-spacing:0.05em;">continuous, not one-and-done</text>
  </svg>`;
  }
  function renderMetricsTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Scoring & Calculation</div>
        <h2 class="page-title">Metrics</h2>
        <p class="page-lede">Exactly how a score is calculated, what each band means, and how to read your result - all the scoring mechanics in one place.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">How the score is calculated</h3>
        <p class="body-text">Each question scores 0, 1, or 2 depending on the answer chosen. A function's score is the sum of its answers divided by the maximum possible, expressed as a percentage. The overall score is the average across all six NIST CSF functions - visible as the radial gauge on your results page. This is a straightforward roll-up, but it isn't the whole picture: see "the part that isn't just averaging" on the <a href="#" id="linkMethodFromMetrics1" class="inline-link">Methodology</a> page for how compounding-risk flags factor in separately.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Reading your score</h3>
        <p class="body-text">The overall percentage is a snapshot, not a grade. It exists to be compared against your <i>own</i> next assessment - the trend matters more than any single number.</p>
        <div class="verdict-scale">
          <div class="verdict-cell"><div class="vrange">0\u201329%</div><div class="vlabel" style="color:var(--accent-critical)">Critical exposure</div></div>
          <div class="verdict-cell"><div class="vrange">30\u201354%</div><div class="vlabel" style="color:var(--accent-signal)">Elevated exposure</div></div>
          <div class="verdict-cell"><div class="vrange">55\u201379%</div><div class="vlabel">Moderate exposure</div></div>
          <div class="verdict-cell"><div class="vrange">80\u2013100%</div><div class="vlabel" style="color:var(--accent-secure)">Strong health</div></div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Why your score is what it is</h3>
        <p class="body-text">Bands below are shown on a 0\u201310 scale (your overall percentage \xF7 10) - a 5\u20137, for example, means something specific about your organization, not just "middling." For how each phase of the <a href="#" id="linkMaturityFromMetrics" class="inline-link">Maturity Model</a> connects to these bands, see that page directly.</p>
        ${SCORE_RUBRIC.map((r) => `
          <div class="rubric-card">
            <div class="rubric-head"><div class="rubric-range">${r.range}</div><div class="rubric-verdict">${r.verdict}</div></div>
            <div class="rubric-row"><b>Good bits</b><span>${r.good}</span></div>
            <div class="rubric-row"><b>Bad bits</b><span>${r.bad}</span></div>
            <div class="rubric-row"><b>Why this number</b><span>${r.why}</span></div>
            <div class="rubric-row"><b>Priority</b><span>${r.priority}</span></div>
          </div>
        `).join("")}
      </div>

      <div class="section-tile">
        <h3 class="section-h">How this site tracks it over time</h3>
        <p class="body-text">Every completed assessment is saved. Your next run shows the score delta, which specific findings were resolved, and which are newly flagged - the closest thing this tool has to watching an organization actually improve, run over run, rather than guessing at where it stands.</p>
        <div class="cta-row">
          <button class="cta-btn" id="ctaMetricsHistory">View assessment history \u2192</button>
          <button class="cta-btn secondary" id="ctaMetricsAssess">Start an assessment \u2192</button>
        </div>
      </div>
    </div>
  `;
    document.getElementById("ctaMetricsHistory").addEventListener("click", () => goToTab("history"));
    document.getElementById("ctaMetricsAssess").addEventListener("click", () => goToTab("assessment"));
    document.getElementById("linkMethodFromMetrics1").addEventListener("click", (e) => {
      e.preventDefault();
      goToTab("methodology");
    });
    document.getElementById("linkMaturityFromMetrics").addEventListener("click", (e) => {
      e.preventDefault();
      goToTab("maturity");
    });
  }
  var SITE_LAST_UPDATED = "August 10, 2026";
  var SITE_STARTED = "June 2026";
  var ROADMAP_SHIPPED = [
    { module: "Adaptive Assessment Wizard", added: "Jun 2026", desc: "Industry- and region-aware questionnaire across all six NIST CSF functions, with conditional OT/DevSecOps modules." },
    { module: "Save Progress / Export / Import", added: "Jun 2026", desc: "Resume an assessment later, or reload a completed one to re-run after fixes." },
    { module: "Vendor-Aware Mitigation Notes", added: "Jun 2026", desc: "Illustrative guidance for named products across EDR, email security, firewalls, and more." },
    { module: "Compounding-Risk Detection", added: "Jul 2026", desc: "Cross-answer flagging for dangerous combinations, not just per-question scoring." },
    { module: "Runbooks & Playbooks", added: "Jul 2026", desc: "8 incident runbooks plus 16 OWASP/AI-mapped attack-type playbooks with MITRE ATT&CK/ATLAS references." },
    { module: "Case Studies", added: "Jul 2026", desc: "8 real watershed cybersecurity incidents, each tied back to a specific gap this tool is built to catch." },
    { module: "Trends & News", added: "Jul 2026", desc: "Curated threat-landscape snapshot plus a living list of sources to keep following." },
    { module: "Glossary & References", added: "Aug 2026", desc: "A 59-term glossary and a sourced references page." },
    { module: "History & Score Tracking", added: "Aug 2026", desc: "Every completed run saved, with delta tracking between assessments." },
    { module: "Hosting & Domain", added: "Aug 2026", desc: "Live at simplifiedcs.net via Netlify, auto-deployed from GitHub on every update." }
  ];
  var ROADMAP_IN_PROGRESS = [
    { module: "Feedback Form", desc: "A direct feedback channel from the site to its creator, without exposing an email address anywhere in the page source." },
    { module: "Core Principles Page", desc: "The cybersecurity philosophy this tool is designed around, and why." }
  ];
  var ROADMAP_PLANNED = [
    { module: "Live Backend (Supabase)", desc: "Replacing session-only storage with a real, persistent database for history and resume-progress." },
    { module: "Real AI-Generated Reports", desc: "A live Claude API call synthesizing the final report, replacing the current rules engine." },
    { module: "Additional Compliance Frameworks", desc: "More frameworks and region coverage beyond the current eight." },
    { module: "Vendor Selection Dropdowns", desc: "Structured vendor picklists in place of today's free-text fields." },
    { module: "Refined Question Bank", desc: "Ongoing revision of the assessment questions themselves as the tool matures." }
  ];
  function renderRoadmapTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Site Status</div>
        <h2 class="page-title">Roadmap</h2>
        <p class="page-lede">Not the assessment methodology - this page tracks the status of the website itself: what's shipped and working, what's actively being built, and what's planned next. Started <b>${SITE_STARTED}</b> \xB7 Last updated <b>${SITE_LAST_UPDATED}</b>.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Shipped &amp; accessible now</h3>
        <p class="body-text">Fully functional in the live version of this site today.</p>
        <div class="roadmap-log-grid">
          ${ROADMAP_SHIPPED.map((m) => `
            <div class="roadmap-log-card roadmap-log-shipped">
              <div class="roadmap-log-date">${m.added}</div>
              <h4>${m.module}</h4>
              <p>${m.desc}</p>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Work in progress</h3>
        <p class="body-text">Being actively built right now.</p>
        <div class="roadmap-log-grid">
          ${ROADMAP_IN_PROGRESS.map((m) => `
            <div class="roadmap-log-card roadmap-log-progress">
              <div class="roadmap-log-date">In progress</div>
              <h4>${m.module}</h4>
              <p>${m.desc}</p>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Planned / ideation</h3>
        <p class="body-text">Not yet started - scoped and intended, not yet onboarded.</p>
        <div class="roadmap-log-grid">
          ${ROADMAP_PLANNED.map((m) => `
            <div class="roadmap-log-card roadmap-log-planned">
              <div class="roadmap-log-date">Planned</div>
              <h4>${m.module}</h4>
              <p>${m.desc}</p>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
  }
  function wireAccordions(container) {
    container.querySelectorAll(".acc-head").forEach((head) => {
      head.addEventListener("click", () => {
        head.parentElement.classList.toggle("open");
      });
    });
  }
  function renderRunbookTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Documentation & Runbooks</div>
        <h2 class="page-title">Runbooks your team can actually use</h2>
        <p class="page-lede">Guidance on the documents every program needs, and step-by-step runbooks for the incidents most likely to happen - ransomware, phishing, DDoS, and lateral movement.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Keeping documents alive, not just written</h3>
        <p class="body-text">A policy that's never reviewed is a policy that's already wrong. Every foundational document below should move through the same cycle continuously:</p>
        <div class="lifecycle-wrap">${buildLifecycleSvg()}</div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Foundational Documents</h3>
        <div id="docAccordions"></div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Incident Runbooks</h3>
        <p class="body-text">Each of these is meant to be printable and usable mid-incident - short, ordered, and specific enough that whoever's on call at 2am isn't improvising.</p>
        <div id="runbookAccordions"></div>
        <div class="cta-row">
          <button class="cta-btn" id="ctaDocsAssess">See where you stand first \u2192</button>
        </div>
      </div>
    </div>
  `;
    const docContainer = document.getElementById("docAccordions");
    docContainer.innerHTML = FOUNDATIONAL_DOCS.map((d) => `
    <div class="acc-card" data-id="${d.id}">
      <div class="acc-head">
        <div class="icon-badge">${icon(d.icon)}</div>
        <div><h4>${d.title}</h4></div>
        <div class="acc-chevron">\u25B8</div>
      </div>
      <div class="acc-body"><ul>${d.points.map((pt) => `<li>${pt}</li>`).join("")}</ul></div>
    </div>
  `).join("");
    const runbookContainer = document.getElementById("runbookAccordions");
    runbookContainer.innerHTML = RUNBOOKS.map((r) => `
    <div class="acc-card" data-id="${r.id}">
      <div class="acc-head">
        <div class="icon-badge">${icon(r.icon)}</div>
        <div><h4>${r.title}</h4><div class="acc-sub">${r.sub}</div></div>
        <div class="acc-chevron">\u25B8</div>
      </div>
      <div class="acc-body"><ol>${r.steps.map((s) => `<li>${s}</li>`).join("")}</ol></div>
    </div>
  `).join("");
    wireAccordions(docContainer);
    wireAccordions(runbookContainer);
    document.getElementById("ctaDocsAssess").addEventListener("click", () => goToTab("assessment"));
  }
  function renderTransformTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Assessment</div>
        <h2 class="page-title">Import Report</h2>
        <p class="page-lede">Import a previous assessment to review and re-run it, and follow the practical steps for actually closing what it found.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Import a previous report</h3>
        <div class="upload-zone">
          <label class="upload-label" for="reportUpload">Choose a file \u2192</label>
          <input type="file" id="reportUpload" accept=".json">
          <div class="upload-hint">Choose your exported SimplifiedCS JSON file to resume the assessment.</div>
          <div id="uploadResult"></div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Steps to strengthen your cyber health</h3>
        <p class="body-text">Once you know what's wrong, this is the practical sequence for actually fixing it - each step ties back to a specific phase on the Maturity Model.</p>
        <div class="transform-steps">
          ${TRANSFORM_STEPS.map((s) => `
            <div class="transform-step">
              <div class="transform-step-num">${String(s.n).padStart(2, "0")}</div>
              <div>
                <h4>${s.title}</h4>
                <p>${s.desc}</p>
                <div class="phase-ref">${s.phaseRef}</div>
              </div>
            </div>
          `).join("")}
        </div>

        <div class="cta-row">
          <button class="cta-btn" id="ctaTransformAssess">Start a fresh assessment \u2192</button>
          <button class="cta-btn secondary" id="ctaTransformRoadmap">See the full Maturity Model</button>
        </div>
      </div>
    </div>
  `;
    document.getElementById("ctaTransformAssess").addEventListener("click", () => goToTab("assessment"));
    document.getElementById("ctaTransformRoadmap").addEventListener("click", () => goToTab("maturity"));
    document.getElementById("reportUpload").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const resultEl = document.getElementById("uploadResult");
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext === "json") {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!data.scsExport) throw new Error("not-recognized");
            assessmentController.loadExport(data);
            const industryLabel = (INDUSTRIES.find((i) => i.id === (data.scope?.industry || data.answers?.industry)) || {}).label || "Not set";
            const scoreLine = data.overall === null || data.overall === void 0 ? "In progress - not yet completed" : `${data.overall}% overall`;
            resultEl.className = "upload-result";
            resultEl.innerHTML = `
            <b>Report loaded</b> - ${file.name}<br>
            Previous status: <b>${scoreLine}</b> \xB7 Industry: <b>${industryLabel}</b><br>
            Exported: ${data.exportedAt ? new Date(data.exportedAt).toLocaleString() : "unknown"}<br><br>
            Your prior answers are loaded. Continue to the Assessment tab to review, adjust, and re-run.
          `;
            const goBtn = document.createElement("button");
            goBtn.className = "cta-btn";
            goBtn.style.marginTop = "14px";
            goBtn.textContent = "Review & re-run assessment \u2192";
            goBtn.addEventListener("click", () => {
              goToTab("assessment");
            });
            resultEl.appendChild(goBtn);
          } catch (err) {
            resultEl.className = "upload-result error";
            resultEl.innerHTML = `<b>Couldn't read this file</b> - it doesn't look like a SimplifiedCS export. Try exporting one from a completed assessment's results screen first (look for "Export as JSON").`;
          }
        };
        reader.readAsText(file);
      } else {
        resultEl.className = "upload-result";
        resultEl.innerHTML = `
        <b>File received</b> - ${file.name}<br>
        This prototype only fully parses its own JSON export format. In the live version, this is exactly where Claude's document understanding would extract structured findings from any report format (PDF, Word, whatever your last audit came in) and pre-populate the assessment automatically - that integration isn't built here yet.
      `;
      }
    });
  }
  function renderMaturityModelTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">What is SimplifiedCS?</h2>
        <p class="page-lede">What this tool is, how it's used, and what it covers.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Contents</h3>
        <ul class="toc-list">
          <li><a href="#mm-what">What this tool is</a></li>
          <li><a href="#mm-how">How it's used</a></li>
          <li><a href="#mm-capabilities">Capabilities</a></li>
          <li><a href="#mm-segments">Segments covered</a></li>
        </ul>
      </div>

      <div class="section-tile">
        <h3 class="section-h" id="mm-what">What this tool is</h3>
        <p class="body-text">A self-assessment and advisory instrument that scores an organization's cybersecurity health against NIST CSF 2.0 and CIS Controls v8, cross-references answers for compounding risk instead of scoring each in isolation, and tracks maturity across repeated runs over time.</p>

        <h3 class="section-h" id="mm-how">How it's used</h3>
        <p class="body-text">Pick an industry and any relevant compliance standards, answer an adaptive questionnaire that only shows what's relevant to your organization, and receive a scored, prioritized report - then re-run it periodically and use Import Report to close what it finds.</p>

        <h3 class="section-h" id="mm-capabilities">Capabilities</h3>
        <p class="body-text">Adaptive question branching by industry and infrastructure \xB7 compounding-risk detection across answers rather than per-question scoring alone \xB7 vendor-aware mitigation notes for named products \xB7 assessment history with score-delta tracking \xB7 a documentation and runbook library \xB7 report import for re-assessment \xB7 a maturity model for context. See the <a href="#" id="linkMaturityFromWhat" class="inline-link">Maturity Model</a> and <a href="#" id="linkMetricsFromWhat" class="inline-link">Metrics</a> pages for the full detail behind each of these.</p>

        <h3 class="section-h" id="mm-segments">Segments covered</h3>
        <p class="body-text">NIST CSF 2.0 (all six functions, including Govern) and CIS Controls v8 as the fixed baseline, with optional ISO 27001, NIS2, SOC 2, HIPAA, GDPR, SOX, Cyber Essentials, and PCI DSS modules layered in by industry and region. Dedicated coverage for Operational Technology/ICS and DevSecOps/cloud-native practices, both shown only when relevant to the organization being assessed.</p>
        <div class="cta-row">
          <button class="cta-btn" id="ctaMMAssess">Start an assessment \u2192</button>
        </div>
      </div>
    </div>
  `;
    document.getElementById("ctaMMAssess").addEventListener("click", () => goToTab("assessment"));
    document.getElementById("linkMaturityFromWhat").addEventListener("click", (e) => {
      e.preventDefault();
      goToTab("maturity");
    });
    document.getElementById("linkMetricsFromWhat").addEventListener("click", (e) => {
      e.preventDefault();
      goToTab("metrics");
    });
  }
  function renderNewsTab(container) {
    const cats = [
      { id: "all", label: "All" },
      { id: "ai", label: "AI & Security" },
      { id: "vuln", label: "Vulnerabilities" },
      { id: "ot", label: "OT / Industrial" },
      { id: "landscape", label: "Threat Landscape" }
    ];
    const items = NEWS_ITEMS.filter((n) => newsFilter === "all" || n.cat === newsFilter).sort((a2, b) => b.date.localeCompare(a2.date));
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Stay Current</div>
        <h2 class="page-title">Trends & News</h2>
        <p class="page-lede">A curated read of what's actually happening in the threat landscape and in AI-for-security - the same context a good consultant would bring into a conversation with you.</p>
      </div>

      <div class="section-tile">
        <p class="news-freshness">Curated snapshot as of early August 2026. In production, this section is designed to pull from a live feed (CISA's KEV catalog, NVD, and RSS from outlets like SecurityWeek/BleepingComputer/Krebs) rather than being hand-maintained.</p>
        <div class="news-filters">
          ${cats.map((c) => `<button class="filter-pill ${newsFilter === c.id ? "active" : ""}" data-cat="${c.id}">${c.label}</button>`).join("")}
        </div>
        <div class="news-grid">
          ${items.map((n) => `
            <div class="news-card">
              <div class="news-meta"><span>${(/* @__PURE__ */ new Date(n.date + "T00:00:00")).toLocaleDateString(void 0, { month: "short", day: "numeric", year: "numeric" })}</span><span class="news-cat">${n.catLabel}</span></div>
              <h4>${n.headline}</h4>
              <p>${n.body}</p>
              <div class="news-source">${n.source}</div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Where to keep following this yourself</h3>
        <p class="body-text">This tab is a snapshot; these are live, ongoing sources across every format worth following - podcasts for the commute, newsletters for the inbox, and communities for everything in between.</p>
        <div class="resource-groups">
          <div class="resource-group">
            <h4>Podcasts</h4>
            ${LEARNING_RESOURCES.podcasts.map((r) => `<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join("")}
          </div>
          <div class="resource-group">
            <h4>Newsletters</h4>
            ${LEARNING_RESOURCES.newsletters.map((r) => `<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join("")}
          </div>
          <div class="resource-group">
            <h4>Medium</h4>
            ${LEARNING_RESOURCES.medium.map((r) => `<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join("")}
          </div>
          <div class="resource-group">
            <h4>News Sites</h4>
            ${LEARNING_RESOURCES.newssites.map((r) => `<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join("")}
          </div>
          <div class="resource-group">
            <h4>LinkedIn</h4>
            ${LEARNING_RESOURCES.linkedin.map((r) => `<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
    container.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        newsFilter = btn.dataset.cat;
        renderNewsTab(container);
      });
    });
  }
  function renderGlossaryTab(container) {
    const sorted = [...GLOSSARY].sort((a2, b) => a2.term.localeCompare(b.term));
    const groups = {};
    sorted.forEach((g) => {
      const letter = g.term[0].toUpperCase();
      (groups[letter] = groups[letter] || []).push(g);
    });
    const letters = Object.keys(groups).sort();
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">Glossary</h2>
        <p class="page-lede">Every cybersecurity term used across this site, defined in plain language and sorted alphabetically.</p>
      </div>
      <div class="section-tile">
        <div class="alpha-index">
          ${alphabet.map((l) => groups[l] ? `<a class="alpha-chip" href="#gl-${l}">${l}</a>` : `<span class="alpha-chip disabled">${l}</span>`).join("")}
        </div>
        ${letters.map((l) => `
          <div class="glossary-letter-group" id="gl-${l}">
            <div class="glossary-letter">${l}</div>
            ${groups[l].map((g) => `
              <div class="glossary-entry"><b>${g.term}</b><span>${g.def}</span></div>
            `).join("")}
          </div>
        `).join("")}
      </div>
    </div>
  `;
  }
  function renderReferencesTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">References</h2>
        <p class="page-lede">The frameworks, catalogs, and reports this assessment is built on and cites.</p>
      </div>
      <div class="section-tile">
        <ul class="ref-list">
          ${REFERENCES.map((r) => `
            <li>
              ${r.href ? `<a class="link-pill" href="${r.href}" target="_blank" rel="noopener noreferrer"><span class="link-pill-icon">${icon("external")}</span>${r.label}</a>` : `<b style="color:var(--text)">${r.label}</b>`}
              <div style="margin-top:8px;">${r.note}</div>
            </li>
          `).join("")}
        </ul>
      </div>
    </div>
  `;
  }
  function renderFeedbackTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Feedback</div>
        <h2 class="page-title">Send feedback</h2>
        <p class="page-lede">Found something broken, confusing, or missing? Think a feature should exist? This goes straight to the creator - no account or email of yours required.</p>
      </div>
      <div class="section-tile">
        <div id="feedbackFormWrap">
          <form id="feedbackForm">
            <div class="field">
              <label>Your name <span class="opt-tag">optional</span></label>
              <input type="text" id="fbName" placeholder="How should we address you?">
            </div>
            <div class="field">
              <label>Your email <span class="opt-tag">optional</span></label>
              <input type="email" id="fbEmail" placeholder="Only if you'd like a reply">
            </div>
            <div class="field">
              <label>Feedback</label>
              <textarea id="fbMessage" rows="6" placeholder="Bug report, confusing wording, a feature you think is missing - anything." required></textarea>
            </div>
            <div style="position:absolute; left:-9999px;"><label>Don't fill this out: <input type="text" id="fbBotField"></label></div>
            <div id="fbError" class="fb-error" style="display:none;"></div>
            <div class="cta-row">
              <button type="submit" class="cta-btn" id="fbSubmit">Send feedback \u2192</button>
            </div>
          </form>
        </div>
        <div id="feedbackSuccess" style="display:none;">
          <p class="body-text">Thank you - your feedback has been sent. It's genuinely read and taken into account for what gets worked on next.</p>
          <div class="cta-row">
            <button class="cta-btn secondary" id="fbBackHome">Back to Home</button>
          </div>
        </div>
      </div>
    </div>
  `;
    document.getElementById("fbBackHome")?.addEventListener("click", () => goToTab("home"));
    document.getElementById("feedbackForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("fbError");
      errEl.style.display = "none";
      const message = document.getElementById("fbMessage").value.trim();
      if (!message) {
        errEl.textContent = "Please enter your feedback before sending.";
        errEl.style.display = "block";
        return;
      }
      const submitBtn = document.getElementById("fbSubmit");
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
      const payload = new URLSearchParams({
        "form-name": "feedback",
        "name": document.getElementById("fbName").value.trim(),
        "email": document.getElementById("fbEmail").value.trim(),
        "message": message,
        "bot-field": document.getElementById("fbBotField").value
      });
      try {
        const res = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload.toString()
        });
        if (!res.ok) throw new Error("Submission failed");
        document.getElementById("feedbackFormWrap").style.display = "none";
        document.getElementById("feedbackSuccess").style.display = "block";
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send feedback \u2192";
        errEl.textContent = "Couldn't send that just now - please try again in a moment.";
        errEl.style.display = "block";
      }
    });
  }
  function renderAboutTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">About</div>
        <h2 class="page-title">About this project</h2>
        <p class="page-lede">Hey there - my name is Sarath, creator of SimplifiedCS. I built this site with one goal: making cybersecurity accessible to everyone.</p>
        <p class="page-lede">With over 9 years of experience in cybersecurity and IT, I've seen the hurdles most companies actually run into firsthand, and wanted to design a simpler workflow for getting past them. This isn't meant to be a last-resort or final solution for every cyber need you have - the goal is to minimize risk as much as realistically possible, using existing tools and minimal cost, not to replace a real security program entirely.</p>
        <p class="page-lede">This is a work in progress, and feedback is genuinely welcome - if you think a feature is missing or something could work better, I'd like to hear about it.</p>
        <p class="page-lede">This project is a cybersecurity assessment and compliance-readiness platform designed for small and medium-sized businesses. It helps organizations understand their current security posture, identify weaknesses, and receive practical recommendations to strengthen their cybersecurity defenses.</p>
        <p class="page-lede">The platform is based primarily on the NIST Cybersecurity Framework and CIS Critical Security Controls v8. It guides organizations through structured assessments, highlights security gaps, and provides actionable suggestions to improve their overall resilience.</p>
        <p class="page-lede">In addition to security assessments, the platform supports compliance-readiness initiatives for frameworks such as ISO/IEC 27001 and SOC 2. Its long-term goal is to provide businesses with a centralized solution for continuously monitoring, improving, and demonstrating their security and compliance posture.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The idea behind the mark</h3>
        <p class="body-text">Fragments, scattered and disconnected, converging into a single, complete shield. That's meant to mirror what this tool actually does - individually small, disconnected gaps (a missing control here, an unpatched system there) assembling into your real security posture once they're identified and addressed together.</p>
        <div class="logo-assembly-wrap" id="logoAssemblyWrap"></div>
      </div>

      <div class="section-tile">
        <p class="body-text">This section is intentionally left blank for now.</p>
      </div>
    </div>
  `;
    renderLogoAssembly();
  }
  function renderLogoAssembly() {
    const wrap = document.getElementById("logoAssemblyWrap");
    if (!wrap) return;
    const logoSrc = document.querySelector(".brand-logo")?.src || "";
    const fragments = [
      { x: -180, y: -90, size: 14, delay: 0 },
      { x: -210, y: -30, size: 10, delay: 0.35 },
      { x: -170, y: 40, size: 16, delay: 0.7 },
      { x: -140, y: -120, size: 8, delay: 1.05 },
      { x: -230, y: 70, size: 12, delay: 0.23 },
      { x: -100, y: 100, size: 9, delay: 1.17 },
      { x: -190, y: 110, size: 11, delay: 0.58 },
      { x: -240, y: -60, size: 13, delay: 0.82 },
      { x: -120, y: -70, size: 10, delay: 1.28 },
      { x: -160, y: -160, size: 9, delay: 0.47 },
      { x: -250, y: 10, size: 15, delay: 0.93 },
      { x: -90, y: -140, size: 8, delay: 1.4 }
    ];
    wrap.innerHTML = `
    <div class="logo-assembly-stage">
      ${fragments.map((f) => `<div class="assembly-fragment" style="--fx:${f.x}px; --fy:${f.y}px; --fdelay:${f.delay}s; width:${f.size}px; height:${f.size}px;"></div>`).join("")}
      <img src="${logoSrc}" alt="SimplifiedCS logo" class="assembly-logo">
    </div>
  `;
  }
  var CORE_PRINCIPLES = [
    { title: "Proactive, not reactive", desc: "Waiting for an incident to find your gaps is the most expensive way to learn about them. Assessing, monitoring, and fixing ahead of time is consistently cheaper than recovering afterward - the entire reason this site exists is to move that discovery earlier." },
    { title: "People, process, and technology - not technology alone", desc: "A well-configured firewall behind an untrained employee and no documented process is still a weak posture. Real security improvement requires progress across all three, together, not a single expensive tool standing in for the other two." },
    { title: "A culture, not a department", desc: "Security isn't something the IT team owns on everyone else's behalf. Every person who clicks a link, sets a password, or handles data is part of the control surface - the goal is a culture people grow into, not a policy document nobody reads." },
    { title: "Defense in depth", desc: "No single control is perfect, so no single control should be load-bearing. Layer defenses so that one failure - a missed patch, a clicked phishing link - doesn't cascade into a full compromise on its own." },
    { title: "Zero trust", desc: "Trust is not something a network location should grant automatically. Every request gets verified explicitly, regardless of whether it originates inside or outside the perimeter - the perimeter itself is no longer the control." },
    { title: "Least privilege", desc: "Access should match what a role genuinely needs to do its job, nothing more. Excess privilege sits quietly until the one day an account is compromised, at which point it becomes the attacker's privilege too." },
    { title: "The CIA triad", desc: 'Confidentiality, Integrity, and Availability - the three properties "secure" actually breaks down into. A control that protects one can quietly undermine another; good security design keeps all three in view at once, not just the one that feels most urgent.' },
    { title: "Segment the problem, not just the network", desc: "Looking at an entire security program at once is paralyzing. Breaking it into smaller, contained pieces - by function, by system, by risk - the same way network segmentation contains a breach, makes the work tractable and the containment real." },
    { title: "Decide from data, not instinct", desc: "Gut feeling about where the risk is usually points at the most visible problem, not the most likely one. Structured assessment, scoring, and trend tracking exist precisely to replace that instinct with evidence." },
    { title: "Improvement is a loop, not a destination", desc: `There's no final state where an organization is simply "done" being secure. Threats, infrastructure, and staff all change continuously, so the assessment is built to be re-run on a cadence, not completed once and filed away - the same loop this site's own animation is built around.` }
  ];
  function renderCorePrinciplesTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Philosophy</div>
        <h2 class="page-title">Core Principles</h2>
        <p class="page-lede">The cybersecurity principles this site is designed around - not a marketing list, the actual reasoning behind how the assessment, scoring, and recommendations are built.</p>
      </div>
      <div class="section-tile">
        <div class="principles-grid">
          ${CORE_PRINCIPLES.map((p, i) => `
            <div class="principle-card">
              <div class="principle-num">${String(i + 1).padStart(2, "0")}</div>
              <h4>${p.title}</h4>
              <p>${p.desc}</p>
            </div>
          `).join("")}
        </div>
        <div class="cta-row">
          <button class="cta-btn" id="ctaPrinciplesAssess">See these principles in practice \u2192</button>
        </div>
      </div>
    </div>
  `;
    document.getElementById("ctaPrinciplesAssess").addEventListener("click", () => goToTab("assessment"));
  }
  function renderPlaybooksTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">Playbooks</h2>
        <p class="page-lede">Top attack types curated based on OWASP Top 10, mapped through MITRE ATT&amp;CK/ATLAS to concrete mitigations.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">What a playbook is</h3>
        <p class="body-text">A playbook is a structured, step-by-step reference that pairs a specific attack pattern with a defined set of detection and mitigation actions, so a team responds consistently rather than improvising mid-incident. Each one below is created by identifying a classified attack type, mapping it to a MITRE ATT&amp;CK or ATLAS tactic, and deriving mitigation steps from the applicable NIST CSF controls. They exist so that response knowledge lives in a document instead of one person's head - repeatable across a team and over time. In practice, a company keeps the relevant playbook accessible to whoever is on call, walks through it during tabletop exercises (see Maturity Model Phase 7 - Response Readiness & Testing), and updates it whenever a real incident exposes a gap.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Selection criteria</h3>
        <p class="body-text">Attack types included below were chosen against four criteria:</p>
        <ol class="ordered-list">
          ${PLAYBOOK_SELECTION_CRITERIA.map((c) => `<li>${c}</li>`).join("")}
        </ol>
      </div>

      <div class="section-tile">
        <h3 class="section-h">OSINT tools referenced</h3>
        <p class="body-text">Building and validating a playbook draws on the following open-source intelligence and reconnaissance tools - used here strictly for reference and threat-model construction, not for conducting unauthorized testing.</p>
        <div class="osint-grid">
          ${OSINT_TOOLS.map((t) => `<div class="osint-item"><b>${t.name}</b><span>${t.desc}</span></div>`).join("")}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">How MITRE ATT&amp;CK / ATLAS is used</h3>
        <p class="body-text">MITRE ATT&amp;CK organizes real-world adversary behavior into Tactics (the attacker's goal at a given stage - Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact) and Techniques (the specific method used to achieve that goal, each with a standard ID such as T1190). For AI/LLM-specific attack types, MITRE ATLAS - a parallel framework scoped specifically to adversarial threats against AI/ML systems - is referenced instead, since classic ATT&amp;CK wasn't built to describe attacks like prompt injection or model poisoning.</p>
        <h3 class="section-h">Mapping methodology</h3>
        <p class="body-text">Each playbook below follows the same construction path: the attack type is anchored to its OWASP category; the underlying attacker behavior is mapped to its corresponding MITRE ATT&amp;CK or ATLAS tactic (and technique ID where one applies); the mitigation steps are derived primarily from the NIST CSF Protect and Detect functions; and each entry is kept to four concrete, achievable steps rather than an exhaustive checklist, consistent with this site's Runbooks tab.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Example playbooks</h3>
        <div id="playbookAccordions"></div>
      </div>
    </div>
  `;
    const pbContainer = document.getElementById("playbookAccordions");
    pbContainer.innerHTML = PLAYBOOKS.map((p) => `
    <div class="acc-card" data-id="${p.ref}">
      <div class="acc-head">
        <div class="icon-badge">${icon("urgent")}</div>
        <div>
          <h4>${p.title} <span class="q-badge">${p.cat}</span></h4>
          <div class="acc-sub">${p.ref} \xB7 ${p.mitre}</div>
        </div>
        <div class="acc-chevron">\u25B8</div>
      </div>
      <div class="acc-body">
        <p class="body-text" style="margin-bottom:12px;">${p.desc}</p>
        <ol>${p.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      </div>
    </div>
  `).join("");
    wireAccordions(pbContainer);
  }
  function renderCaseStudyTab(container) {
    container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Learn From What Already Happened</div>
        <h2 class="page-title">Case Studies</h2>
        <p class="page-lede">Eight watershed cybersecurity incidents - each one traces back to a gap this site is specifically built to catch before it becomes a headline.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Watershed incidents</h3>
        <div class="case-grid">
          ${CASE_STUDIES.map((c) => `
            <div class="case-card">
              <div class="case-year">${c.year}</div>
              <h4>${c.title}</h4>
              <p>${c.body}</p>
              <div class="case-lesson"><b>Why it's here -</b> ${c.lesson}</div>
              <a class="case-link link-pill" href="${c.href}" target="_blank" rel="noopener noreferrer"><span class="link-pill-icon">${icon("external")}</span>Read more</a>
            </div>
          `).join("")}
        </div>
        <div class="cta-row">
          <button class="cta-btn" id="ctaCaseAssess">See where you stand \u2192</button>
          <button class="cta-btn secondary" id="ctaCaseRunbook">See the matching runbooks</button>
        </div>
      </div>
    </div>
  `;
    document.getElementById("ctaCaseAssess").addEventListener("click", () => goToTab("assessment"));
    document.getElementById("ctaCaseRunbook").addEventListener("click", () => goToTab("runbook"));
  }
  function buildTrendSvg(runs) {
    const w = 600, h = 120, pad = 20;
    const points = runs.map((r, i) => {
      const x = pad + (runs.length === 1 ? 0 : i / (runs.length - 1) * (w - 2 * pad));
      const y = h - pad - r.overall / 100 * (h - 2 * pad);
      return [x, y];
    });
    const pathD = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const dots = points.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--accent-secure)"/>`).join("");
    return `<svg class="trend-chart" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--line)" stroke-width="1"/>
    <path d="${pathD}" fill="none" stroke="var(--accent-secure)" stroke-width="2"/>
    ${dots}
  </svg>`;
  }
  async function renderHistory() {
    const panel = document.getElementById("panel");
    panel.innerHTML = `<div class="page-intro"><div class="page-eyebrow">History</div><h2 class="page-title">Loading past assessments\u2026</h2></div>`;
    let runs = [];
    try {
      const lr = await window.storage.list("runs:", false);
      if (lr && lr.keys && lr.keys.length) {
        const gets = await Promise.all(lr.keys.map((k) => window.storage.get(k, false).catch(() => null)));
        runs = gets.filter(Boolean).map((g) => JSON.parse(g.value)).sort((a2, b) => a2.ts - b.ts);
      }
    } catch (e) {
    }
    panel.innerHTML = `
    <div class="page-intro">
      <div class="page-eyebrow">History</div>
      <h2 class="page-title">Assessment History</h2>
      <p class="page-lede">${runs.length} assessment${runs.length === 1 ? "" : "s"} saved on this account.</p>
    </div>
    <div class="section-tile">
      ${runs.length >= 2 ? buildTrendSvg(runs) : ""}
      <div class="history-list">
        ${runs.length ? runs.slice().reverse().map((r) => `
          <div class="history-row">
            <div>${new Date(r.ts).toLocaleDateString()} ${new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${r.industry ? " \xB7 " + (INDUSTRIES.find((i) => i.id === r.industry)?.label || r.industry) : ""}</div>
            <div class="history-score">${r.overall}%</div>
          </div>
        `).join("") : '<p class="body-text">No assessments saved yet - complete one to start tracking.</p>'}
      </div>
      <div class="cta-row">
        <button class="cta-btn" id="backToScope">\u2190 Back to Assessment</button>
        ${runs.length ? `<button class="cta-btn secondary" id="clearHistory">Clear history</button>` : ""}
      </div>
    </div>
  `;
    document.getElementById("backToScope").addEventListener("click", () => {
      goToTab("assessment");
    });
    const clearBtn = document.getElementById("clearHistory");
    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        try {
          const lr = await window.storage.list("runs:", false);
          if (lr && lr.keys) await Promise.all(lr.keys.map((k) => window.storage.delete(k, false).catch(() => null)));
        } catch (e) {
        }
        renderHistory();
      });
    }
    observeReveals();
  }
  (async function init() {
    try {
      const r = await window.storage.get("theme", false);
      if (r && (r.value === "light" || r.value === "dark")) theme = r.value;
    } catch (e) {
    }
    document.documentElement.setAttribute("data-theme", theme);
    renderApp();
  })();
})();
