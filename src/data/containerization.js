// §5.5 — containerization/virtualization as an independent top-level
// question, decoupled from "do you develop custom software". An org can run
// containers or hypervisors for file servers, intranet sites, or other
// infrastructure with zero custom development happening, so this no longer
// lives behind developsSoftware the way it incorrectly did before.
//
// These nodes rely on the graph engine's default ordering + visibleIf,
// rather than explicit next() overrides, since it's a simple linear
// checklist with no real branch points.
export const CONTAINERIZATION_ORDER = [
  "usesContainers",
  "containerOrchestration",
  "containerImageScanning",
  "containerHostSecurity",
  "usesVirtualization",
  "hypervisorPatching",
  "vmSegmentation",
];

export const CONTAINERIZATION_NODES = [
  {
    id: "usesContainers",
    kind: "profile",
    category: "infra",
    type: "select",
    text: "Do you use containerization (e.g. Docker) for any systems - applications, file servers, intranet sites, or other infrastructure?",
    options: ["No", "Yes, some workloads", "Yes, most/all workloads"],
    required: true,
  },
  {
    id: "containerOrchestration",
    kind: "profile",
    category: "infra",
    type: "select",
    text: "If containerized, do you use an orchestrator (e.g. Kubernetes)?",
    options: ["No, containers run without an orchestrator", "Yes"],
    visibleIf: (answers) => answers.usesContainers && answers.usesContainers !== "No",
  },
  {
    id: "containerImageScanning",
    kind: "profile",
    category: "infra",
    type: "select",
    text: "Are container images/dependencies scanned for known vulnerabilities before deployment?",
    options: ["No", "Occasionally", "Yes, automated on every build"],
    visibleIf: (answers) => answers.usesContainers && answers.usesContainers !== "No",
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
      "Hardened and patched on a defined cadence",
    ],
    visibleIf: (answers) => answers.usesContainers && answers.usesContainers !== "No",
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
      "Yes, cloud VM instances",
    ],
    required: true,
  },
  {
    id: "hypervisorPatching",
    kind: "profile",
    category: "infra",
    type: "select",
    text: "How are hypervisor hosts patched and maintained?",
    options: ["Ad hoc / rarely", "Scheduled maintenance windows", "Actively managed patch program with a defined SLA"],
    visibleIf: (answers) => answers.usesVirtualization && answers.usesVirtualization !== "No / cloud-native only",
  },
  {
    id: "vmSegmentation",
    kind: "profile",
    category: "infra",
    type: "select",
    text: "Are VMs/containers for different trust levels (e.g. production vs. test, internet-facing vs. internal) network-segmented from each other?",
    options: ["No - flat network", "Partially segmented", "Yes, fully segmented"],
    visibleIf: (answers) =>
      (answers.usesContainers && answers.usesContainers !== "No") ||
      (answers.usesVirtualization && answers.usesVirtualization !== "No / cloud-native only"),
  },
];
